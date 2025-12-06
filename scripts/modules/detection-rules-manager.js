/**
 * Detection Rules Manager for Check
 * Handles remote fetching, caching, and management of detection rules
 */

import { chrome, storage } from "../browser-polyfill.js";
import logger from "../utils/logger.js";

export class DetectionRulesManager {
  constructor() {
    this.cachedRules = null;
    this.lastUpdate = 0;
    this.updateInterval = 24 * 60 * 60 * 1000; // Default: 24 hours
    this.cacheKey = "detection_rules_cache";
    this.fallbackUrl = chrome.runtime.getURL("rules/detection-rules.json");
    this.remoteUrl =
      "https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/rules/detection-rules.json";
    this.config = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Load configuration to get update interval and custom URL
      await this.loadConfiguration();

      // Load cached rules first
      await this.loadFromCache();

      // Check if we need to update
      const now = Date.now();
      if (now - this.lastUpdate > this.updateInterval) {
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
      // Load from chrome storage to get user configuration
      const result = await storage.local.get(["config"]);
      this.config = result?.config || {};

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

      if (cached && cached.rules && cached.lastUpdate) {
        // Check if cache is still valid
        const now = Date.now();
        const cacheAge = now - cached.lastUpdate;

        if (cacheAge < this.updateInterval) {
          this.cachedRules = cached.rules;
          this.lastUpdate = cached.lastUpdate;
          logger.log("Detection rules loaded from cache");
          return true;
        } else {
          logger.log("Cached detection rules expired, will fetch new ones");
        }
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

  async fetchDetectionRules() {
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
        logger.log("Successfully fetched detection rules from remote URL");

        // Save to cache
        await this.saveToCache(rules);
        return rules;
      } catch (error) {
        logger.warn("Failed to fetch rules from remote URL:", error.message);
      }
    }

    // Fallback to local rules
    try {
      logger.log("Falling back to local detection rules");
      const response = await fetch(this.fallbackUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      rules = await response.json();
      logger.log("Successfully loaded local detection rules");

      // Save to cache as fallback
      await this.saveToCache(rules);
      return rules;
    } catch (error) {
      logger.error("Failed to load local detection rules:", error.message);
      throw error;
    }
  }

  async updateDetectionRules() {
    try {
      const rules = await this.fetchDetectionRules();

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

  async getDetectionRules() {
    // Return cached rules if available and fresh
    if (this.cachedRules) {
      const now = Date.now();
      const cacheAge = now - this.lastUpdate;

      if (cacheAge < this.updateInterval) {
        return this.cachedRules;
      }
    }

    // Need to fetch fresh rules
    try {
      return await this.fetchDetectionRules();
    } catch (error) {
      // Return cached rules as last resort, even if expired
      if (this.cachedRules) {
        logger.warn("Using expired cached rules due to fetch failure");
        return this.cachedRules;
      }
      throw error;
    }
  }

  async forceUpdate() {
    logger.log("Forcing detection rules update");
    await this.reloadConfiguration();
    return await this.updateDetectionRules();
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
    };
  }
}
