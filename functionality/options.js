let currentSettings = normalizeSettings(DEFAULT_SETTINGS);

function saveSettings() {
  chrome.storage.local.set({ settings: currentSettings });
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

function renderDomainOverrides() {
  const container = document.getElementById("domain-overrides");
  container.innerHTML = "";
  const entries = Object.entries(currentSettings.domainIntensity || {});
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.textContent = "No overrides yet.";
    container.appendChild(empty);
    return;
  }

  entries.forEach(([domain, multiplier]) => {
    const row = document.createElement("div");
    row.setAttribute("class", "domain-row");
    const name = document.createElement("div");
    name.textContent = `${domain} · ${Number(multiplier).toFixed(2)}x`;
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      delete currentSettings.domainIntensity[domain];
      saveSettings();
      renderDomainOverrides();
    });
    row.appendChild(name);
    row.appendChild(remove);
    container.appendChild(row);
  });
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

  bindField("retention-days", (event) => {
    currentSettings.retentionDays = Math.max(7, Number(event.target.value || 45));
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

  bindField("energy-per-gb", (event) => {
    currentSettings.energyPerGB = Number(event.target.value || 0.81);
    saveSettings();
  });

  bindField("grid-intensity", (event) => {
    currentSettings.gridIntensity = Number(event.target.value || 442);
    saveSettings();
  });

  bindField("cache-factor", (event) => {
    currentSettings.cacheFactor = Number(event.target.value || 0.755);
    saveSettings();
  });

  bindField("fallback-grams", (event) => {
    currentSettings.dataTransferFallbackGrams = Number(event.target.value || 0.8);
    saveSettings();
  });

  bindField("media-multiplier", (event) => {
    currentSettings.mediaPowerMultiplier = Number(event.target.value || 0.3);
    saveSettings();
  });

  bindField("data-multiplier", (event) => {
    currentSettings.dataTransferMultiplier = Number(event.target.value || 0.15);
    saveSettings();
  });

  const addDomain = document.getElementById("add-domain");
  addDomain.addEventListener("click", () => {
    const domainField = document.getElementById("domain-input");
    const multiplierField = document.getElementById("domain-multiplier");
    const domain = (domainField.value || "").trim().toLowerCase();
    const multiplier = Number(multiplierField.value || 1);
    if (!domain) {
      return;
    }
    currentSettings.domainIntensity[domain] = Math.max(0.1, Math.min(3, multiplier));
    domainField.value = "";
    multiplierField.value = "";
    saveSettings();
    renderDomainOverrides();
  });

  const resetStats = document.getElementById("reset-stats");
  resetStats.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "resetStats" });
  });

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
  setFieldValue("retention-days", currentSettings.retentionDays);
  setFieldValue("device-profile", currentSettings.deviceProfile);
  setFieldValue("custom-device-power", currentSettings.customDevicePowerW || "");
  setFieldValue("energy-per-gb", currentSettings.energyPerGB);
  setFieldValue("grid-intensity", currentSettings.gridIntensity);
  setFieldValue("cache-factor", currentSettings.cacheFactor);
  setFieldValue("fallback-grams", currentSettings.dataTransferFallbackGrams);
  setFieldValue("media-multiplier", currentSettings.mediaPowerMultiplier);
  setFieldValue("data-multiplier", currentSettings.dataTransferMultiplier);
  toggleCustomPowerField();
  renderDomainOverrides();
}

function init() {
  chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (data) => {
    currentSettings = normalizeSettings(data.settings);
    renderSettings();
    bindControls();
  });
}

document.addEventListener("DOMContentLoaded", init);
