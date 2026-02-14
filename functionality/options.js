let currentSettings = normalizeSettings(DEFAULT_SETTINGS);

function saveSettings() {
  chrome.storage.local.set({ settings: currentSettings });
}

function setExportStatus(message) {
  const status = document.getElementById("export-status");
  if (!status) {
    return;
  }
  status.textContent = message || "";
}

function getStoragePayload() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ stats: DEFAULT_STATS, settings: DEFAULT_SETTINGS }, (data) => {
      resolve(data);
    });
  });
}

function triggerDownload(url, filename) {
  if (chrome.downloads && chrome.downloads.download) {
    return new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, saveAs: true }, (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          reject(
            chrome.runtime.lastError
              ? new Error(chrome.runtime.lastError.message)
              : new Error("Unable to start download.")
          );
          return;
        }
        resolve(downloadId);
      });
    });
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return Promise.resolve();
}

async function exportData() {
  const exportButton = document.getElementById("export-data");
  if (exportButton) {
    exportButton.disabled = true;
  }
  setExportStatus("Preparing JSON export...");

  try {
    const data = await getStoragePayload();
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: normalizeSettings(data.settings),
      stats: data.stats || DEFAULT_STATS
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    await triggerDownload(url, "arboria-carbon-data.json");
    setExportStatus("Export ready. Check your downloads.");
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (error) {
    console.error("Export failed:", error);
    setExportStatus("Export failed. Please try again.");
  } finally {
    if (exportButton) {
      exportButton.disabled = false;
    }
  }
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
