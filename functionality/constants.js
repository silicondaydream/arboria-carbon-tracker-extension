const DEFAULT_SETTINGS = Object.freeze({
  trackingEnabled: true,
  retentionDays: 45,
  energyPerGB: 0.81,
  gridIntensity: 442,
  cacheFactor: 0.755,
  dataTransferFallbackGrams: 0.8,
  deviceProfile: "laptop",
  customDevicePowerW: null,
  mediaPowerMultiplier: 0.3,
  dataTransferMultiplier: 0.15,
  recentPagesLimit: 50,
  suggestionsEnabled: true,
  domainIntensity: {}
});

const DEVICE_PROFILES = Object.freeze({
  laptop: 30,
  desktop: 75,
  mobile: 5
});

function normalizeSettings(settings) {
  const merged = Object.assign({}, DEFAULT_SETTINGS, settings || {});
  if (!merged.domainIntensity || typeof merged.domainIntensity !== "object") {
    merged.domainIntensity = {};
  }
  return merged;
}

function getDevicePower(settings) {
  if (settings && Number.isFinite(settings.customDevicePowerW)) {
    return Math.max(1, Number(settings.customDevicePowerW));
  }
  return DEVICE_PROFILES[(settings && settings.deviceProfile) || "laptop"] || DEVICE_PROFILES.laptop;
}
