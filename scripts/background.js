/**
 * Check - Background Service Worker
 * Handles core extension functionality, policy enforcement, and threat detection
 * Enhanced with Check, CyberDrain's Microsoft 365 phishing detection
 */

// Import browser polyfill for cross-browser compatibility (Chrome/Firefox)
import { chrome, storage } from "./browser-polyfill.js";

import { ConfigManager } from "./modules/config-manager.js";
import { PolicyManager } from "./modules/policy-manager.js";
import { DetectionRulesManager } from "./modules/detection-rules-manager.js";
import { WebhookManager } from "./modules/webhook-manager.js";
import logger from "./utils/logger.js";
import { store as storeLog } from "./utils/background-logger.js";

console.log("Check: Background service worker loaded");
// Initialize logger with default settings before any components use it
logger.init({ level: "info", enabled: true });

// Top-level utility for "respond once" guard
const once = (fn) => {
  let called = false;
  return (...args) => {
    if (!called) {
      called = true;
      fn(...args);
    }
  };
};

// Safe wrapper for chrome.* and fetch operations
async function safe(promise) {
  try {
    return await promise;
  } catch (_) {
    return undefined;
  }
}

// Fetch with timeout and size limits for brand icon fetches
async function fetchWithTimeout(url, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Rogue Apps Manager - Dynamically fetches and manages known rogue OAuth applications
 */
class RogueAppsManager {
  constructor() {
    this.rogueApps = new Map(); // clientId -> app data
    this.lastUpdate = 0;
    this.updateInterval = 12 * 60 * 60 * 1000; // Default: 12 hours
    this.cacheKey = "rogue_apps_cache";
    this.initialized = false;
    this.config = null;

    // Default configuration (fallback if detection rules not available)
    this.defaultConfig = {
      enabled: true,
      source_url:
        "https://raw.githubusercontent.com/huntresslabs/rogueapps/refs/heads/main/public/rogueapps.json",
      cache_duration: 86400000, // 24 hours
      update_interval: 43200000, // 12 hours
      detection_action: "warn",
      severity: "high",
      auto_update: true,
      fallback_on_error: true,
    };
  }

  async loadConfiguration() {
    try {
      // Load detection rules to get rogue apps configuration
      const response = await fetch(
        chrome.runtime.getURL("rules/detection-rules.json")
      );
      const detectionRules = await response.json();

      this.config = detectionRules.rogue_apps_detection || this.defaultConfig;

      // Apply configuration
      this.sourceUrl = this.config.source_url;
      this.updateInterval = this.config.update_interval;
      this.cacheKey = "rogue_apps_cache";

      logger.log("RogueAppsManager configuration loaded:", {
        enabled: this.config.enabled,
        update_interval: this.config.update_interval,
        cache_duration: this.config.cache_duration,
        source_url: this.config.source_url,
      });

      return this.config;
    } catch (error) {
      logger.warn(
        "Failed to load rogue apps configuration, using defaults:",
        error.message
      );
      this.config = this.defaultConfig;
      this.sourceUrl = this.config.source_url;
      this.updateInterval = this.config.update_interval;
      return this.config;
    }
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Load configuration from detection rules first
      await this.loadConfiguration();

      // Check if rogue apps detection is disabled
      if (!this.config.enabled) {
        logger.log(
          "RogueAppsManager: Rogue apps detection is disabled in configuration"
        );
        this.initialized = true;
        return;
      }

      // Load cached data first
      await this.loadFromCache();

      // Check if we need to update
      const now = Date.now();
      if (now - this.lastUpdate > this.updateInterval) {
        // Update in background
        this.updateRogueApps().catch((error) => {
          logger.warn(
            "Failed to update rogue apps in background:",
            error.message
          );
        });
      }

      this.initialized = true;
      logger.log(
        `RogueAppsManager initialized with ${this.rogueApps.size} known rogue apps`
      );
    } catch (error) {
      logger.error("Failed to initialize RogueAppsManager:", error.message);
    }
  }

  async loadFromCache() {
    try {
      const result = await safe(storage.local.get([this.cacheKey]));
      const cached = result?.[this.cacheKey];

      if (cached && cached.apps && cached.lastUpdate) {
        // Check if cache is still valid based on configured cache duration
        const now = Date.now();
        const cacheAge = now - cached.lastUpdate;
        const cacheDuration =
          this.config?.cache_duration || this.defaultConfig.cache_duration;

        if (cacheAge > cacheDuration) {
          logger.log(
            `Rogue apps cache expired (age: ${Math.round(
              cacheAge / 1000 / 60
            )} minutes, max: ${Math.round(cacheDuration / 1000 / 60)} minutes)`
          );
          return; // Cache expired, don't load it
        }

        this.lastUpdate = cached.lastUpdate;
        this.rogueApps.clear();

        cached.apps.forEach((app) => {
          if (app.appId) {
            this.rogueApps.set(app.appId, app);
          }
        });

        logger.log(
          `Loaded ${
            this.rogueApps.size
          } rogue apps from cache (age: ${Math.round(
            cacheAge / 1000 / 60
          )} minutes)`
        );
      }
    } catch (error) {
      logger.warn("Failed to load rogue apps from cache:", error.message);
    }
  }

  async updateRogueApps() {
    try {
      logger.log("Fetching latest rogue apps from Huntress repository...");
      const response = await fetchWithTimeout(this.sourceUrl, 10000);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const apps = await response.json();

      if (!Array.isArray(apps)) {
        throw new Error("Invalid response format: expected array");
      }

      // Update local cache
      this.rogueApps.clear();
      apps.forEach((app) => {
        if (app.appId) {
          this.rogueApps.set(app.appId, app);
        }
      });

      this.lastUpdate = Date.now();

      // Save to storage
      await safe(
        storage.local.set({
          [this.cacheKey]: {
            apps: apps,
            lastUpdate: this.lastUpdate,
          },
        })
      );

      logger.log(
        `Updated rogue apps database: ${this.rogueApps.size} apps loaded`
      );
    } catch (error) {
      logger.error("Failed to update rogue apps:", error.message);
      throw error;
    }
  }

  checkClientId(clientId) {
    if (!clientId || !this.initialized) {
      return null;
    }

    const app = this.rogueApps.get(clientId);
    if (app) {
      return {
        isRogue: true,
        appName: app.appDisplayName,
        description: app.description,
        tags: app.tags || [],
        risk: this.calculateRiskLevel(app),
        references: app.references || [],
      };
    }

    return { isRogue: false };
  }

  calculateRiskLevel(app) {
    // Calculate risk based on permissions and tags
    const highRiskTags = ["BEC", "exfiltration", "phishing", "spam"];
    const mediumRiskTags = ["email", "backup", "collection"];

    if (app.tags && app.tags.some((tag) => highRiskTags.includes(tag))) {
      return "high";
    } else if (
      app.tags &&
      app.tags.some((tag) => mediumRiskTags.includes(tag))
    ) {
      return "medium";
    }

    return "low";
  }

  async forceUpdate() {
    try {
      await this.updateRogueApps();
      return { success: true, count: this.rogueApps.size };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

class CheckBackground {
  constructor() {
    this.configManager = new ConfigManager();
    this.policyManager = new PolicyManager();
    this.detectionRulesManager = new DetectionRulesManager();
    this.rogueAppsManager = new RogueAppsManager();
    this.webhookManager = new WebhookManager(this.configManager);
    this.isInitialized = false;
    this.initializationPromise = null;
    this.initializationRetries = 0;
    this.maxInitializationRetries = 3;
    this._retryScheduled = false;
    this._listenersReady = false;

    // CyberDrain integration
    this.policy = null;
    this.extraAllowlist = new Set();
    this.tabHeaders = new Map();
    this.HEADER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    this.MAX_HEADER_CACHE_ENTRIES = 100;

    // Error recovery
    this.lastError = null;
    this.errorCount = 0;
    this.maxErrors = 10;

    // Tab event management
    this.tabQueues = new Map(); // tabId -> Promise
    this.tabDebounce = new Map(); // tabId -> timeoutId

    // Storage batching
    this.pendingLocal = { accessLogs: [], securityEvents: [] };
    this.flushScheduled = false;

    // Profile information
    this.profileInfo = null;

    // Register core listeners that must work even if init fails
    this.setupCoreListeners();

    // Set up message handlers immediately to handle early connections
    // Reduce logging verbosity for service worker restarts
    if (!globalThis.checkBackgroundInstance) {
      logger.log("CheckBackground.constructor: registering message handlers");
    }
    this.setupMessageHandlers();
    if (!globalThis.checkBackgroundInstance) {
      logger.log("CheckBackground.constructor: message handlers registered");
    }
  }

  setupCoreListeners() {
    // Register alarm listeners even if init fails
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "check:init-retry") {
        this._retryScheduled = false;
        this.initialize().catch(() => {});
      } else if (alarm.name === "check:flush") {
        this.flushScheduled = false;
        this._doFlush().catch(() => {});
      }
    });
  }

  setupMessageHandlers() {
    // Handle messages from content scripts and popups with "respond once" guard
    chrome.runtime.onMessage.addListener((msg, sender, sendResponseRaw) => {
      const sendResponse = once(sendResponseRaw);
      (async () => {
        await this.handleMessage(msg, sender, sendResponse);
      })().catch((e) => {
        try {
          sendResponse({ success: false, error: e?.message || String(e) });
        } catch {}
      });
      return true; // Keep message channel open for async responses
    });
  }

  async initialize() {
    // Prevent duplicate initialization during service worker restarts
    if (this.isInitialized) {
      return;
    }

    // Harden initialization flow - prevent parallel retries
    if (this.initializationPromise || this._retryScheduled) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  async _doInitialize() {
    // Only log initialization start if this is the first instance
    const isFirstInstance = !globalThis.checkBackgroundInstance;
    if (isFirstInstance) {
      logger.log("CheckBackground.initialize: start");
    }

    try {
      // Load configuration and initialize logger based on settings
      const config = await this.configManager.loadConfig();
      logger.init({
        level: "info",
        enabled: true,
      });

      // Load policies
      await this.policyManager.loadPolicies();

      // Initialize detection rules manager
      await this.detectionRulesManager.initialize();

      await this.refreshPolicy();

      // Initialize rogue apps manager
      await this.rogueAppsManager.initialize();

      // Load profile information
      await this.loadProfileInformation();

      this.setupEventListeners();
      this.isInitialized = true;
      this.initializationRetries = 0; // Reset retry count on success
      this.errorCount = 0; // Reset error count on success

      if (isFirstInstance) {
        logger.log("CheckBackground.initialize: complete");
      }
    } catch (error) {
      logger.error("CheckBackground.initialize: error", error);
      this.lastError = error;
      this.initializationRetries++;

      // Reset promise to allow retry
      this.initializationPromise = null;

      // If we haven't exceeded max retries, schedule a retry
      if (this.initializationRetries < this.maxInitializationRetries) {
        logger.log(
          `CheckBackground.initialize: scheduling retry ${this.initializationRetries}/${this.maxInitializationRetries}`
        );
        // Replace setTimeout with chrome.alarms for service worker safety
        this._retryScheduled = true;
        chrome.alarms.create("check:init-retry", {
          when: Date.now() + 1000 * this.initializationRetries,
        });
      } else {
        logger.error(
          "CheckBackground.initialize: max retries exceeded, entering fallback mode"
        );
        this.enterFallbackMode();
      }

      throw error;
    }
  }

  enterFallbackMode() {
    // Set up minimal functionality when initialization fails
    this.isInitialized = false;
    this.config = this.configManager.getDefaultConfig();
    this.policy = this.getDefaultPolicy();

    logger.log(
      "CheckBackground: entering fallback mode with minimal functionality"
    );
  }

  getDefaultPolicy() {
    return {
      BrandingName: "CyberDrain Check Phishing Protection",
      BrandingImage: "",
      ExtraAllowlist: [],
      CIPPReportingServer: "",
      AlertWhenLogon: true,
      ValidPageBadgeImage: "",
      StrictResourceAudit: true,
      RequireMicrosoftAction: true,
      EnableValidPageBadge: false,
    };
  }

  // CyberDrain integration - Policy management with defensive refresh
  async refreshPolicy() {
    try {
      // Load policy from policy manager
      const policyData = await this.policyManager.getPolicies();
      this.policy = policyData || this.getDefaultPolicy();
      this.extraAllowlist = new Set(
        (this.policy?.ExtraAllowlist || [])
          .map((s) => this.urlOrigin(s))
          .filter(Boolean)
      );
      await this.applyBrandingToAction();
    } catch (error) {
      logger.error(
        "CheckBackground.refreshPolicy: failed, using defaults",
        error
      );
      this.policy = this.getDefaultPolicy();
      this.extraAllowlist = new Set();
    }
  }

  urlOrigin(u) {
    try {
      return new URL(u).origin.toLowerCase();
    } catch {
      return "";
    }
  }

  // CyberDrain integration - Verdict determination
  verdictForUrl(raw) {
    const origin = this.urlOrigin(raw);
    // Load trusted origins from policy or use defaults
    const trustedOrigins =
      this.policy?.trustedOrigins ||
      new Set([
        "https://login.microsoftonline.com",
        "https://login.microsoft.com",
        "https://account.microsoft.com",
      ]);
    if (trustedOrigins.has && trustedOrigins.has(origin)) return "trusted";
    if (this.extraAllowlist.has(origin)) return "trusted-extra";
    return "not-evaluated"; // Changed from "unknown" - don't show badge until we know it's relevant
  }

  // CyberDrain integration - Badge management with safe wrappers
  async setBadge(tabId, verdict) {
    const map = {
      trusted: { text: "MS", color: "#0a5" },
      "trusted-extra": { text: "OK", color: "#0a5" },
      phishy: { text: "!", color: "#d33" },
      "ms-login-unknown": { text: "?", color: "#f90" }, // Yellow/orange for MS login on unknown domain
      "rogue-app": { text: "⚠", color: "#f00" }, // Red for rogue OAuth apps (critical threat)
      "not-evaluated": { text: "", color: "#000" }, // No badge for irrelevant pages
    };
    const cfg = map[verdict] || map["not-evaluated"];

    // Log badge updates for debugging
    logger.log(
      `🏷️ Setting badge for tab ${tabId}: verdict="${verdict}" → text="${cfg.text}" color="${cfg.color}"`
    );

    await safe(chrome.action.setBadgeText({ tabId, text: cfg.text }));
    if (cfg.text) {
      // Only set background color if there's text to display
      await safe(
        chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color })
      );
    } else {
      // Clear badge entirely for non-relevant pages
      await safe(chrome.action.setBadgeText({ tabId, text: "" }));
    }
  }

  // CyberDrain integration - Notify tab to show valid badge with safe wrappers
  async showValidBadge(tabId) {
    const config = (await safe(this.configManager.getConfig())) || {};
    const enabled =
      this.policy?.EnableValidPageBadge || config?.enableValidPageBadge;
    if (enabled) {
      await safe(
        chrome.tabs.sendMessage(tabId, {
          type: "SHOW_VALID_BADGE",
          image: this.policy?.ValidPageBadgeImage,
          branding: this.policy?.BrandingName,
        })
      );
    }
  }

  // Send event to webhook (wrapper for webhookManager.sendWebhook)
  async sendEvent(eventData) {
    try {
      // Map event types to webhook types
      const eventTypeMap = {
        "trusted-login-page": this.webhookManager.webhookTypes.VALIDATION_EVENT,
        "phishy-detected": this.webhookManager.webhookTypes.THREAT_DETECTED,
        "page-blocked": this.webhookManager.webhookTypes.PAGE_BLOCKED,
        "rogue-app-detected": this.webhookManager.webhookTypes.ROGUE_APP,
        "detection-alert": this.webhookManager.webhookTypes.DETECTION_ALERT,
      };

      const webhookType = eventTypeMap[eventData.type];
      if (!webhookType) {
        logger.warn(`Unknown event type: ${eventData.type}`);
        return;
      }

      // Get metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        extensionVersion: chrome.runtime.getManifest().version,
        ...eventData.metadata,
      };

      // Send webhook
      await this.webhookManager.sendWebhook(webhookType, eventData, metadata);
    } catch (error) {
      // Log error but don't throw - webhook failures shouldn't break functionality
      logger.error(`Failed to send event ${eventData.type}:`, error);
    }
  }

  // CyberDrain integration - Remove valid badges from all tabs when setting is disabled
  async removeValidBadgesFromAllTabs() {
    try {
      logger.log("📋 BADGE CLEANUP: Removing valid badges from all tabs");

      // Get all tabs
      const tabs = (await safe(chrome.tabs.query({}))) || [];

      // Send remove message to each tab
      const removePromises = tabs.map(async (tab) => {
        if (tab.id) {
          try {
            await safe(
              chrome.tabs.sendMessage(tab.id, {
                type: "REMOVE_VALID_BADGE",
              })
            );
          } catch (error) {
            // Silently handle tabs that can't receive messages (e.g., chrome:// pages)
          }
        }
      });

      await Promise.allSettled(removePromises);
      logger.log(
        "📋 BADGE CLEANUP: Valid badge removal completed for all tabs"
      );
    } catch (error) {
      logger.warn(
        "Failed to remove valid badges from all tabs:",
        error.message
      );
    }
  }

  // CyberDrain integration - Apply branding to extension action with guards and timeouts
  async applyBrandingToAction() {
    try {
      // Get branding configuration from config manager
      const brandingConfig = await this.configManager.getFinalBrandingConfig();
      console.log(
        "Background: Loaded branding from config manager:",
        brandingConfig
      );

      // Determine title from branding config or policy fallback
      const title =
        brandingConfig.productName ||
        this.policy?.BrandingName ||
        this.getDefaultPolicy().BrandingName;

      // Title with safe wrapper
      await safe(chrome.action.setTitle({ title }));
      console.log("Extension title set to:", title);

      // Determine logo URL from branding config or policy fallback
      const logoUrl = brandingConfig.logoUrl || this.policy?.BrandingImage;

      // Icon (optional) with platform feature guards and size limits
      if (
        logoUrl &&
        globalThis.OffscreenCanvas &&
        globalThis.createImageBitmap
      ) {
        try {
          console.log("Loading custom extension icon from:", logoUrl);

          // Handle both relative and absolute URLs
          const iconUrl = logoUrl.startsWith("http")
            ? logoUrl
            : chrome.runtime.getURL(logoUrl);

          const img = await fetchWithTimeout(iconUrl);
          if (!img.ok) {
            console.warn("Failed to fetch custom icon:", img.status);
            return;
          }

          const blob = await img.blob();
          if (blob.size > 1_000_000) {
            console.warn("Custom icon too large, skipping");
            return; // Skip huge icons
          }

          const bmp = await createImageBitmap(blob);
          const sizes = [16, 32, 48, 128];
          const images = {};
          for (const s of sizes) {
            const canvas = new OffscreenCanvas(s, s);
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, s, s);
            ctx.drawImage(bmp, 0, 0, s, s);
            images[String(s)] = ctx.getImageData(0, 0, s, s);
          }
          await safe(chrome.action.setIcon({ imageData: images }));
          console.log("Custom extension icon applied successfully");
        } catch (e) {
          console.warn("Failed to apply custom icon:", e.message);
          // ignore icon errors, just set title
        }
      } else {
        console.log(
          "No custom logo configured or OffscreenCanvas not available"
        );
      }
    } catch (error) {
      console.error("Failed to apply branding to action:", error);
    }
  }

  setupEventListeners() {
    // Prevent duplicate listener registration
    if (this._listenersReady) return;
    this._listenersReady = true;

    // Handle extension installation/startup
    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });

    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    // Handle tab updates with debouncing and serialization
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.debouncePerTab(tabId, () => {
        this.enqueue(tabId, async () => {
          await this.handleTabUpdate(tabId, changeInfo, tab);
        });
      });
    });

    // CyberDrain integration - Handle tab activation for badge updates with safe wrappers
    chrome.tabs.onActivated.addListener(async ({ tabId }) => {
      const data = await safe(storage.session.get("verdict:" + tabId));
      const verdict = data?.["verdict:" + tabId]?.verdict || "not-evaluated";
      this.setBadge(tabId, verdict);
    });

    // Handle storage changes (for enterprise policy updates)
    storage.onChanged.addListener((changes, namespace) => {
      this.handleStorageChange(changes, namespace);
    });

    // Handle web navigation events with non-blocking heavy work
    chrome.webNavigation?.onCompleted?.addListener((details) => {
      if (details.frameId === 0) {
        // Log navigation for audit purposes
        queueMicrotask(() =>
          this.logUrlAccess(details.url, details.tabId).catch(() => {})
        );
      }
    });

    // Capture response headers with robust caching
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        if (details.tabId < 0 || !details.responseHeaders) return;

        try {
          // Prune before insert to prevent unbounded growth
          if (this.tabHeaders.size >= this.MAX_HEADER_CACHE_ENTRIES) {
            let oldestId = null;
            let oldestTs = Infinity;
            for (const [id, data] of this.tabHeaders) {
              if (data.ts < oldestTs) {
                oldestTs = data.ts;
                oldestId = id;
              }
            }
            if (oldestId !== null) this.tabHeaders.delete(oldestId);
          }

          const headers = {};
          for (const h of details.responseHeaders || []) {
            headers[h.name.toLowerCase()] = h.value;
          }
          this.tabHeaders.set(details.tabId, { headers, ts: Date.now() });
        } catch (error) {
          // Ignore header cache errors
        }
      },
      { urls: ["<all_urls>"], types: ["main_frame"] },
      ["responseHeaders"]
    );

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.tabHeaders.delete(tabId);
      this.tabQueues.delete(tabId);
      clearTimeout(this.tabDebounce.get(tabId));
      this.tabDebounce.delete(tabId);
    });
  }

  // Tab event management utilities
  enqueue(tabId, task) {
    const prev = this.tabQueues.get(tabId) || Promise.resolve();
    const next = prev.finally(task).catch(() => {}); // keep chain alive
    this.tabQueues.set(tabId, next);
  }

  debouncePerTab(tabId, fn, ms = 150) {
    clearTimeout(this.tabDebounce.get(tabId));
    const id = setTimeout(fn, ms);
    this.tabDebounce.set(tabId, id);
  }

  // Storage batching utilities with chrome.alarms for service worker safety
  scheduleFlush() {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    chrome.alarms.create("check:flush", { when: Date.now() + 2000 });
  }

  async _doFlush() {
    const cur =
      (await safe(
        storage.local.get(["accessLogs", "securityEvents"])
      )) || {};
    const access = (cur.accessLogs || [])
      .concat(this.pendingLocal.accessLogs)
      .slice(-1000);
    const sec = (cur.securityEvents || [])
      .concat(this.pendingLocal.securityEvents)
      .slice(-500);
    this.pendingLocal.accessLogs.length = 0;
    this.pendingLocal.securityEvents.length = 0;
    const payload = { accessLogs: access, securityEvents: sec };
    if (JSON.stringify(payload).length <= 4 * 1024 * 1024) {
      await safe(storage.local.set(payload));
    }
  }

  async handleStartup() {
    logger.log("Check: Extension startup detected");
    const config = (await safe(this.configManager.refreshConfig())) || {};
    logger.init({
      level: "info",
      enabled: true,
    });
  }

  async handleInstalled(details) {
    logger.log("Check: Extension installed/updated:", details.reason);

    if (details.reason === "install") {
      // Set default configuration
      await safe(this.configManager.setDefaultConfig());

      // Open options page for initial setup
      await safe(
        chrome.tabs.create({
          url: chrome.runtime.getURL("options/options.html"),
        })
      );
    } else if (details.reason === "update") {
      // Handle extension updates
      await safe(this.configManager.migrateConfig(details.previousVersion));
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    if (!this.isInitialized) return;

    try {
      // Ignore stale onUpdated payloads after debounce (tab might have navigated again)
      const latest = await safe(chrome.tabs.get(tabId));
      if (!latest || latest.url !== (tab?.url || changeInfo.url)) return; // stale event

      // CyberDrain integration - Handle URL changes and set badges
      if (changeInfo.status === "complete" && tab?.url) {
        const urlBasedVerdict = this.verdictForUrl(tab.url);

        // Check if there's already a more specific verdict (like rogue-app)
        const existingData = await safe(
          storage.session.get("verdict:" + tabId)
        );
        const existingVerdict = existingData?.["verdict:" + tabId]?.verdict;

        // Don't override specific verdicts (like rogue-app) with generic URL-based verdicts
        const shouldUpdateVerdict =
          !existingVerdict ||
          existingVerdict === "not-evaluated" ||
          (existingVerdict === "trusted" && urlBasedVerdict !== "trusted");

        if (shouldUpdateVerdict) {
          logger.log(
            `🔄 Updating verdict for tab ${tabId}: ${
              existingVerdict || "none"
            } → ${urlBasedVerdict}`
          );
          await safe(
            storage.session.set({
              ["verdict:" + tabId]: { verdict: urlBasedVerdict, url: tab.url },
            })
          );
          this.setBadge(tabId, urlBasedVerdict);
        } else {
          logger.log(
            `⏭️ Keeping existing verdict for tab ${tabId}: ${existingVerdict} (not overriding with ${urlBasedVerdict})`
          );
          // Keep existing verdict and badge
          this.setBadge(tabId, existingVerdict);
        }

        if (urlBasedVerdict === "trusted") {
          // "Valid page" sighting - fire-and-log pattern for non-critical work
          queueMicrotask(() =>
            this.sendEvent({ type: "trusted-login-page", url: tab.url }).catch(
              () => {}
            )
          );
          // DO NOT show valid badge automatically - let content script decide after rogue app analysis
          // queueMicrotask(() => this.showValidBadge(tabId).catch(() => {}));
        }
      }

      if (!changeInfo.url) return;

      // Simple URL analysis without DetectionEngine
      const shouldInjectContentScript = this.shouldInjectContentScript(
        changeInfo.url
      );

      if (shouldInjectContentScript) {
        await this.injectContentScript(tabId);
      }

      // Log URL access for audit purposes - fire-and-log pattern
      queueMicrotask(() => this.logUrlAccess(tab.url, tabId).catch(() => {}));
    } catch (error) {
      logger.error("Check: Error handling tab update:", error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      // Handle both message.type and message.action for compatibility
      const messageType = message.type || message.action;

      // Always return immediately for "ping" and non-critical queries
      if (messageType === "ping") {
        sendResponse({
          success: true,
          message: "Check background script is running",
          timestamp: new Date().toISOString(),
          initialized: this.isInitialized,
          fallbackMode: !this.isInitialized,
          errorCount: this.errorCount,
          lastError: this.lastError?.message || null,
        });
        return;
      }

      // Ensure initialization before handling most messages
      if (!this.isInitialized) {
        try {
          await this.initialize();
        } catch (error) {
          logger.warn(
            "CheckBackground.handleMessage: initialization failed, using fallback",
            error
          );
          // Continue with fallback mode
        }
      }

      switch (messageType) {
        // CyberDrain integration - Handle phishing detection
        case "FLAG_PHISHY":
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            await safe(
              storage.session.set({
                ["verdict:" + tabId]: {
                  verdict: "phishy",
                  url: sender.tab.url,
                },
              })
            );
            this.setBadge(tabId, "phishy");
            sendResponse({ ok: true });
            // Fire-and-log pattern for non-critical work
            queueMicrotask(() =>
              this.sendEvent({
                type: "phishy-detected",
                url: sender.tab.url,
                reason: message.reason || "heuristic",
              }).catch(() => {})
            );
          }
          break;

        case "FLAG_TRUSTED_BY_REFERRER":
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            await safe(
              storage.session.set({
                ["verdict:" + tabId]: {
                  verdict: "trusted",
                  url: sender.tab.url,
                  by: "referrer",
                },
              })
            );
            this.setBadge(tabId, "trusted");
            sendResponse({ ok: true });
            // Fire-and-log pattern for non-critical work
            queueMicrotask(() => this.showValidBadge(tabId).catch(() => {}));
            if (this.policy?.AlertWhenLogon) {
              queueMicrotask(() =>
                this.sendEvent({
                  type: "user-logged-on",
                  url: sender.tab.url,
                  by: "referrer",
                }).catch(() => {})
              );
            }
          }
          break;

        case "FLAG_MS_LOGIN_ON_UNKNOWN_DOMAIN":
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            await safe(
              storage.session.set({
                ["verdict:" + tabId]: {
                  verdict: "ms-login-unknown",
                  url: sender.tab.url,
                  origin: message.origin,
                  redirectTo: message.redirectTo,
                },
              })
            );
            this.setBadge(tabId, "ms-login-unknown");
            sendResponse({ ok: true });
            // Log Microsoft login detection on unknown domain
            queueMicrotask(() =>
              this.sendEvent({
                type: "ms-login-unknown-domain",
                url: sender.tab.url,
                origin: message.origin,
                redirectTo: message.redirectTo,
                reason: "Microsoft login page detected on non-trusted domain",
              }).catch(() => {})
            );
          }
          break;

        case "FLAG_ROGUE_APP":
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            logger.log(
              `🚨 FLAG_ROGUE_APP received for tab ${tabId}, updating badge to rogue-app`
            );

            await safe(
              storage.session.set({
                ["verdict:" + tabId]: {
                  verdict: "rogue-app",
                  url: sender.tab.url,
                  clientId: message.clientId,
                  appName: message.appName,
                  reason: message.reason,
                },
              })
            );
            this.setBadge(tabId, "rogue-app");
            sendResponse({ ok: true });
            // Log rogue app detection
            queueMicrotask(() =>
              this.sendEvent({
                type: "rogue-app-detected",
                url: sender.tab.url,
                clientId: message.clientId,
                appName: message.appName,
                reason: message.reason,
                severity: "critical",
              }).catch(() => {})
            );
          }
          break;

        case "UPDATE_VERDICT_TO_SAFE":
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            await safe(
              storage.session.set({
                ["verdict:" + tabId]: {
                  verdict: "safe",
                  url: sender.tab.url,
                  reason: message.reason,
                  analysis: message.analysis,
                  legitimacyScore: message.legitimacyScore,
                  threshold: message.threshold,
                },
              })
            );
            // Don't set badge for general "safe" sites - only trusted login domains get badges
            this.setBadge(tabId, "not-evaluated"); // Clear badge for non-login pages
            sendResponse({ ok: true });
            // Don't show valid badge for general safe sites - only for trusted login domains
          }
          break;

        case "REQUEST_POLICY":
          sendResponse({ policy: this.policy });
          break;

        case "GET_BRANDING_CONFIG":
          try {
            // Use config manager to get branding configuration
            const branding = await this.configManager.getFinalBrandingConfig();
            sendResponse({
              success: true,
              branding: branding,
            });
          } catch (error) {
            logger.error("Failed to get branding config:", error);
            sendResponse({
              success: false,
              error: error.message,
            });
          }
          break;

        case "REQUEST_SHOW_VALID_BADGE":
          if (sender.tab?.id) {
            queueMicrotask(() =>
              this.showValidBadge(sender.tab.id).catch(() => {})
            );
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: "No tab ID available" });
          }
          break;

        case "ANALYZE_CONTENT_WITH_RULES":
          // DetectionEngine removed - content analysis now handled by content script
          sendResponse({
            success: false,
            error: "Content analysis moved to content script",
          });
          break;

        case "log":
          if (message.level && message.message) {
            await storeLog(message.level, message.message);
          }
          sendResponse({ success: true });
          break;

        case "protection_event":
          // Handle protection events from content script
          try {
            if (message.data) {
              // Use existing logEvent method to ensure proper storage
              await this.logEvent(message.data, sender.tab?.id);
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: "No event data provided" });
            }
          } catch (error) {
            logger.error("Failed to handle protection event:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "GET_PAGE_HEADERS":
          try {
            const data =
              sender.tab?.id != null
                ? this.tabHeaders.get(sender.tab.id)
                : null;
            if (data && Date.now() - data.ts > this.HEADER_CACHE_TTL) {
              this.tabHeaders.delete(sender.tab.id);
              sendResponse({ success: true, headers: {} });
            } else {
              sendResponse({ success: true, headers: data?.headers || {} });
            }
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "GET_STORED_DEBUG_DATA":
          try {
            // Retrieve stored debug data from storage.local
            if (message.key) {
              console.log(
                "Background: Retrieving debug data for key:",
                message.key
              );
              const result = await storage.local.get([message.key]);
              const debugData = result[message.key];

              console.log("Background: Retrieved data:", debugData);

              if (debugData) {
                sendResponse({
                  success: true,
                  debugData: debugData,
                });
              } else {
                console.log("Background: No data found for key:", message.key);
                sendResponse({
                  success: false,
                  error: "No debug data found for key: " + message.key,
                });
              }
            } else {
              sendResponse({
                success: false,
                error: "No key provided for debug data retrieval",
              });
            }
          } catch (error) {
            logger.error("Failed to retrieve debug data:", error);
            sendResponse({
              success: false,
              error: error.message,
            });
          }
          break;

        case "testDetectionEngine":
          // DetectionEngine removed - return simple status
          sendResponse({
            success: true,
            message: "Detection engine functionality moved to content script",
            rulesLoaded: 0,
            engineInitialized: false,
            testsRun: 0,
          });
          break;

        case "testConfiguration":
          try {
            const configTest = {
              configModules: [],
              initialized: this.isInitialized,
            };

            if (this.configManager)
              configTest.configModules.push("ConfigManager");
            // DetectionEngine removed
            if (this.policyManager)
              configTest.configModules.push("PolicyManager");

            sendResponse({
              success: true,
              ...configTest,
            });
          } catch (error) {
            sendResponse({
              success: false,
              error: error.message,
            });
          }
          break;

        case "URL_ANALYSIS_REQUEST":
          // Get detection results from content script
          try {
            if (typeof message.url !== "string") {
              sendResponse({ success: false, error: "Invalid url" });
              return;
            }

            // Check if protection is enabled
            const config = await this.configManager.getConfig();
            const isProtectionEnabled = config?.enablePageBlocking !== false;

            // Try to get detection results from content script
            try {
              const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
              });
              if (tabs.length > 0) {
                const tabId = tabs[0].id;

                // Ask content script for its detection results
                const contentResponse = await chrome.tabs.sendMessage(tabId, {
                  type: "GET_DETECTION_RESULTS",
                });

                if (contentResponse && contentResponse.success) {
                  // Use content script's detection results
                  const analysis = {
                    url: message.url,
                    verdict:
                      contentResponse.verdict ||
                      this.verdictForUrl(message.url),
                    isBlocked: contentResponse.isBlocked || false,
                    isSuspicious: contentResponse.isSuspicious || false,
                    threats: contentResponse.threats || [],
                    reason:
                      contentResponse.reason || "Analysis from content script",
                    protectionEnabled: isProtectionEnabled,
                    timestamp: new Date().toISOString(),
                  };

                  sendResponse({ success: true, analysis });
                  return;
                }
              }
            } catch (contentError) {
              console.log(
                "Check: Content script not available, using basic analysis"
              );
            }

            // Fallback to basic analysis if content script not available
            const analysis = {
              url: message.url,
              verdict: this.verdictForUrl(message.url),
              isBlocked: false,
              isSuspicious: false,
              threats: [],
              reason: "Basic analysis - content script not available",
              protectionEnabled: isProtectionEnabled,
              timestamp: new Date().toISOString(),
            };

            sendResponse({ success: true, analysis });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "POLICY_CHECK":
          const policyResult = await this.policyManager.checkPolicy(
            message.action,
            message.context
          );
          sendResponse({
            success: true,
            allowed: policyResult.allowed,
            reason: policyResult.reason,
          });
          break;

        case "CONTENT_MANIPULATION_REQUEST":
          const manipulationAllowed =
            await this.policyManager.checkContentManipulation(message.domain);
          sendResponse({ success: true, allowed: manipulationAllowed });
          break;

        case "LOG_EVENT":
          // Validate event input
          if (!message.event || typeof message.event !== "object") {
            sendResponse({ success: false, error: "Invalid event" });
            return;
          }
          await this.logEvent(message.event, sender.tab?.id);
          sendResponse({ success: true });
          break;

        case "GET_CONFIG":
          try {
            const config = await this.configManager.getConfig();
            sendResponse({ success: true, config });
          } catch (error) {
            logger.error("Check: Failed to get config:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "GET_POLICIES":
          try {
            // Test managed storage directly
            const managedPolicies = await storage.managed.get(null);

            // Also get enterprise config from config manager
            const enterpriseConfig =
              await this.configManager.loadEnterpriseConfig();

            sendResponse({
              success: true,
              managedPolicies,
              enterpriseConfig,
              isManaged: Object.keys(managedPolicies).length > 0,
            });
          } catch (error) {
            logger.error("Check: Failed to get policies:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "GET_STATISTICS":
          try {
            const statistics = await this.getStatistics();
            sendResponse({ success: true, statistics });
          } catch (error) {
            logger.error("Check: Failed to get statistics:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "get_detection_rules":
          try {
            const rules = await this.detectionRulesManager.getDetectionRules();
            const cacheInfo = this.detectionRulesManager.getCacheInfo();
            sendResponse({ success: true, rules, cacheInfo });
          } catch (error) {
            logger.error("Check: Failed to get detection rules:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "force_update_detection_rules":
          try {
            const rules = await this.detectionRulesManager.forceUpdate();
            sendResponse({
              success: true,
              rules,
              message: "Detection rules updated",
            });
          } catch (error) {
            logger.error(
              "Check: Failed to force update detection rules:",
              error
            );
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "UPDATE_CONFIG":
          try {
            // Get the current config to compare badge settings
            const currentConfig = await this.configManager.getConfig();
            const previousBadgeEnabled =
              currentConfig?.enableValidPageBadge ||
              this.policy?.EnableValidPageBadge;

            // Update the configuration
            await this.configManager.updateConfig(message.config);

            // Reload DetectionRulesManager configuration to pick up customRulesUrl changes
            await this.detectionRulesManager.reloadConfiguration();

            // Get the updated config to check new badge setting
            const updatedConfig = await this.configManager.getConfig();
            const newBadgeEnabled =
              updatedConfig?.enableValidPageBadge ||
              this.policy?.EnableValidPageBadge;

            // If badge was disabled, remove badges from all tabs
            if (previousBadgeEnabled && !newBadgeEnabled) {
              logger.log(
                "📋 BADGE SETTING: Badge setting disabled, removing badges from all tabs"
              );
              await this.removeValidBadgesFromAllTabs();
            }

            sendResponse({ success: true });
          } catch (error) {
            logger.error("Check: Failed to update config:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "CONFIG_UPDATED":
          try {
            // Handle configuration updates from ConfigManager
            const currentConfig = await this.configManager.getConfig();
            const badgeEnabled =
              currentConfig?.enableValidPageBadge ||
              this.policy?.EnableValidPageBadge;

            // If badge setting is disabled, remove badges from all tabs
            if (!badgeEnabled) {
              await this.removeValidBadgesFromAllTabs();
            }

            sendResponse({ success: true });
          } catch (error) {
            logger.error("Check: Failed to handle config update:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "UPDATE_BRANDING":
          try {
            // Refresh config manager cache to pick up new branding from storage
            await this.configManager.refreshConfig();

            // Apply branding changes immediately
            await this.applyBrandingToAction();
            sendResponse({ success: true });
          } catch (error) {
            logger.error("Check: Failed to update branding:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "TEST_DETECTION_RULES":
          const testResults = await this.testDetectionRules(message.testData);
          sendResponse({ success: true, results: testResults });
          break;

        case "VALIDATE_DETECTION_ENGINE":
          // DetectionEngine removed - return simple status
          sendResponse({
            success: true,
            validation: {
              message: "Detection engine functionality moved to content script",
              engineInitialized: false,
              detectionEngineStatus: "removed",
            },
          });
          break;

        case "GET_PROFILE_INFO":
          try {
            const profileInfo = await this.getCurrentProfile();
            sendResponse({ success: true, profile: profileInfo });
          } catch (error) {
            logger.error("Check: Failed to get profile info:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "REFRESH_PROFILE_INFO":
          try {
            const profileInfo = await this.refreshProfileInformation();
            sendResponse({ success: true, profile: profileInfo });
          } catch (error) {
            logger.error("Check: Failed to refresh profile info:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "RUN_COMPREHENSIVE_TEST":
          const comprehensiveResults = await this.runComprehensiveTest();
          sendResponse({ success: true, tests: comprehensiveResults });
          break;

        case "CHECK_ROGUE_APP":
          try {
            if (!message.clientId) {
              sendResponse({ success: false, error: "No client ID provided" });
              return;
            }

            const result = this.rogueAppsManager.checkClientId(
              message.clientId
            );
            sendResponse({ success: true, ...result });
          } catch (error) {
            logger.error("Check: Failed to check rogue app:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "send_cipp_report":
          try {
            if (!message.payload) {
              sendResponse({ success: false, error: "No payload provided" });
              return;
            }

            await this.handleCippReport(message.payload);
            sendResponse({ success: true });
          } catch (error) {
            logger.error("Check: Failed to send CIPP report:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "send_webhook":
          try {
            if (!message.webhookType || !message.data) {
              sendResponse({ success: false, error: "Invalid webhook message" });
              return;
            }

            const userProfile = await this.getCurrentProfile();
            const config = await this.configManager.getConfig();

            const metadata = {
              config: config,
              userProfile: userProfile,
              extensionVersion: chrome.runtime.getManifest().version
            };

            const result = await this.webhookManager.sendWebhook(
              message.webhookType,
              message.data,
              metadata
            );

            sendResponse({ success: result.success, result: result });
          } catch (error) {
            logger.error("Check: Failed to send webhook:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      logger.error("Check: Error handling message:", error);
      this.errorCount++;

      // If we've had too many errors, try to reinitialize
      if (this.errorCount > this.maxErrors) {
        logger.warn(
          "CheckBackground: too many errors, attempting reinitialization"
        );
        this.errorCount = 0;
        this.isInitialized = false;
        this.initializationPromise = null;
        this.initialize().catch((err) => {
          logger.error("CheckBackground: reinitialization failed", err);
        });
      }

      sendResponse({ success: false, error: error.message });
    }
  }

  async handleStorageChange(changes, namespace) {
    if (namespace === "managed") {
      // Enterprise policy changes
      logger.log("Check: Enterprise policy updated");
      await safe(this.policyManager.loadPolicies());
      const config = (await safe(this.configManager.refreshConfig())) || {};
      logger.init({
        level: "info",
        enabled: true,
      });
      // CyberDrain integration - Refresh policy with defensive handling
      await this.refreshPolicy();
      // Reload DetectionRulesManager configuration to pick up policy changes
      await safe(this.detectionRulesManager.reloadConfiguration());
    }
  }

  async injectContentScript(tabId) {
    try {
      // Shield content script injection - check if tab exists
      const exists = await safe(chrome.tabs.get(tabId));
      if (!exists) return; // tab gone

      const url = exists?.url;
      if (!url) {
        logger.warn("Check: No URL for tab", tabId);
        return;
      }

      let protocol;
      try {
        protocol = new URL(url).protocol;
      } catch {
        logger.warn("Check: Invalid URL, skipping content script:", url);
        return;
      }

      const disallowed = [
        "chrome:",
        "edge:",
        "about:",
        "chrome-extension:",
        "moz-extension:",
        "devtools:",
      ];

      if (disallowed.includes(protocol)) {
        logger.warn(
          "Check: Skipping content script injection for disallowed URL:",
          url
        );
        return;
      }

      await safe(
        chrome.scripting.executeScript({
          target: { tabId },
          files: ["scripts/content.js"],
        })
      );
    } catch (error) {
      logger.error("Check: Failed to inject content script:", error);
    }
  }

  async logUrlAccess(url, tabId) {
    const config = (await safe(this.configManager.getConfig())) || {};
    // ONLY log normal page access if debug logging is explicitly enabled
    // Otherwise, only security events (blocked/warnings/threats) should be logged
    if (config.enableDebugLogging !== true) {
      return; // Skip all routine URL access logging in normal operation
    }
    // If debug logging is enabled, log all page access for debugging purposes
    const profileInfo = await this.getCurrentProfile();

    const logEntry = {
      timestamp: new Date().toISOString(),
      url,
      tabId,
      type: "url_access",
      event: {
        type: "page_scanned",
        url: url,
        threatDetected: false,
      },
      profile: this.sanitizeProfileForLogging(profileInfo),
    };

    // Use batched storage writes
    this.pendingLocal.accessLogs.push(logEntry);
    this.scheduleFlush();
  }

  async logEvent(event, tabId) {
    // Get configuration first to check debug logging
    const config = await safe(this.configManager.getConfig());

    // Only log legitimate_access events if debug logging is enabled
    // All other security events (threats, blocks, warnings) should always be logged
    if (event.type === "legitimate_access" && !config?.enableDebugLogging) {
      return; // Skip logging legitimate access in normal operation
    }

    // Get current profile information for logging context
    const profileInfo = await this.getCurrentProfile();

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: this.enhanceEventForLogging(event),
      tabId,
      type: "security_event",
      profile: this.sanitizeProfileForLogging(profileInfo),
    };

    // Gate noisy logs behind debug config
    if (config?.enableDebugLogging) {
      logger.log("Check: Security Event:", logEntry);
    }

    // Use batched storage writes
    this.pendingLocal.securityEvents.push(logEntry);
    this.scheduleFlush();

    // Send to CIPP if enabled using the correct method
    if (config?.enableCippReporting && config?.cippServerUrl) {
      try {
        await this.handleCippReport({
          type: logEntry.event.type,
          severity: logEntry.event.threatLevel || "medium",
          timestamp: logEntry.timestamp,
          url: logEntry.event.url,
          reason: logEntry.event.reason || "Security event logged",
          tabId: logEntry.tabId,
          event: logEntry.event,
          profile: logEntry.profile,
        });
      } catch (error) {
        logger.error("Failed to send event to CIPP:", error);
        // Don't fail the entire logging operation if CIPP is unavailable
      }
    }
  }

  enhanceEventForLogging(event) {
    const enhancedEvent = { ...event };

    // Define threat events that should have URLs defanged
    const threatEvents = new Set([
      "content_threat_detected",
      "threat_detected",
      "blocked_page_viewed",
      "threat_blocked",
      "threat_detected_no_action",
    ]);

    // Define legitimate events that should NEVER have URLs defanged
    const legitimateEvents = new Set([
      "legitimate_access",
      "url_access",
      "page_scanned",
      "trusted-login-page",
      "user-logged-on",
      "ms-login-unknown-domain",
    ]);

    // Only defang URLs for confirmed threat events
    const shouldDefangUrl =
      event.url &&
      threatEvents.has(event.type) &&
      !legitimateEvents.has(event.type);

    // Debug logging to track URL defanging decisions
    if (event.url) {
      console.log(
        `[URL Defanging] Event type: ${event.type}, shouldDefang: ${shouldDefangUrl}, URL: ${event.url}`
      );
    }

    if (shouldDefangUrl) {
      enhancedEvent.url = this.defangUrl(event.url);
      enhancedEvent.threatDetected = true;
    }

    // Add more context for different event types
    switch (event.type) {
      case "url_access":
        enhancedEvent.action = event.action || "allowed";
        enhancedEvent.threatLevel = event.threatLevel || "none";
        break;
      case "content_threat_detected":
        enhancedEvent.action = event.action || "blocked";
        enhancedEvent.threatLevel = event.threatLevel || "high";
        enhancedEvent.threatDetected = true;
        break;
      case "threat_detected":
        enhancedEvent.action = event.action || "blocked";
        enhancedEvent.threatLevel = event.threatLevel || "high";
        enhancedEvent.threatDetected = true;
        break;
      case "form_submission":
        enhancedEvent.action = event.action || "blocked";
        enhancedEvent.threatLevel = event.threatLevel || "medium";
        break;
      case "script_injection":
        enhancedEvent.action = event.action || "injected";
        enhancedEvent.threatLevel = event.threatLevel || "info";
        break;
      case "page_scanned":
        enhancedEvent.action = event.action || "scanned";
        enhancedEvent.threatLevel = event.threatLevel || "none";
        break;
      case "blocked_page_viewed":
        enhancedEvent.action = event.action || "viewed";
        enhancedEvent.threatLevel = event.threatLevel || "high";
        enhancedEvent.threatDetected = true;
        break;
      case "threat_blocked":
      case "threat_detected_no_action":
        enhancedEvent.action =
          event.type === "threat_blocked" ? "blocked" : "detected";
        enhancedEvent.threatLevel = event.severity || "high";
        enhancedEvent.threatDetected = true;
        break;
      case "legitimate_access":
        enhancedEvent.action = event.action || "allowed";
        enhancedEvent.threatLevel = event.threatLevel || "none";
        break;
      default:
        if (!enhancedEvent.action) enhancedEvent.action = "logged";
        if (!enhancedEvent.threatLevel) enhancedEvent.threatLevel = "info";
    }

    return enhancedEvent;
  }

  defangUrl(url) {
    try {
      // Check if URL is already defanged to prevent double defanging
      if (url.includes("[:]")) {
        return url; // Already defanged, return as-is
      }

      // Defang URLs by only replacing colons to prevent clickability while keeping readability
      return url.replace(/:/g, "[:]");
    } catch (e) {
      return url; // Return original if defanging fails
    }
  }

  // Detection Rules Testing Methods - simplified without DetectionEngine
  async testDetectionRules(testData = null) {
    const results = {
      timestamp: new Date().toISOString(),
      engineStatus: this.isInitialized,
      rulesLoaded: false, // DetectionEngine removed
      message: "Detection testing moved to content script",
      testResults: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
    };

    return results;
  }

  // Test methods removed - DetectionEngine functionality moved to content script
  async runComprehensiveTest() {
    return {
      timestamp: new Date().toISOString(),
      message: "Comprehensive testing moved to content script",
      testSuites: [],
    };
  }

  // Helper method for content script injection decision
  shouldInjectContentScript(url) {
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol;

      // Skip disallowed protocols
      const disallowed = [
        "chrome:",
        "edge:",
        "about:",
        "chrome-extension:",
        "moz-extension:",
        "devtools:",
      ];

      if (disallowed.includes(protocol)) {
        return false;
      }

      // Inject content script for all other URLs
      return true;
    } catch (error) {
      logger.warn("Check: Invalid URL for content script injection:", url);
      return false;
    }
  }

  validateComponents() {
    return {
      configManager: this.configManager ? "loaded" : "not_loaded",
      policyManager: this.policyManager ? "loaded" : "not_loaded",
      detectionRulesManager: this.detectionRulesManager
        ? "loaded"
        : "not_loaded",
      // DetectionEngine removed
    };
  }

  // Profile Information Management
  async loadProfileInformation() {
    try {
      this.profileInfo = {
        profileId: await this.getOrCreateProfileId(),
        isManaged: await this.checkManagedEnvironment(),
        userInfo: await this.getUserInfo(),
        browserInfo: await this.getBrowserInfo(),
        timestamp: new Date().toISOString(),
      };

      logger.log("Profile information loaded:", this.profileInfo);

      // Store profile info for access by other parts of the extension
      await storage.local.set({
        currentProfile: this.profileInfo,
      });
    } catch (error) {
      logger.error("Failed to load profile information:", error);
      this.profileInfo = {
        profileId: "unknown",
        isManaged: false,
        userInfo: null,
        browserInfo: null,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  async getOrCreateProfileId() {
    try {
      const result = await storage.local.get(["profileId"]);

      if (!result.profileId) {
        // Generate a unique identifier for this profile
        const profileId = crypto.randomUUID();
        await storage.local.set({ profileId });
        logger.log("Generated new profile ID:", profileId);
        return profileId;
      }

      logger.log("Using existing profile ID:", result.profileId);
      return result.profileId;
    } catch (error) {
      logger.error("Failed to get/create profile ID:", error);
      return "fallback-" + Date.now();
    }
  }

  async checkManagedEnvironment() {
    try {
      const policies = await storage.managed.get(null);
      const isManaged = policies && Object.keys(policies).length > 0;
      if (isManaged) {
        logger.log(
          "Detected managed environment with policies:",
          policies
        );
      }
      return isManaged;
    } catch (error) {
      logger.error("Error checking managed environment:", error);
      return false;
    }
  }

  async getUserInfo() {
    // Note: This requires "identity" and "identity.email" permissions
    // Works with Google accounts in Chrome and Microsoft accounts in Edge
    return new Promise((resolve) => {
      try {
        if (chrome.identity && chrome.identity.getProfileUserInfo) {
          chrome.identity.getProfileUserInfo(
            { accountStatus: "ANY" },
            (userInfo) => {
              if (chrome.runtime.lastError) {
                logger.log("Chrome identity error:", chrome.runtime.lastError);
                resolve(null);
              } else if (!userInfo) {
                logger.log("No user info returned from chrome.identity");
                resolve(null);
              } else if (!userInfo.email) {
                logger.log("User info available but no email:", userInfo);
                // Return what we have even without email
                resolve({
                  email: null,
                  id: userInfo.id || null,
                  emailNotAvailable: true,
                  reason: "User not signed in or email permission not granted",
                });
              } else {
                // Detect account type based on email domain
                const email = userInfo.email;
                let accountType = "personal";
                let provider = "unknown";

                if (email.includes("@")) {
                  const domain = email.split("@")[1].toLowerCase();
                  if (
                    domain.includes("outlook.com") ||
                    domain.includes("hotmail.com") ||
                    domain.includes("live.com")
                  ) {
                    accountType = "microsoft-personal";
                    provider = "microsoft";
                  } else if (
                    domain.includes("gmail.com") ||
                    domain.includes("googlemail.com")
                  ) {
                    accountType = "google-personal";
                    provider = "google";
                  } else {
                    accountType = "work-school";
                    provider = domain.includes(".onmicrosoft.com")
                      ? "microsoft"
                      : "unknown";
                  }
                }

                logger.log("User info retrieved successfully:", {
                  email: userInfo.email,
                  id: userInfo.id,
                  accountType: accountType,
                  provider: provider,
                });

                resolve({
                  email: userInfo.email,
                  id: userInfo.id,
                  accountType: accountType,
                  provider: provider,
                });
              }
            }
          );
        } else {
          logger.log("chrome.identity API not available");
          resolve(null);
        }
      } catch (error) {
        logger.error("Error getting user info:", error);
        resolve(null);
      }
    });
  }

  async getBrowserInfo() {
    try {
      const userAgent = navigator.userAgent;

      // Detect specific Chromium variant
      let browserType = "chrome"; // default
      let browserVersion = "unknown";

      if (userAgent.includes("Edg/")) {
        browserType = "edge";
        const edgeMatch = userAgent.match(/Edg\/([\d.]+)/);
        browserVersion = edgeMatch ? edgeMatch[1] : "unknown";
      } else if (userAgent.includes("Chrome/")) {
        browserType = "chrome";
        const chromeMatch = userAgent.match(/Chrome\/([\d.]+)/);
        browserVersion = chromeMatch ? chromeMatch[1] : "unknown";
      } else if (userAgent.includes("Chromium/")) {
        browserType = "chromium";
        const chromiumMatch = userAgent.match(/Chromium\/([\d.]+)/);
        browserVersion = chromiumMatch ? chromiumMatch[1] : "unknown";
      }

      const info = {
        userAgent: userAgent,
        browserType: browserType,
        browserVersion: browserVersion,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        extensionId: chrome.runtime.id,
        timestamp: new Date().toISOString(),
      };

      // Get extension installation info if management permission available
      if (chrome.management && chrome.management.getSelf) {
        const extensionInfo = await new Promise((resolve) => {
          chrome.management.getSelf((info) => {
            if (chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(info);
            }
          });
        });

        if (extensionInfo) {
          info.installType = extensionInfo.installType; // "normal", "development", "sideload", etc.
          info.enabled = extensionInfo.enabled;
          info.version = extensionInfo.version;
        }
      }

      return info;
    } catch (error) {
      logger.error("Error getting browser info:", error);
      return {
        extensionId: chrome.runtime.id,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  // Get current profile info for other parts of the extension
  async getCurrentProfile() {
    if (!this.profileInfo) {
      await this.loadProfileInformation();
    }
    return this.profileInfo;
  }

  // Refresh profile information (useful for periodic updates)
  async refreshProfileInformation() {
    logger.log("Refreshing profile information");
    await this.loadProfileInformation();
    return this.profileInfo;
  }

  // Prepare profile information for logging (keep email for CIPP actionability)
  sanitizeProfileForLogging(profileInfo) {
    if (!profileInfo) return null;

    const userInfo = profileInfo.userInfo
      ? {
          // Keep actual email for CIPP reporting - needed for actionable intelligence
          email: profileInfo.userInfo.email,
          id: profileInfo.userInfo.id,
          // Include account type and provider info for better analytics
          accountType: profileInfo.userInfo.accountType || "unknown",
          provider: profileInfo.userInfo.provider || "unknown",
          // Include additional info if available
          emailNotAvailable: profileInfo.userInfo.emailNotAvailable || false,
          reason: profileInfo.userInfo.reason || null,
        }
      : null;

    return {
      profileId: profileInfo.profileId,
      isManaged: profileInfo.isManaged,
      userInfo: userInfo,
      browserInfo: {
        browserType: profileInfo.browserInfo?.browserType,
        browserVersion: profileInfo.browserInfo?.browserVersion,
        platform: profileInfo.browserInfo?.platform,
        language: profileInfo.browserInfo?.language,
        installType: profileInfo.browserInfo?.installType,
        version: profileInfo.browserInfo?.version,
        extensionId: profileInfo.browserInfo?.extensionId,
        // Exclude userAgent as it's too detailed for logging
      },
      timestamp: profileInfo.timestamp,
    };
  }

  // Handle CIPP reports from content script
  async handleCippReport(basePayload) {
    try {
      const config = await this.configManager.getConfig();

      if (!config?.enableCippReporting || !config?.cippServerUrl) {
        logger.debug("CIPP reporting disabled or no server URL configured");
        return;
      }

      const userProfile = await this.getCurrentProfile();

      const metadata = {
        config: config,
        userProfile: userProfile,
        extensionVersion: chrome.runtime.getManifest().version,
        isPrivateIP: this.webhookManager.isPrivateIP(basePayload.redirectTo)
      };

      const result = await this.webhookManager.sendWebhook(
        this.webhookManager.webhookTypes.DETECTION_ALERT,
        basePayload,
        metadata
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to send webhook");
      }

      logger.log("✅ Detection alert webhook sent successfully");
    } catch (error) {
      logger.error("Failed to send detection alert webhook:", error);
      throw error;
    }
  }

  // Map severity levels to standardized CIPP severity scale
  mapSeverityLevel(severity) {
    const severityMap = {
      critical: "CRITICAL",
      high: "HIGH",
      medium: "MEDIUM",
      low: "LOW",
      info: "INFORMATIONAL",
    };
    return severityMap[severity?.toLowerCase()] || "MEDIUM";
  }

  // Categorize security events for better CIPP analytics
  categorizeSecurityEvent(payload) {
    const type = payload.type?.toLowerCase() || "";

    if (
      type.includes("rogue_app") ||
      payload.ruleType === "rogue_app_detection"
    ) {
      return "OAUTH_THREAT";
    }
    if (type.includes("phishing") || type.includes("blocked")) {
      return "PHISHING_ATTEMPT";
    }
    if (type.includes("suspicious")) {
      return "SUSPICIOUS_ACTIVITY";
    }
    if (type.includes("microsoft_logon")) {
      return "LEGITIMATE_ACCESS";
    }

    return "SECURITY_EVENT";
  }

  // Check if redirect host is a private IP (additional context for OAuth attacks)
  isPrivateIP(host) {
    if (!host) return false;

    // Common private IP patterns and localhost variants
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^::1$/,
      /^fe80:/i,
    ];

    return privatePatterns.some((pattern) => pattern.test(host));
  }

  async validateConfiguration() {
    const config = await this.configManager.getConfig();
    return {
      configLoaded: !!config,
      // Simplified validation without DetectionEngine
      basicValidation: true,
    };
  }

  // Get aggregated statistics for popup display
  async getStatistics() {
    try {
      // Safe wrapper for chrome storage operations
      const safe = async (promise) => {
        try {
          return await promise;
        } catch (_) {
          return {};
        }
      };

      // Get all logs from storage
      const result = await safe(
        storage.local.get(["securityEvents", "accessLogs", "debugLogs"])
      );

      const securityEvents = result?.securityEvents || [];
      const accessLogs = result?.accessLogs || [];
      const debugLogs = result?.debugLogs || [];

      // Calculate statistics from logged events
      let blockedThreats = 0;
      let scannedPages = 0;
      let securityEventsCount = 0;

      // Count blocked threats from security events
      securityEvents.forEach((entry) => {
        const event = entry.event;
        if (!event) return;

        // Count as security event
        securityEventsCount++;

        // Count blocked threats (various types of blocking/threat detection)
        if (
          event.type === "threat_blocked" ||
          event.type === "threat_detected" ||
          event.type === "content_threat_detected" ||
          (event.action && event.action.includes("blocked")) ||
          (event.threatLevel &&
            ["high", "critical"].includes(event.threatLevel))
        ) {
          blockedThreats++;
        }
      });

      // Count scanned pages from access logs and legitimate access events
      accessLogs.forEach((entry) => {
        const event = entry.event;
        if (event && event.type === "page_scanned") {
          scannedPages++;
        }
      });

      // Also count legitimate access events as scanned pages
      securityEvents.forEach((entry) => {
        const event = entry.event;
        if (event && event.type === "legitimate_access") {
          scannedPages++;
        }
      });

      // Return aggregated statistics
      const statistics = {
        blockedThreats: blockedThreats,
        scannedPages: scannedPages,
        securityEvents: securityEventsCount,
        lastUpdated: new Date().toISOString(),
      };

      logger.log("Calculated statistics:", statistics);
      return statistics;
    } catch (error) {
      logger.error("Failed to calculate statistics:", error);
      // Return default statistics on error
      return {
        blockedThreats: 0,
        scannedPages: 0,
        securityEvents: 0,
        lastUpdated: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}

// Initialize the background service worker with singleton pattern
if (!globalThis.checkBackgroundInstance) {
  globalThis.checkBackgroundInstance = new CheckBackground();
  globalThis.checkBackgroundInstance.initialize().catch((error) => {
    console.error("Failed to initialize CheckBackground:", error);
  });
} else {
  // Service worker restarted, ensure existing instance is initialized
  globalThis.checkBackgroundInstance.initialize().catch((error) => {
    console.error("Failed to re-initialize CheckBackground:", error);
  });
}

const check = globalThis.checkBackgroundInstance;

// Export for testing purposes
if (typeof module !== "undefined" && module.exports) {
  module.exports = CheckBackground;
}
