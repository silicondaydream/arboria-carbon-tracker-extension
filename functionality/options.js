let currentSettings = normalizeSettings(DEFAULT_SETTINGS);

function saveSettings() {
  chrome.storage.local.set({ settings: currentSettings });
}

function exportData() {
  chrome.storage.local.get({ stats: DEFAULT_STATS, settings: DEFAULT_SETTINGS }, (data) => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: normalizeSettings(data.settings),
      stats: data.stats || DEFAULT_STATS
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "arboria-carbon-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

function setFieldValue(id, value) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }
  if (field.type === "checkbox") {
    field.checked = Boolean(value);
  } else {
    field.value = value;
  }
}

function toggleCustomPowerField() {
  const field = document.getElementById("custom-power-field");
  if (!field) {
    return;
  }
  field.style.display = currentSettings.deviceProfile === "custom" ? "flex" : "none";
}

function bindField(id, handler) {
  const field = document.getElementById(id);
  if (!field) {
    return;
  }
  field.addEventListener("change", handler);
}

function bindControls() {
  bindField("tracking-enabled", (event) => {
    currentSettings.trackingEnabled = event.target.checked;
    saveSettings();
  });

  bindField("suggestions-enabled", (event) => {
    currentSettings.suggestionsEnabled = event.target.checked;
    saveSettings();
  });

  bindField("show-graph", (event) => {
    currentSettings.showGraph = event.target.checked;
    saveSettings();
  });

  bindField("retention-days", (event) => {
    const value = Number(event.target.value || 45);
    currentSettings.retentionDays = Number.isFinite(value) ? value : 45;
    saveSettings();
  });

  bindField("device-profile", (event) => {
    currentSettings.deviceProfile = event.target.value;
    toggleCustomPowerField();
    saveSettings();
  });

  bindField("custom-device-power", (event) => {
    const value = Number(event.target.value);
    currentSettings.customDevicePowerW = Number.isFinite(value) && value > 0 ? value : null;
    saveSettings();
  });

  const resetStats = document.getElementById("reset-stats");
  resetStats.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "resetStats" });
  });

  const exportButton = document.getElementById("export-data");
  exportButton.addEventListener("click", exportData);

  const resetDefaults = document.getElementById("reset-defaults");
  resetDefaults.addEventListener("click", () => {
    currentSettings = normalizeSettings(DEFAULT_SETTINGS);
    saveSettings();
    renderSettings();
  });
}

function renderSettings() {
  setFieldValue("tracking-enabled", currentSettings.trackingEnabled);
  setFieldValue("suggestions-enabled", currentSettings.suggestionsEnabled);
  setFieldValue("show-graph", currentSettings.showGraph);
  setFieldValue("retention-days", currentSettings.retentionDays);
  setFieldValue("device-profile", currentSettings.deviceProfile);
  setFieldValue("custom-device-power", currentSettings.customDevicePowerW || "");
  toggleCustomPowerField();
}

function init() {
  chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (data) => {
    currentSettings = normalizeSettings(data.settings);
    renderSettings();
    bindControls();
  });
}

document.addEventListener("DOMContentLoaded", init);
