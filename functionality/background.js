importScripts("constants.js");

const DEFAULT_STATS = {
  days: {},
  domains: {},
  recentPages: []
};

const tabBytes = {};
let updateQueue = Promise.resolve();

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId == null || details.tabId < 0) {
      return;
    }
    const headers = details.responseHeaders || [];
    const lengthHeader = headers.find((header) => header.name && header.name.toLowerCase() === "content-length");
    if (!lengthHeader || !lengthHeader.value) {
      return;
    }
    const size = Number.parseInt(lengthHeader.value, 10);
    if (!Number.isFinite(size) || size <= 0) {
      return;
    }
    tabBytes[details.tabId] = (tabBytes[details.tabId] || 0) + size;
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

function getDateKey(timestamp) {
  const date = new Date(timestamp || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const parts = String(key).split("-");
  if (parts.length !== 3) {
    return new Date("invalid");
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  return new Date(year, month, day);
}

function getDomainMultiplier(settings, hostname) {
  if (!settings || !hostname) {
    return 1;
  }
  const override = settings.domainIntensity[hostname];
  if (Number.isFinite(override)) {
    return Math.max(0.1, Math.min(3, Number(override)));
  }
  return 1;
}

function ensureDay(stats, key) {
  if (!stats.days[key]) {
    stats.days[key] = {
      pageViews: 0,
      dataGB: 0,
      activeSeconds: 0,
      emissionsG: 0,
      mediaScoreSum: 0
    };
  }
  return stats.days[key];
}

function ensureDomain(stats, hostname) {
  if (!stats.domains[hostname]) {
    stats.domains[hostname] = {
      pageViews: 0,
      dataGB: 0,
      activeSeconds: 0,
      emissionsG: 0,
      mediaScoreSum: 0,
      lastSeen: 0
    };
  }
  return stats.domains[hostname];
}

function purgeOldDays(stats, retentionDays) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(1, retentionDays) + 1);
  Object.keys(stats.days).forEach((key) => {
    const entryDate = parseDateKey(key);
    if (Number.isNaN(entryDate.getTime()) || entryDate < cutoff) {
      delete stats.days[key];
    }
  });
}

function purgeOldDomains(stats, retentionDays) {
  const cutoff = Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;
  Object.keys(stats.domains).forEach((hostname) => {
    const lastSeen = stats.domains[hostname].lastSeen || 0;
    if (lastSeen < cutoff) {
      delete stats.domains[hostname];
    }
  });
}

function calculateDataEmissions(bytes, settings, mediaScore, domainMultiplier) {
  const dataGB = bytes > 0 ? bytes / (1024 * 1024 * 1024) : 0;
  const mediaBoost = 1 + (mediaScore || 0) * settings.dataTransferMultiplier;
  if (!dataGB) {
    return {
      dataGB: 0,
      emissionsG: settings.dataTransferFallbackGrams * mediaBoost * domainMultiplier
    };
  }
  const energyKwh = dataGB * settings.energyPerGB * settings.cacheFactor;
  const emissionsG = energyKwh * settings.gridIntensity * mediaBoost * domainMultiplier;
  return { dataGB, emissionsG };
}

function calculateDeviceEmissions(deltaSeconds, settings, mediaScore, domainMultiplier) {
  const basePower = getDevicePower(settings);
  const mediaBoost = 1 + (mediaScore || 0) * settings.mediaPowerMultiplier;
  const effectivePower = basePower * mediaBoost;
  const energyKwh = (effectivePower * (deltaSeconds / 3600)) / 1000;
  return energyKwh * settings.gridIntensity * domainMultiplier;
}

function getStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ settings: DEFAULT_SETTINGS, stats: DEFAULT_STATS }, resolve);
  });
}

function setStorage(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

function updateStats(updater) {
  updateQueue = updateQueue.then(async () => {
    const data = await getStorage();
    const settings = normalizeSettings(data.settings);
    const stats = Object.assign({}, DEFAULT_STATS, data.stats || {});
    stats.days = stats.days || {};
    stats.domains = stats.domains || {};
    stats.recentPages = Array.isArray(stats.recentPages) ? stats.recentPages : [];
    updater(stats, settings);
    purgeOldDays(stats, settings.retentionDays);
    purgeOldDomains(stats, settings.retentionDays);
    await setStorage({ stats, settings });
  });
  return updateQueue;
}

chrome.runtime.onInstalled.addListener(() => {
  updateStats(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === "pageMetrics") {
    updateStats((stats, settings) => {
      if (!settings.trackingEnabled) {
        return;
      }
      const payload = message.payload || {};
      const timestamp = payload.timestamp || Date.now();
      const hostname = payload.hostname || "unknown";
      const mediaScore = Math.max(0, Math.min(1, payload.mediaScore || 0));
      const domainMultiplier = getDomainMultiplier(settings, hostname);
      const tabId = sender && sender.tab ? sender.tab.id : null;
      const webRequestBytes = tabId != null ? tabBytes[tabId] || 0 : 0;
      if (tabId != null) {
        tabBytes[tabId] = 0;
      }
      const mergedBytes = Math.max(payload.bytes || 0, webRequestBytes);
      const { dataGB, emissionsG } = calculateDataEmissions(
        mergedBytes,
        settings,
        mediaScore,
        domainMultiplier
      );

      const dayKey = getDateKey(timestamp);
      const day = ensureDay(stats, dayKey);
      day.pageViews += 1;
      day.dataGB += dataGB;
      day.emissionsG += emissionsG;
      day.mediaScoreSum += mediaScore;

      const domain = ensureDomain(stats, hostname);
      domain.pageViews += 1;
      domain.dataGB += dataGB;
      domain.emissionsG += emissionsG;
      domain.mediaScoreSum += mediaScore;
      domain.lastSeen = timestamp;

      if (Array.isArray(stats.recentPages)) {
        stats.recentPages.unshift({
          timestamp,
          url: payload.url || "",
          title: payload.title || "",
          hostname,
          dataGB,
          emissionsG,
          mediaScore,
          resourceCounts: payload.resourceCounts || {}
        });
        stats.recentPages = stats.recentPages.slice(0, settings.recentPagesLimit);
      }
    });
    return;
  }

  if (message.type === "activeTime") {
    updateStats((stats, settings) => {
      if (!settings.trackingEnabled) {
        return;
      }
      const payload = message.payload || {};
      const deltaSeconds = Number(payload.deltaSeconds || 0);
      if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
        return;
      }
      const timestamp = payload.timestamp || Date.now();
      const hostname = payload.hostname || "unknown";
      const mediaScore = Math.max(0, Math.min(1, payload.mediaScore || 0));
      const domainMultiplier = getDomainMultiplier(settings, hostname);
      const emissionsG = calculateDeviceEmissions(deltaSeconds, settings, mediaScore, domainMultiplier);

      const dayKey = getDateKey(timestamp);
      const day = ensureDay(stats, dayKey);
      day.activeSeconds += deltaSeconds;
      day.emissionsG += emissionsG;

      const domain = ensureDomain(stats, hostname);
      domain.activeSeconds += deltaSeconds;
      domain.emissionsG += emissionsG;
      domain.lastSeen = timestamp;
    });
    return;
  }

  if (message.type === "resetStats") {
    updateStats((stats) => {
      stats.days = {};
      stats.domains = {};
      stats.recentPages = [];
    }).then(() => sendResponse({ ok: true }));
    return true;
  }
});
