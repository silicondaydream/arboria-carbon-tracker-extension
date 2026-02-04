function collectResourceCounts(entries) {
  const counts = {
    img: 0,
    script: 0,
    css: 0,
    font: 0,
    fetch: 0,
    xhr: 0,
    media: 0,
    other: 0
  };

  entries.forEach((entry) => {
    const type = entry.initiatorType || "other";
    if (type === "img" || type === "image") {
      counts.img += 1;
    } else if (type === "script") {
      counts.script += 1;
    } else if (type === "css" || type === "link") {
      counts.css += 1;
    } else if (type === "font") {
      counts.font += 1;
    } else if (type === "xmlhttprequest") {
      counts.xhr += 1;
    } else if (type === "fetch") {
      counts.fetch += 1;
    } else if (type === "video" || type === "audio") {
      counts.media += 1;
    } else {
      counts.other += 1;
    }
  });

  return counts;
}

function calculateMediaScore(resourceCounts) {
  const videoCount = document.querySelectorAll("video").length;
  const audioCount = document.querySelectorAll("audio").length;
  const imageCount = document.images ? document.images.length : 0;
  const scriptCount = resourceCounts.script || 0;
  const mediaSignals = [
    videoCount > 0 ? 0.6 : 0,
    audioCount > 0 ? 0.2 : 0,
    Math.min(0.2, imageCount / 60),
    Math.min(0.2, scriptCount / 120)
  ];
  const score = mediaSignals.reduce((sum, value) => sum + value, 0);
  return Math.max(0, Math.min(1, score));
}

function collectTransferBytes(entries) {
  return entries.reduce((sum, entry) => {
    const size = entry.transferSize || entry.encodedBodySize || 0;
    return sum + size;
  }, 0);
}

function sendPageMetrics(settings) {
  const hostname = (window.location.hostname || "unknown").toLowerCase();
  const url = window.location.href || "";
  const title = document.title || "";
  const navEntry = performance.getEntriesByType("navigation")[0];
  const resourceEntries = performance.getEntriesByType("resource");
  const navBytes = navEntry ? (navEntry.transferSize || navEntry.encodedBodySize || 0) : 0;
  const resourceBytes = collectTransferBytes(resourceEntries);
  const resourceCounts = collectResourceCounts(resourceEntries);
  const mediaScore = calculateMediaScore(resourceCounts);
  const bytes = navBytes + resourceBytes;

  chrome.runtime.sendMessage({
    type: "pageMetrics",
    payload: {
      timestamp: Date.now(),
      hostname,
      url,
      title,
      bytes,
      resourceCounts,
      mediaScore
    }
  });

  startActiveTimeTracking(settings, { hostname, url, mediaScore });
}

function startActiveTimeTracking(settings, context) {
  if (!settings.trackingEnabled) {
    return;
  }

  const idleThreshold = 30000;
  const tickInterval = 5000;
  const sendEverySeconds = 30;
  let lastTick = Date.now();
  let lastInteraction = Date.now();
  let pendingSeconds = 0;

  function markInteraction() {
    lastInteraction = Date.now();
  }

  function flushPending(force) {
    if (pendingSeconds < 1 && !force) {
      return;
    }
    const delta = pendingSeconds;
    pendingSeconds = 0;
    chrome.runtime.sendMessage({
      type: "activeTime",
      payload: {
        timestamp: Date.now(),
        hostname: context.hostname,
        url: context.url,
        mediaScore: context.mediaScore,
        deltaSeconds: delta
      }
    });
  }

  function tick() {
    const now = Date.now();
    const isActive = !document.hidden && now - lastInteraction < idleThreshold;
    if (isActive) {
      pendingSeconds += (now - lastTick) / 1000;
    }
    lastTick = now;
    if (pendingSeconds >= sendEverySeconds) {
      flushPending();
    }
  }

  const intervalId = window.setInterval(tick, tickInterval);

  window.addEventListener("beforeunload", () => {
    flushPending(true);
    window.clearInterval(intervalId);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      flushPending(true);
    }
  });

  ["mousemove", "keydown", "scroll", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, markInteraction, { passive: true });
  });
}

chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (data) => {
  const settings = normalizeSettings(data.settings);
  if (!settings.trackingEnabled) {
    return;
  }
  if (document.readyState === "complete") {
    sendPageMetrics(settings);
  } else {
    window.addEventListener("load", () => sendPageMetrics(settings), { once: true });
  }
});
