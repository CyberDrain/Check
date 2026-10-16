/**
 * Detection Rules Manager for Check
 * Handles remote fetching, caching, and management of detection rules
 */

import { chrome, storage } from "../browser-polyfill.js";
import logger from "../utils/logger.js";

// Top-level sections of a rules file. A downloaded file must contain at least
// one of them, so an error page or unrelated JSON response can't replace good
// rules.
const KNOWN_RULE_SECTIONS = [
  "trusted_login_patterns",
  "microsoft_domain_patterns",
  "exclusion_system",
  "legitimate_discussion_domains",
  "m365_detection_requirements",
  "blocking_rules",
  "allow_rules",
  "aad_detection_elements",
  "required_elements",
  "rules",
  "thresholds",
  "phishing_indicators",
  "legitimate_patterns",
  "suspicious_behaviors",
  "detection_settings",
  "detection_logic",
  "rogue_apps_detection",
  "domain_squatting",
];

// After a failed fetch, wait this long before trying again so an outage or
// rate limit doesn't cause a request on every page load.
// The failure time is persisted so the delay survives service worker restarts.
const FAILED_FETCH_RETRY_DELAY = 5 * 60 * 1000;
const FAILED_FETCH_KEY = "detection_rules_last_failed_fetch";

function isValidDetectionRules(rules) {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
    return false;
  }
  return KNOWN_RULE_SECTIONS.some((section) =>
    Object.prototype.hasOwnProperty.call(rules, section)
  );
}

export class DetectionRulesManager {
  constructor(configManager = null, onRulesUpdated = null) {
    this.cachedRules = null;
    this.lastUpdate = 0;
    this.updateInterval = 24 * 60 * 60 * 1000; // Default: 24 hours
    this.cacheKey = "detection_rules_cache";
    this.fallbackUrl = chrome.runtime.getURL("rules/detection-rules.json");
    this.remoteUrl =
      "https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/rules/detection-rules.json";
    this.config = null;
    this.configManager = configManager;
    this.initialized = false;
    this.onRulesUpdated = onRulesUpdated;
    this._refreshInFlight = null;
    this._usingFallback = false;
    this._lastFailedFetchAt = 0;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Load configuration to get update interval and custom URL
      await this.loadConfiguration();

      // Load cached rules first
      await this.loadFromCache();

      const stored = await storage.local
        .get([FAILED_FETCH_KEY])
        .catch(() => ({}));
      this._lastFailedFetchAt = stored?.[FAILED_FETCH_KEY] || 0;

      // Check if we need to update
      const now = Date.now();
      if (
        now - this.lastUpdate > this.updateInterval &&
        !this._isInFailureBackoff(now)
      ) {
        // Update in background
        this.updateDetectionRules().catch((error) => {
          logger.warn(
            "Failed to update detection rules in background:",
            error.message
          );
        });
      }

      this.initialized = true;
      logger.log("DetectionRulesManager initialized successfully");
    } catch (error) {
      logger.error(
        "Failed to initialize DetectionRulesManager:",
        error.message
      );
    }
  }

  async loadConfiguration() {
    try {
      // Use ConfigManager if available to get merged configuration (enterprise + local)
      if (this.configManager) {
        this.config = await this.configManager.getConfig();
      } else {
        // Fallback to direct storage access if ConfigManager is not available
        const result = await storage.local.get(["config"]);
        this.config = result?.config || {};
      }

      // Set remote URL from configuration or use default
      if (this.config.customRulesUrl) {
        this.remoteUrl = this.config.customRulesUrl;
      } else if (this.config.detectionRules?.customRulesUrl) {
        this.remoteUrl = this.config.detectionRules.customRulesUrl;
      }

      // Set update interval from configuration
      if (this.config.updateInterval) {
        this.updateInterval = this.config.updateInterval * 60 * 60 * 1000; // Convert hours to milliseconds
      } else if (this.config.detectionRules?.updateInterval) {
        this.updateInterval = this.config.detectionRules.updateInterval;
      }

      logger.log("DetectionRulesManager configuration loaded:", {
        remoteUrl: this.remoteUrl,
        updateInterval: this.updateInterval,
      });
    } catch (error) {
      logger.warn(
        "Failed to load configuration, using defaults:",
        error.message
      );
    }
  }

  async reloadConfiguration() {
    logger.log("DetectionRulesManager: Reloading configuration");
    await this.loadConfiguration();
  }

  async loadFromCache() {
    try {
      const result = await storage.local.get([this.cacheKey]);
      const cached = result?.[this.cacheKey];

      // The cache only holds rules from a successful remote fetch, so use it
      // even when it's past the update interval: it's the newest copy we
      // have. lastUpdate keeps its age, so a refresh is still triggered.
      if (cached && cached.lastUpdate && isValidDetectionRules(cached.rules)) {
        this.cachedRules = cached.rules;
        this.lastUpdate = cached.lastUpdate;
        this._usingFallback = false;
        logger.log("Detection rules loaded from cache");
        return true;
      }

      return false;
    } catch (error) {
      logger.warn("Failed to load detection rules from cache:", error.message);
      return false;
    }
  }

  async saveToCache(rules) {
    try {
      const cacheData = {
        rules: rules,
        lastUpdate: Date.now(),
        source: this.remoteUrl,
      };

      await storage.local.set({ [this.cacheKey]: cacheData });
      this.cachedRules = rules;
      this.lastUpdate = cacheData.lastUpdate;

      logger.log("Detection rules saved to cache");
    } catch (error) {
      logger.warn("Failed to save detection rules to cache:", error.message);
    }
  }

  /**
   * @param {object} [outcome] Receives `error` if the remote fetch failed and
   *   `usingBundled` if the bundled rules were returned, so a caller can tell
   *   how its own fetch went even if other fetches overlap with it.
   */
  async fetchDetectionRules(outcome = {}) {
    let rules = null;

    // Try to fetch from remote URL first
    if (this.remoteUrl && this.remoteUrl !== this.fallbackUrl) {
      try {
        logger.log("Fetching detection rules from remote URL:", this.remoteUrl);

        const response = await fetch(this.remoteUrl, {
          cache: "no-cache",
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        rules = await response.json();
        if (!isValidDetectionRules(rules)) {
          throw new Error("Response is not a valid detection rules file");
        }
        logger.log("Successfully fetched detection rules from remote URL");

        // Persist only successful remote fetches so the cache always reflects
        // the true remote state - never poisoned by bundled fallback content.
        this._usingFallback = false;
        if (this._lastFailedFetchAt) {
          await this._setLastFailedFetchAt(0);
        }
        await this.saveToCache(rules);
        return rules;
      } catch (error) {
        logger.warn("Failed to fetch rules from remote URL:", error.message);
        outcome.error = error.message;
        await this._setLastFailedFetchAt(Date.now());
      }

      // Keep the last successfully downloaded rules rather than falling back
      // to the bundled ones, which may be several releases older. lastUpdate
      // is left unchanged so the next refresh retries the remote URL.
      const hasDownloadedRules =
        (this.cachedRules && !this._usingFallback && this.lastUpdate > 0) ||
        (await this.loadFromCache());
      if (hasDownloadedRules) {
        logger.warn(
          "Keeping previously downloaded detection rules until the remote URL is reachable"
        );
        return this.cachedRules;
      }
    }

    // No previously downloaded rules (or no remote URL configured): serve the
    // bundled rules in-memory but DO NOT persist them. lastUpdate stays at 0 so
    // the next getDetectionRules() call treats the cache as stale and retries
    // the remote URL - the persistent cache remains a record of remote-only
    // state.
    try {
      logger.log(
        "Falling back to bundled detection rules (in-memory only; will retry remote on next refresh)"
      );
      const response = await fetch(this.fallbackUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      rules = await response.json();
      logger.log("Loaded bundled detection rules");

      this.cachedRules = rules;
      this.lastUpdate = 0; // Force next access to re-attempt the remote fetch
      this._usingFallback = true;
      outcome.usingBundled = true;
      return rules;
    } catch (error) {
      logger.error("Failed to load bundled detection rules:", error.message);
      throw error;
    }
  }

  async updateDetectionRules(outcome = {}) {
    try {
      const rules = await this.fetchDetectionRules(outcome);

      // Notify the background-script wiring so dependent subsystems (e.g. the
      // domain-squatting detector) can re-initialize with the new rules.
      if (typeof this.onRulesUpdated === "function") {
        try {
          await this.onRulesUpdated(rules);
        } catch (callbackError) {
          logger.warn(
            "onRulesUpdated callback threw:",
            callbackError?.message || callbackError
          );
        }
      }

      // Notify other parts of the extension that rules have been updated
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.sendMessage
      ) {
        chrome.runtime
          .sendMessage({
            type: "detection_rules_updated",
            timestamp: Date.now(),
          })
          .catch(() => {
            // Ignore errors if no listeners
          });
      }

      return rules;
    } catch (error) {
      logger.error("Failed to update detection rules:", error.message);
      throw error;
    }
  }

  /**
   * Kick off a non-blocking refresh of the detection rules. Used by
   * getDetectionRules() to trigger a background refresh whenever a page
   * detection requests rules and the cache is past the configured interval,
   * without making the requesting page wait for the network round-trip.
   * Guarded against overlapping in-flight refreshes.
   */
  _scheduleBackgroundRefresh(reason) {
    if (this._refreshInFlight) {
      return this._refreshInFlight;
    }
    logger.log(
      `Scheduling background detection-rules refresh (${reason || "expired"})`
    );
    this._refreshInFlight = this.updateDetectionRules()
      .catch((err) => {
        logger.warn(
          "Background detection-rules refresh failed:",
          err?.message || err
        );
      })
      .finally(() => {
        this._refreshInFlight = null;
      });
    return this._refreshInFlight;
  }

  async getDetectionRules() {
    const now = Date.now();

    // Fast path: in-memory cache exists from a previous successful fetch.
    if (this.cachedRules && this.lastUpdate > 0) {
      const cacheAge = now - this.lastUpdate;

      if (cacheAge < this.updateInterval) {
        // Fresh - return immediately, no network.
        return this.cachedRules;
      }

      // Cache is past the configured refresh interval. Return the (still usable)
      // cached rules immediately so page detection isn't blocked, and kick off
      // a non-blocking remote refresh whose result lands on the NEXT request.
      if (!this._isInFailureBackoff(now)) {
        this._scheduleBackgroundRefresh(
          `cache age ${Math.round(cacheAge / 60000)}m > interval ${Math.round(
            this.updateInterval / 60000
          )}m`
        );
      }
      return this.cachedRules;
    }

    // Running on bundled rules after a recent failure: don't block on another
    // network attempt until the retry delay has passed.
    if (this.cachedRules && this._isInFailureBackoff(now)) {
      return this.cachedRules;
    }

    // No usable cache yet (cold start or running on bundled fallback after a
    // remote failure). Block on a real fetch so callers don't get null.
    try {
      return await this.fetchDetectionRules();
    } catch (error) {
      if (this.cachedRules) {
        logger.warn("Using bundled cached rules due to fetch failure");
        return this.cachedRules;
      }
      throw error;
    }
  }

  _isInFailureBackoff(now) {
    const elapsed = now - this._lastFailedFetchAt;
    return (
      this._lastFailedFetchAt > 0 &&
      elapsed >= 0 &&
      elapsed < Math.min(FAILED_FETCH_RETRY_DELAY, this.updateInterval)
    );
  }

  async _setLastFailedFetchAt(timestamp) {
    this._lastFailedFetchAt = timestamp;
    try {
      if (timestamp) {
        await storage.local.set({ [FAILED_FETCH_KEY]: timestamp });
      } else {
        await storage.local.remove([FAILED_FETCH_KEY]);
      }
    } catch (error) {
      logger.warn("Failed to save detection rules retry state:", error.message);
    }
  }

  async forceUpdate() {
    logger.log("Forcing detection rules update");
    await this.reloadConfiguration();
    const outcome = {};
    const rules = await this.updateDetectionRules(outcome);

    // Report a failed download instead of claiming success. The previous
    // rules stay in use.
    if (outcome.error) {
      throw new Error(
        `Could not download detection rules (${outcome.error}). Still using ${
          outcome.usingBundled ? "the bundled rules" : "the previously downloaded rules"
        }.`
      );
    }
    return rules;
  }

  getCacheInfo() {
    return {
      hasCachedRules: !!this.cachedRules,
      lastUpdate: this.lastUpdate,
      cacheAge: this.lastUpdate ? Date.now() - this.lastUpdate : null,
      updateInterval: this.updateInterval,
      remoteUrl: this.remoteUrl,
      isExpired: this.lastUpdate
        ? Date.now() - this.lastUpdate > this.updateInterval
        : true,
      usingFallback: this._usingFallback,
      refreshInFlight: !!this._refreshInFlight,
    };
  }
}
