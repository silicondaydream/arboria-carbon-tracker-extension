const DEFAULT_STATS = {
  days: {},
  domains: {},
  recentPages: []
};

let latestSettings = normalizeSettings(DEFAULT_SETTINGS);
let controlsBound = false;
let toastTimeout = null;

function formatCarbonWeight(value) {
  let suffix = "g";
  let display = value || 0;
  if (display >= 1000000) {
    display = display / 1000000;
    suffix = "t";
  } else if (display >= 1000) {
    display = display / 1000;
    suffix = "kg";
  }
  display = display % 1 === 0 ? display : display.toFixed(1);
  return `${display}${suffix}`;
}

function formatDuration(seconds) {
  const totalMinutes = Math.round((seconds || 0) / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatDataVolume(gb) {
  if (!gb || gb < 0.001) {
    return "0 MB";
  }
  const mb = gb * 1024;
  if (mb < 1024) {
    return `${mb.toFixed(0)} MB`;
  }
  return `${gb.toFixed(2)} GB`;
}

function formatDateKey(offset) {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeAnnualForecast(dayTotals) {
  const activeDays = dayTotals.filter((value) => value > 0);
  if (!activeDays.length) {
    return 0;
  }
  const avg = activeDays.reduce((sum, value) => sum + value, 0) / activeDays.length;
  return avg * 365;
}

function renderChart(emissions) {
  const chart = document.getElementById("chart");
  chart.innerHTML = '<div id="chart-default">Not enough data yet...</div>';
  const max = emissions.length ? Math.max.apply(null, emissions) : 0;
  const columnHeight = 120;
  const ratio = max > 0 ? columnHeight / max : 0;
  chart.style.height = `${columnHeight}px`;

  emissions.forEach((value, index) => {
    const barHeight = ratio ? Math.max(1, Math.round(value * ratio)) : 0;
    const column = document.createElement("div");
    column.setAttribute("class", "chart-column");
    column.setAttribute("title", `${formatCarbonWeight(value)} on ${formatDateKey(emissions.length - 1 - index)}`);

    const area = document.createElement("div");
    area.setAttribute("class", "chart-area");
    area.style.height = `${columnHeight}px`;
    column.appendChild(area);

    const barWrap = document.createElement("div");
    barWrap.setAttribute("class", "chart-bar-wrap");
    barWrap.style.height = `${barHeight}px`;
    area.appendChild(barWrap);

    const bar = document.createElement("div");
    bar.setAttribute("class", "chart-bar");
    if (index === emissions.length - 1) {
      bar.setAttribute("class", "chart-bar today");
    }
    bar.style.height = `${barHeight}px`;
    barWrap.appendChild(bar);
    chart.appendChild(column);
  });
}

function renderDomains(domains) {
  const list = document.getElementById("domain-list");
  list.innerHTML = "";
  const entries = Object.entries(domains || {})
    .sort((a, b) => b[1].emissionsG - a[1].emissionsG)
    .slice(0, 6);

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.setAttribute("class", "muted");
    empty.textContent = "No domain data yet.";
    list.appendChild(empty);
    return;
  }

  entries.forEach(([hostname, data]) => {
    const row = document.createElement("div");
    row.setAttribute("class", "domain-row");
    const name = document.createElement("div");
    name.setAttribute("class", "domain-name");
    name.textContent = hostname.replace(/^www\./i, "");
    const value = document.createElement("div");
    value.setAttribute("class", "domain-value");
    value.textContent = formatCarbonWeight(data.emissionsG || 0);
    row.appendChild(name);
    row.appendChild(value);
    list.appendChild(row);
  });
}

function generateInsights(stats, settings) {
  const insights = [];
  const todayKey = formatDateKey(0);
  const today = stats.days[todayKey] || {};
  const todayEmissions = today.emissionsG || 0;
  const todayTime = today.activeSeconds || 0;
  const totalDomains = Object.keys(stats.domains || {}).length;

  if (!settings.trackingEnabled) {
    insights.push("Tracking is paused. Enable it to resume carbon estimates.");
    return insights;
  }

  if (todayEmissions > 500) {
    insights.push("High-impact day detected. Consider closing heavy tabs or reducing video quality.");
  }

  if (todayTime > 2 * 3600) {
    insights.push("You spent over 2 hours active today. Closing idle tabs can cut background energy use.");
  }

  if (totalDomains > 25) {
    insights.push("Wide browsing footprint today. Fewer tabs can reduce repeated data transfers.");
  }

  if (!insights.length) {
    insights.push("Nice! Your browsing impact is staying light today.");
  }

  return insights;
}

function renderInsights(list) {
  const container = document.getElementById("insights-list");
  container.innerHTML = "";
  list.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `“${item}”`;
    container.appendChild(li);
  });
}

function renderOverview(stats, settings) {
  const todayKey = formatDateKey(0);
  const today = stats.days[todayKey] || {};
  const todayCarbon = document.getElementById("today-carbon");
  todayCarbon.textContent = formatCarbonWeight(today.emissionsG || 0);

  const trackingToggle = document.getElementById("tracking-toggle");
  if (trackingToggle) {
    trackingToggle.checked = settings.trackingEnabled;
  }

  const todayTime = document.getElementById("today-time");
  todayTime.textContent = formatDuration(today.activeSeconds || 0);

  const todayData = document.getElementById("today-data");
  todayData.textContent = formatDataVolume(today.dataGB || 0);

  const dayEmissions = [];
  for (let i = 29; i >= 0; i -= 1) {
    const key = formatDateKey(i);
    const day = stats.days[key];
    dayEmissions.push(day ? day.emissionsG || 0 : 0);
  }

  const chartRow = document.querySelector(".chart-row");
  const chartCaption = document.getElementById("chart-caption");
  if (settings.showGraph) {
    document.body.classList.remove("graph-hidden");
    if (chartRow) {
      chartRow.classList.remove("is-hidden");
    }
    if (chartCaption) {
      chartCaption.classList.remove("is-hidden");
    }
    renderChart(dayEmissions);
  } else if (chartRow) {
    document.body.classList.add("graph-hidden");
    chartRow.classList.add("is-hidden");
    if (chartCaption) {
      chartCaption.classList.add("is-hidden");
    }
  }

  const annual = computeAnnualForecast(dayEmissions);
  const forecast = document.getElementById("forecast-count");
  forecast.textContent = annual ? formatCarbonWeight(annual) : "Not enough data...";

  const chartDefault = document.getElementById("chart-default");
  if (chartDefault) {
    if (dayEmissions.some((value) => value > 0)) {
      chartDefault.setAttribute("class", "chart-default-hidden");
    } else {
      chartDefault.removeAttribute("class");
    }
  }

  renderDomains(stats.domains || {});
  if (settings.suggestionsEnabled) {
    renderInsights(generateInsights(stats, settings));
  } else {
    renderInsights(["Suggestions are disabled."]);
  }
}

function bindControls() {
  const trackingToggle = document.getElementById("tracking-toggle");
  trackingToggle.checked = latestSettings.trackingEnabled;
  trackingToggle.addEventListener("change", (event) => {
    const updated = normalizeSettings(latestSettings);
    updated.trackingEnabled = event.target.checked;
    chrome.storage.local.set({ settings: updated });
    showToast(updated.trackingEnabled ? "Tracking enabled" : "Tracking paused");
  });

  const openSettings = document.getElementById("open-settings");
  openSettings.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

function showToast(message) {
  const toast = document.getElementById("toggle-toast");
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimeout) {
    window.clearTimeout(toastTimeout);
  }
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function init() {
  chrome.storage.local.get({ stats: DEFAULT_STATS, settings: DEFAULT_SETTINGS }, (data) => {
    const settings = normalizeSettings(data.settings);
    const stats = data.stats || DEFAULT_STATS;
    latestSettings = settings;
    renderOverview(stats, settings);
    if (!controlsBound) {
      bindControls();
      controlsBound = true;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
chrome.storage.onChanged.addListener(() => init());
