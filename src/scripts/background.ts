import { ConfigManager } from '../modules/config-manager';
import { PolicyManager } from '../modules/policy-manager';
import { DetectionRulesManager } from '../modules/detection-rules-manager';
import logger from '../utils/logger';
import { store as storeLog } from '../utils/background-logger';
import type { RogueApp } from '../../types/detection';

declare global {
  var checkBackgroundInstance: CheckBackground;
}

console.log('Check: Background service worker loaded');
logger.init({ level: 'info', enabled: true });

// Top-level utility for "respond once" guard
const once = (fn: (...args: any[]) => void) => {
  let called = false;
  return (...args: any[]) => {
    if (!called) {
      called = true;
      fn(...args);
    }
  };
};

// Safe wrapper for chrome.* and fetch operations
async function safe<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}

// Fetch with timeout and size limits for brand icon fetches
async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
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
  private rogueApps = new Map<string, RogueApp>();
  private lastUpdate = 0;
  private updateInterval = 12 * 60 * 60 * 1000; // Default: 12 hours
  private readonly cacheKey = 'rogue_apps_cache';
  private initialized = false;
  private config: any = null;
  private sourceUrl = '';

  // Default configuration (fallback if detection rules not available)
  private defaultConfig = {
    enabled: true,
    source_url: 'https://raw.githubusercontent.com/huntresslabs/rogueapps/refs/heads/main/public/rogueapps.json',
    cache_duration: 86400000, // 24 hours
    update_interval: 43200000, // 12 hours
    detection_action: 'warn',
    severity: 'high',
    auto_update: true,
    fallback_on_error: true,
  };

  async loadConfiguration(): Promise<any> {
    try {
      const response = await fetch(chrome.runtime.getURL('rules/detection-rules.json'));
      const detectionRules = await response.json();
      this.config = detectionRules.rogue_apps_detection || this.defaultConfig;
      this.sourceUrl = this.config.source_url;
      this.updateInterval = this.config.update_interval;
      
      logger.log('RogueAppsManager configuration loaded:', {
        enabled: this.config.enabled,
        update_interval: this.config.update_interval,
        cache_duration: this.config.cache_duration,
        source_url: this.config.source_url,
      });
      
      return this.config;
    } catch (error) {
      logger.warn('Failed to load rogue apps configuration, using defaults:', error instanceof Error ? error.message : String(error));
      this.config = this.defaultConfig;
      this.sourceUrl = this.config.source_url;
      this.updateInterval = this.config.update_interval;
      return this.config;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadConfiguration();

      if (!this.config.enabled) {
        logger.log('RogueAppsManager: Rogue apps detection is disabled in configuration');
        this.initialized = true;
        return;
      }

      await this.loadFromCache();

      const now = Date.now();
      if (now - this.lastUpdate > this.updateInterval) {
        this.updateRogueApps().catch((error) => {
          logger.warn('Failed to update rogue apps in background:', error instanceof Error ? error.message : String(error));
        });
      }

      this.initialized = true;
      logger.log(`RogueAppsManager initialized with ${this.rogueApps.size} known rogue apps`);
    } catch (error) {
      logger.error('Failed to initialize RogueAppsManager:', error instanceof Error ? error.message : String(error));
    }
  }

  async loadFromCache(): Promise<void> {
    try {
      const result = await safe(chrome.storage.local.get([this.cacheKey]));
      const cached = result?.[this.cacheKey];

      if (cached?.apps && cached.lastUpdate) {
        const now = Date.now();
        const cacheAge = now - cached.lastUpdate;
        const cacheDuration = this.config?.cache_duration || this.defaultConfig.cache_duration;

        if (cacheAge > cacheDuration) {
          logger.log(`Rogue apps cache expired (age: ${Math.round(cacheAge / 1000 / 60)} minutes, max: ${Math.round(cacheDuration / 1000 / 60)} minutes)`);
          return;
        }

        this.lastUpdate = cached.lastUpdate;
        this.rogueApps.clear();

        cached.apps.forEach((app: RogueApp) => {
          if (app.appId) {
            this.rogueApps.set(app.appId, app);
          }
        });

        logger.log(`Loaded ${this.rogueApps.size} rogue apps from cache (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
      }
    } catch (error) {
      logger.warn('Failed to load rogue apps from cache:', error instanceof Error ? error.message : String(error));
    }
  }

  async updateRogueApps(): Promise<void> {
    try {
      logger.log('Fetching latest rogue apps from Huntress repository...');
      const response = await fetchWithTimeout(this.sourceUrl, 10000);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const apps = await response.json();

      if (!Array.isArray(apps)) {
        throw new Error('Invalid response format: expected array');
      }

      this.rogueApps.clear();
      apps.forEach((app: RogueApp) => {
        if (app.appId) {
          this.rogueApps.set(app.appId, app);
        }
      });

      this.lastUpdate = Date.now();

      await safe(chrome.storage.local.set({
        [this.cacheKey]: {
          apps: apps,
          lastUpdate: this.lastUpdate,
        },
      }));

      logger.log(`Updated rogue apps database: ${this.rogueApps.size} apps loaded`);
    } catch (error) {
      logger.error('Failed to update rogue apps:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  checkClientId(clientId: string): any {
    if (!clientId || !this.initialized) {
      return null;
    }

    const app = this.rogueApps.get(clientId);
    if (app) {
      return {
        isRogue: true,
        appName: app.displayName,
        description: app.description,
        tags: app.severity ? [app.severity] : [],
        risk: this.calculateRiskLevel(app),
        references: [],
      };
    }

    return { isRogue: false };
  }

  calculateRiskLevel(app: RogueApp): string {
    if (app.severity === 'critical' || app.severity === 'high') {
      return 'high';
    } else if (app.severity === 'medium') {
      return 'medium';
    }
    return 'low';
  }

  async forceUpdate(): Promise<any> {
    try {
      await this.updateRogueApps();
      return { success: true, count: this.rogueApps.size };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

class CheckBackground {
  private configManager = new ConfigManager();
  private policyManager = new PolicyManager();
  private detectionRulesManager = new DetectionRulesManager();
  private rogueAppsManager = new RogueAppsManager();
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private initializationRetries = 0;
  private maxInitializationRetries = 3;
  private _retryScheduled = false;
  private _listenersReady = false;

  // CyberDrain integration
  private policy: any = null;
  private extraWhitelist = new Set<string>();
  private tabHeaders = new Map();
  private HEADER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private MAX_HEADER_CACHE_ENTRIES = 100;

  // Error recovery
  private lastError: any = null;
  private errorCount = 0;
  private maxErrors = 10;

  // Tab event management
  private tabQueues = new Map();
  private tabDebounce = new Map();

  // Storage batching
  private pendingLocal = { accessLogs: [] as any[], securityEvents: [] as any[] };
  private flushScheduled = false;

  // Profile information
  private profileInfo: any = null;

  constructor() {
    this.setupCoreListeners();
    
    if (!globalThis.checkBackgroundInstance) {
      logger.log('CheckBackground.constructor: registering message handlers');
    }
    this.setupMessageHandlers();
    if (!globalThis.checkBackgroundInstance) {
      logger.log('CheckBackground.constructor: message handlers registered');
    }
  }

  setupCoreListeners(): void {
    // Register alarm listeners even if init fails
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'check:init-retry') {
        this._retryScheduled = false;
        this.initialize().catch(() => {});
      } else if (alarm.name === 'check:flush') {
        this.flushScheduled = false;
        this._doFlush().catch(() => {});
      }
    });
  }

  setupMessageHandlers(): void {
    // Handle messages from content scripts and popups with "respond once" guard
    chrome.runtime.onMessage.addListener((msg: any, sender, sendResponseRaw) => {
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

  async initialize(): Promise<void> {
    // Prevent duplicate initialization during service worker restarts
    if (this.isInitialized) {
      return;
    }

    // Harden initialization flow - prevent parallel retries
    if (this.initializationPromise || this._retryScheduled) {
      return this.initializationPromise || Promise.resolve();
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  async _doInitialize(): Promise<void> {
    const isFirstInstance = !globalThis.checkBackgroundInstance;
    if (isFirstInstance) {
      logger.log('CheckBackground.initialize: start');
    }

    try {
      // Load configuration and initialize logger based on settings
      const config = await this.configManager.loadConfig();
      logger.init({
        level: 'info',
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
        logger.log('CheckBackground.initialize: complete');
      }
    } catch (error) {
      logger.error('CheckBackground.initialize: error', error);
      this.lastError = error;
      this.initializationRetries++;

      // Reset promise to allow retry
      this.initializationPromise = null;

      // If we haven't exceeded max retries, schedule a retry
      if (this.initializationRetries < this.maxInitializationRetries) {
        logger.log(`CheckBackground.initialize: scheduling retry ${this.initializationRetries}/${this.maxInitializationRetries}`);
        this._retryScheduled = true;
        chrome.alarms.create('check:init-retry', {
          when: Date.now() + 1000 * this.initializationRetries,
        });
      } else {
        logger.error('CheckBackground.initialize: max retries exceeded, entering fallback mode');
        this.enterFallbackMode();
      }

      throw error;
    }
  }

  enterFallbackMode(): void {
    this.isInitialized = false;
    this.policy = this.getDefaultPolicy();
    logger.log('CheckBackground: entering fallback mode with minimal functionality');
  }

  getDefaultPolicy(): any {
    return {
      BrandingName: 'CyberDrain Check Phishing Protection',
      BrandingImage: '',
      ExtraWhitelist: [],
      CIPPReportingServer: '',
      AlertWhenLogon: true,
      ValidPageBadgeImage: '',
      StrictResourceAudit: true,
      RequireMicrosoftAction: true,
      EnableValidPageBadge: false,
    };
  }

  // CyberDrain integration - Policy management with defensive refresh
  async refreshPolicy(): Promise<void> {
    try {
      // Load policy from policy manager
      const policyData = await this.policyManager.getPolicies();
      this.policy = policyData || this.getDefaultPolicy();
      this.extraWhitelist = new Set(
        (this.policy?.ExtraWhitelist || [])
          .map((s: string) => this.urlOrigin(s))
          .filter(Boolean)
      );
      await this.applyBrandingToAction();
    } catch (error) {
      logger.error('CheckBackground.refreshPolicy: failed, using defaults', error);
      this.policy = this.getDefaultPolicy();
      this.extraWhitelist = new Set();
    }
  }

  urlOrigin(u: string): string {
    try {
      return new URL(u).origin.toLowerCase();
    } catch {
      return '';
    }
  }

  // CyberDrain integration - Verdict determination
  verdictForUrl(raw: string): string {
    const origin = this.urlOrigin(raw);
    // Load trusted origins from policy or use defaults
    const trustedOrigins = this.policy?.trustedOrigins || new Set([
      'https://login.microsoftonline.com',
      'https://login.microsoft.com',
      'https://account.microsoft.com',
    ]);
    if (trustedOrigins.has && trustedOrigins.has(origin)) return 'trusted';
    if (this.extraWhitelist.has(origin)) return 'trusted-extra';
    return 'not-evaluated';
  }

  // CyberDrain integration - Badge management with safe wrappers
  async setBadge(tabId: number, verdict: string): Promise<void> {
    const map: Record<string, { text: string; color: string }> = {
      trusted: { text: 'MS', color: '#0a5' },
      'trusted-extra': { text: 'OK', color: '#0a5' },
      phishy: { text: '!', color: '#d33' },
      'ms-login-unknown': { text: '?', color: '#f90' },
      'rogue-app': { text: '⚠', color: '#f00' },
      'not-evaluated': { text: '', color: '#000' },
    };
    const cfg = map[verdict] || map['not-evaluated']!;

    logger.log(`🏷️ Setting badge for tab ${tabId}: verdict="${verdict}" → text="${cfg.text}" color="${cfg.color}"`);

    await safe(chrome.action.setBadgeText({ tabId, text: cfg.text }));
    if (cfg.text) {
      await safe(chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color }));
    } else {
      await safe(chrome.action.setBadgeText({ tabId, text: '' }));
    }
  }

  // CyberDrain integration - Notify tab to show valid badge with safe wrappers
  async showValidBadge(tabId: number): Promise<void> {
    const config = (await safe(this.configManager.getConfig())) || {};
    const enabled = this.policy?.EnableValidPageBadge || config?.enableValidPageBadge;
    if (enabled) {
      await safe(chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_VALID_BADGE',
        image: this.policy?.ValidPageBadgeImage,
        branding: this.policy?.BrandingName,
      }));
    }
  }

  // CyberDrain integration - Remove valid badges from all tabs when setting is disabled
  async removeValidBadgesFromAllTabs(): Promise<void> {
    try {
      logger.log('📋 BADGE CLEANUP: Removing valid badges from all tabs');

      const tabs = (await safe(chrome.tabs.query({}))) || [];

      const removePromises = tabs.map(async (tab: chrome.tabs.Tab) => {
        if (tab.id) {
          try {
            await safe(chrome.tabs.sendMessage(tab.id, {
              type: 'REMOVE_VALID_BADGE',
            }));
          } catch (error) {
            // Silently handle tabs that can't receive messages (e.g., chrome:// pages)
          }
        }
      });

      await Promise.allSettled(removePromises);
      logger.log('📋 BADGE CLEANUP: Valid badge removal completed for all tabs');
    } catch (error) {
      logger.warn('Failed to remove valid badges from all tabs:', error instanceof Error ? error.message : String(error));
    }
  }

  // CyberDrain integration - Apply branding to extension action
  async applyBrandingToAction(): Promise<void> {
    try {
      const brandingConfig = await this.configManager.getBrandingConfig();
      console.log('Background: Loaded branding from config manager:', brandingConfig);

      const title = brandingConfig.productName || this.policy?.BrandingName || this.getDefaultPolicy().BrandingName;
      await safe(chrome.action.setTitle({ title }));
      console.log('Extension title set to:', title);

      const logoUrl = brandingConfig.logoUrl || this.policy?.BrandingImage;
      if (logoUrl && typeof globalThis.OffscreenCanvas !== 'undefined' && typeof globalThis.createImageBitmap !== 'undefined') {
        try {
          console.log('Loading custom extension icon from:', logoUrl);
          const iconUrl = logoUrl.startsWith('http') ? logoUrl : chrome.runtime.getURL(logoUrl);
          const img = await fetchWithTimeout(iconUrl);
          if (!img.ok) {
            console.warn('Failed to fetch custom icon:', img.status);
            return;
          }

          const blob = await img.blob();
          if (blob.size > 1_000_000) {
            console.warn('Custom icon too large, skipping');
            return;
          }

          const bmp = await createImageBitmap(blob);
          const sizes = [16, 32, 48, 128];
          const images: Record<string, ImageData> = {};
          for (const s of sizes) {
            const canvas = new OffscreenCanvas(s, s);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, s, s);
              ctx.drawImage(bmp, 0, 0, s, s);
              images[String(s)] = ctx.getImageData(0, 0, s, s);
            }
          }
          await safe(chrome.action.setIcon({ imageData: images }));
          console.log('Custom extension icon applied successfully');
        } catch (e) {
          console.warn('Failed to apply custom icon:', e instanceof Error ? e.message : String(e));
        }
      } else {
        console.log('No custom logo configured or OffscreenCanvas not available');
      }
    } catch (error) {
      console.error('Failed to apply branding to action:', error);
    }
  }

  // CyberDrain integration - Send event to reporting server
  async sendEvent(evt: any): Promise<void> {
    if (!this.policy?.CIPPReportingServer) return;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(
        this.policy.CIPPReportingServer.replace(/\/+$/, '') + '/events/cyberdrain-phish',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ts: new Date().toISOString(),
            ua: navigator.userAgent,
            ...evt,
          }),
          signal: ctrl.signal,
        }
      );
      clearTimeout(t);
      await res.text();
    } catch {
      /* best-effort */
    }
  }

  setupEventListeners(): void {
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

    // Handle tab activation for badge updates
    chrome.tabs.onActivated.addListener(async ({ tabId }) => {
      const data = await safe(chrome.storage.session.get('verdict:' + tabId));
      const verdict = data?.['verdict:' + tabId]?.verdict || 'not-evaluated';
      this.setBadge(tabId, verdict);
    });

    // Handle storage changes (for enterprise policy updates)
    chrome.storage.onChanged.addListener((changes, namespace) => {
      this.handleStorageChange(changes, namespace);
    });

    // Handle web navigation events
    if (chrome.webNavigation?.onCompleted) {
      chrome.webNavigation.onCompleted.addListener((details) => {
        if (details.frameId === 0) {
          queueMicrotask(() => this.logUrlAccess(details.url, details.tabId).catch(() => {}));
        }
      });
    }

    // Capture response headers
    if (chrome.webRequest?.onHeadersReceived) {
      chrome.webRequest.onHeadersReceived.addListener(
        (details) => {
          if (details.tabId < 0 || !details.responseHeaders) return;

          try {
            if (this.tabHeaders.size >= this.MAX_HEADER_CACHE_ENTRIES) {
              let oldestId = null;
              let oldestTs = Infinity;
              for (const [id, data] of this.tabHeaders) {
                if ((data as any).ts < oldestTs) {
                  oldestTs = (data as any).ts;
                  oldestId = id;
                }
              }
              if (oldestId !== null) this.tabHeaders.delete(oldestId);
            }

            const headers: Record<string, string> = {};
            for (const h of details.responseHeaders || []) {
              headers[h.name.toLowerCase()] = h.value || '';
            }
            this.tabHeaders.set(details.tabId, { headers, ts: Date.now() });
          } catch (error) {
            // Ignore header cache errors
          }
        },
        { urls: ['<all_urls>'], types: ['main_frame'] },
        ['responseHeaders']
      );
    }

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.tabHeaders.delete(tabId);
      this.tabQueues.delete(tabId);
      clearTimeout(this.tabDebounce.get(tabId));
      this.tabDebounce.delete(tabId);
    });
  }

  // Tab event management utilities
  enqueue(tabId: number, task: () => Promise<void>): void {
    const prev = this.tabQueues.get(tabId) || Promise.resolve();
    const next = prev.finally(task).catch(() => {}); // keep chain alive
    this.tabQueues.set(tabId, next);
  }

  debouncePerTab(tabId: number, fn: () => void, ms = 150): void {
    clearTimeout(this.tabDebounce.get(tabId));
    const id = setTimeout(fn, ms);
    this.tabDebounce.set(tabId, id);
  }

  // Storage batching utilities
  scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    chrome.alarms.create('check:flush', { when: Date.now() + 2000 });
  }

  async _doFlush(): Promise<void> {
    const cur = (await safe(chrome.storage.local.get(['accessLogs', 'securityEvents']))) || {};
    const access = (cur.accessLogs || []).concat(this.pendingLocal.accessLogs).slice(-1000);
    const sec = (cur.securityEvents || []).concat(this.pendingLocal.securityEvents).slice(-500);
    this.pendingLocal.accessLogs.length = 0;
    this.pendingLocal.securityEvents.length = 0;
    const payload = { accessLogs: access, securityEvents: sec };
    if (JSON.stringify(payload).length <= 4 * 1024 * 1024) {
      await safe(chrome.storage.local.set(payload));
    }
  }

  async handleStartup(): Promise<void> {
    logger.log('Check: Extension startup detected');
    const config = (await safe(this.configManager.getConfig())) || {};
    logger.init({
      level: 'info',
      enabled: true,
    });
  }

  async handleInstalled(details: chrome.runtime.InstalledDetails): Promise<void> {
    logger.log('Check: Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
      // Set default configuration
      await safe(this.configManager.setDefaultConfig());

      // Open options page for initial setup
      await safe(chrome.tabs.create({
        url: chrome.runtime.getURL('options/options.html'),
      }));
    } else if (details.reason === 'update') {
      // Handle extension updates
      logger.log('Extension updated from version:', details.previousVersion);
    }
  }

  async handleTabUpdate(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Ignore stale onUpdated payloads after debounce
      const latest = await safe(chrome.tabs.get(tabId));
      if (!latest || latest.url !== (tab?.url || changeInfo.url)) return;

      // Handle URL changes and set badges
      if (changeInfo.status === 'complete' && tab?.url) {
        const urlBasedVerdict = this.verdictForUrl(tab.url);

        // Check if there's already a more specific verdict
        const existingData = await safe(chrome.storage.session.get('verdict:' + tabId));
        const existingVerdict = existingData?.['verdict:' + tabId]?.verdict;

        // Don't override specific verdicts with generic URL-based verdicts
        const shouldUpdateVerdict =
          !existingVerdict ||
          existingVerdict === 'not-evaluated' ||
          (existingVerdict === 'trusted' && urlBasedVerdict !== 'trusted');

        if (shouldUpdateVerdict) {
          logger.log(`🔄 Updating verdict for tab ${tabId}: ${existingVerdict || 'none'} → ${urlBasedVerdict}`);
          await safe(chrome.storage.session.set({
            ['verdict:' + tabId]: { verdict: urlBasedVerdict, url: tab.url },
          }));
          this.setBadge(tabId, urlBasedVerdict);
        } else {
          logger.log(`⏭️ Keeping existing verdict for tab ${tabId}: ${existingVerdict} (not overriding with ${urlBasedVerdict})`);
          this.setBadge(tabId, existingVerdict);
        }

        if (urlBasedVerdict === 'trusted') {
          queueMicrotask(() =>
            this.sendEvent({ type: 'trusted-login-page', url: tab.url }).catch(() => {})
          );
        }
      }

      if (!changeInfo.url) return;

      const shouldInjectContentScript = this.shouldInjectContentScript(changeInfo.url);

      if (shouldInjectContentScript) {
        await this.injectContentScript(tabId);
      }

      // Log URL access for audit purposes
      queueMicrotask(() => this.logUrlAccess(tab.url!, tabId).catch(() => {}));
    } catch (error) {
      logger.error('Check: Error handling tab update:', error);
    }
  }

  shouldInjectContentScript(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol;

      const disallowed = [
        'chrome:',
        'edge:',
        'about:',
        'chrome-extension:',
        'moz-extension:',
        'devtools:',
      ];

      if (disallowed.includes(protocol)) {
        return false;
      }

      return true;
    } catch (error) {
      logger.warn('Check: Invalid URL for content script injection:', url);
      return false;
    }
  }

  async injectContentScript(tabId: number): Promise<void> {
    try {
      const exists = await safe(chrome.tabs.get(tabId));
      if (!exists) return;

      const url = exists?.url;
      if (!url) {
        logger.warn('Check: No URL for tab', tabId);
        return;
      }

      let protocol: string;
      try {
        protocol = new URL(url).protocol;
      } catch {
        logger.warn('Check: Invalid URL, skipping content script:', url);
        return;
      }

      const disallowed = [
        'chrome:',
        'edge:',
        'about:',
        'chrome-extension:',
        'moz-extension:',
        'devtools:',
      ];

      if (disallowed.includes(protocol)) {
        logger.warn('Check: Skipping content script injection for disallowed URL:', url);
        return;
      }

      await safe(chrome.scripting.executeScript({
        target: { tabId },
        files: ['scripts/content.js'],
      }));
    } catch (error) {
      logger.error('Check: Failed to inject content script:', error);
    }
  }

  async logUrlAccess(url: string, tabId?: number): Promise<void> {
    const config = (await safe(this.configManager.getConfig())) || {};
    if (!config.enableDebugLogging) {
      return;
    }

    const profileInfo = await this.getCurrentProfile();

    const logEntry = {
      timestamp: new Date().toISOString(),
      url,
      tabId,
      type: 'url_access',
      event: {
        type: 'page_scanned',
        url: url,
        threatDetected: false,
      },
      profile: this.sanitizeProfileForLogging(profileInfo),
    };

    this.pendingLocal.accessLogs.push(logEntry);
    this.scheduleFlush();
  }

  async logEvent(event: any, tabId?: number): Promise<void> {
    const config = await safe(this.configManager.getConfig());

    if (event.type === 'legitimate_access' && !config?.enableDebugLogging) {
      return;
    }

    const profileInfo = await this.getCurrentProfile();

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: this.enhanceEventForLogging(event),
      tabId,
      type: 'security_event',
      profile: this.sanitizeProfileForLogging(profileInfo),
    };

    if (config?.enableDebugLogging) {
      logger.log('Check: Security Event:', logEntry);
    }

    this.pendingLocal.securityEvents.push(logEntry);
    this.scheduleFlush();

    await this.sendToCipp(logEntry, config);
  }

  enhanceEventForLogging(event: any): any {
    const enhancedEvent = { ...event };

    const threatEvents = new Set([
      'content_threat_detected',
      'threat_detected',
      'blocked_page_viewed',
      'threat_blocked',
      'threat_detected_no_action',
    ]);

    const legitimateEvents = new Set([
      'legitimate_access',
      'url_access',
      'page_scanned',
      'trusted-login-page',
      'user-logged-on',
      'ms-login-unknown-domain',
    ]);

    const shouldDefangUrl =
      event.url &&
      threatEvents.has(event.type) &&
      !legitimateEvents.has(event.type);

    if (event.url) {
      console.log(`[URL Defanging] Event type: ${event.type}, shouldDefang: ${shouldDefangUrl}, URL: ${event.url}`);
    }

    if (shouldDefangUrl) {
      enhancedEvent.url = this.defangUrl(event.url);
      enhancedEvent.threatDetected = true;
    }

    switch (event.type) {
      case 'url_access':
        enhancedEvent.action = event.action || 'allowed';
        enhancedEvent.threatLevel = event.threatLevel || 'none';
        break;
      case 'content_threat_detected':
      case 'threat_detected':
        enhancedEvent.action = event.action || 'blocked';
        enhancedEvent.threatLevel = event.threatLevel || 'high';
        enhancedEvent.threatDetected = true;
        break;
      case 'form_submission':
        enhancedEvent.action = event.action || 'blocked';
        enhancedEvent.threatLevel = event.threatLevel || 'medium';
        break;
      case 'script_injection':
        enhancedEvent.action = event.action || 'injected';
        enhancedEvent.threatLevel = event.threatLevel || 'info';
        break;
      case 'page_scanned':
        enhancedEvent.action = event.action || 'scanned';
        enhancedEvent.threatLevel = event.threatLevel || 'none';
        break;
      case 'blocked_page_viewed':
        enhancedEvent.action = event.action || 'viewed';
        enhancedEvent.threatLevel = event.threatLevel || 'high';
        enhancedEvent.threatDetected = true;
        break;
      case 'threat_blocked':
      case 'threat_detected_no_action':
        enhancedEvent.action = event.type === 'threat_blocked' ? 'blocked' : 'detected';
        enhancedEvent.threatLevel = event.severity || 'high';
        enhancedEvent.threatDetected = true;
        break;
      case 'legitimate_access':
        enhancedEvent.action = event.action || 'allowed';
        enhancedEvent.threatLevel = event.threatLevel || 'none';
        break;
      default:
        if (!enhancedEvent.action) enhancedEvent.action = 'logged';
        if (!enhancedEvent.threatLevel) enhancedEvent.threatLevel = 'info';
    }

    return enhancedEvent;
  }

  defangUrl(url: string): string {
    try {
      if (url.includes('[:]')) {
        return url;
      }
      return url.replace(/:/g, '[:]');
    } catch (e) {
      return url;
    }
  }

  async handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, namespace: string): Promise<void> {
    if (namespace === 'managed') {
      logger.log('Check: Enterprise policy updated');
      await safe(this.policyManager.loadPolicies());
      const config = (await safe(this.configManager.getConfig())) || {};
      logger.init({
        level: 'info',
        enabled: true,
      });
      await this.refreshPolicy();
    }
  }

  // Profile Information Management
  async loadProfileInformation(): Promise<void> {
    try {
      this.profileInfo = {
        profileId: await this.getOrCreateProfileId(),
        isManaged: await this.checkManagedEnvironment(),
        userInfo: await this.getUserInfo(),
        browserInfo: await this.getBrowserInfo(),
        timestamp: new Date().toISOString(),
      };

      logger.log('Profile information loaded:', this.profileInfo);

      await chrome.storage.local.set({
        currentProfile: this.profileInfo,
      });
    } catch (error) {
      logger.error('Failed to load profile information:', error);
      this.profileInfo = {
        profileId: 'unknown',
        isManaged: false,
        userInfo: null,
        browserInfo: null,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getOrCreateProfileId(): Promise<string> {
    try {
      const result = await chrome.storage.local.get(['profileId']);

      if (!result.profileId) {
        const profileId = crypto.randomUUID();
        await chrome.storage.local.set({ profileId });
        logger.log('Generated new profile ID:', profileId);
        return profileId;
      }

      logger.log('Using existing profile ID:', result.profileId);
      return result.profileId;
    } catch (error) {
      logger.error('Failed to get/create profile ID:', error);
      return 'fallback-' + Date.now();
    }
  }

  async checkManagedEnvironment(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        chrome.storage.managed.get(null, (policies) => {
          if (chrome.runtime.lastError) {
            resolve(false);
          } else {
            const isManaged = policies && Object.keys(policies).length > 0;
            if (isManaged) {
              logger.log('Detected managed environment with policies:', policies);
            }
            resolve(isManaged);
          }
        });
      } catch (error) {
        logger.error('Error checking managed environment:', error);
        resolve(false);
      }
    });
  }

  async getUserInfo(): Promise<any> {
    return new Promise((resolve) => {
      try {
        if (chrome.identity && chrome.identity.getProfileUserInfo) {
          chrome.identity.getProfileUserInfo(
            {},
            (userInfo) => {
              if (chrome.runtime.lastError) {
                logger.log('Chrome identity error:', chrome.runtime.lastError);
                resolve(null);
              } else if (!userInfo) {
                logger.log('No user info returned from chrome.identity');
                resolve(null);
              } else if (!userInfo.email) {
                logger.log('User info available but no email:', userInfo);
                resolve({
                  email: null,
                  id: userInfo.id || null,
                  emailNotAvailable: true,
                  reason: 'User not signed in or email permission not granted',
                });
              } else {
                const email = userInfo.email;
                let accountType = 'personal';
                let provider = 'unknown';

                if (email.includes('@')) {
                  const domain = email.split('@')[1]?.toLowerCase();
                  if (domain) {
                    if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com')) {
                      accountType = 'microsoft-personal';
                      provider = 'microsoft';
                    } else if (domain.includes('gmail.com') || domain.includes('googlemail.com')) {
                      accountType = 'google-personal';
                      provider = 'google';
                    } else {
                      accountType = 'work-school';
                      provider = domain.includes('.onmicrosoft.com') ? 'microsoft' : 'unknown';
                    }
                  }
                }

                logger.log('User info retrieved successfully:', {
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
          logger.log('chrome.identity API not available');
          resolve(null);
        }
      } catch (error) {
        logger.error('Error getting user info:', error);
        resolve(null);
      }
    });
  }

  async getBrowserInfo(): Promise<any> {
    try {
      const userAgent = navigator.userAgent;

      let browserType = 'chrome';
      let browserVersion = 'unknown';

      if (userAgent.includes('Edg/')) {
        browserType = 'edge';
        const edgeMatch = userAgent.match(/Edg\/([\d.]+)/);
        browserVersion = edgeMatch ? (edgeMatch[1] || 'unknown') : 'unknown';
      } else if (userAgent.includes('Chrome/')) {
        browserType = 'chrome';
        const chromeMatch = userAgent.match(/Chrome\/([\d.]+)/);
        browserVersion = chromeMatch ? (chromeMatch[1] || 'unknown') : 'unknown';
      } else if (userAgent.includes('Chromium/')) {
        browserType = 'chromium';
        const chromiumMatch = userAgent.match(/Chromium\/([\d.]+)/);
        browserVersion = chromiumMatch ? (chromiumMatch[1] || 'unknown') : 'unknown';
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

      if (chrome.management && chrome.management.getSelf) {
        const extensionInfo = await new Promise<chrome.management.ExtensionInfo | null>((resolve) => {
          chrome.management.getSelf((info) => {
            if (chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(info);
            }
          });
        });

        if (extensionInfo) {
          (info as any).installType = extensionInfo.installType;
          (info as any).enabled = extensionInfo.enabled;
          (info as any).version = extensionInfo.version;
        }
      }

      return info;
    } catch (error) {
      logger.error('Error getting browser info:', error);
      return {
        extensionId: chrome.runtime.id,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getCurrentProfile(): Promise<any> {
    if (!this.profileInfo) {
      await this.loadProfileInformation();
    }
    return this.profileInfo;
  }

  async refreshProfileInformation(): Promise<any> {
    logger.log('Refreshing profile information');
    await this.loadProfileInformation();
    return this.profileInfo;
  }

  sanitizeProfileForLogging(profileInfo: any): any {
    if (!profileInfo) return null;

    const userInfo = profileInfo.userInfo
      ? {
          email: profileInfo.userInfo.email,
          id: profileInfo.userInfo.id,
          accountType: profileInfo.userInfo.accountType || 'unknown',
          provider: profileInfo.userInfo.provider || 'unknown',
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
      },
      timestamp: profileInfo.timestamp,
    };
  }

  async sendToCipp(logEntry: any, config: any): Promise<void> {
    if (!config?.enableCippReporting || !config?.cippServerUrl) {
      return;
    }

    try {
      const cippPayload = {
        timestamp: logEntry.timestamp,
        source: 'microsoft-365-phishing-protection',
        version: chrome.runtime.getManifest().version,
        event: logEntry.event,
        profile: logEntry.profile,
        tabId: logEntry.tabId,
        type: logEntry.type,
      };

      if (logEntry.profile?.isManaged) {
        (cippPayload as any).context = 'managed';
      }

      const response = await fetch(`${config.cippServerUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Microsoft365PhishingProtection/${chrome.runtime.getManifest().version}`,
        },
        body: JSON.stringify(cippPayload),
      });

      if (!response.ok) {
        throw new Error(`CIPP server responded with ${response.status}: ${response.statusText}`);
      }

      logger.log('Successfully sent telemetry to CIPP');
    } catch (error) {
      logger.error('Failed to send telemetry to CIPP:', error);
    }
  }

  async handleCippReport(basePayload: any): Promise<void> {
    try {
      const config = await this.configManager.getConfig();

      if (!config?.enableCippReporting || !config?.cippServerUrl) {
        logger.debug('CIPP reporting disabled or no server URL configured');
        return;
      }

      const cippUrl = config.cippServerUrl.replace(/\/+$/, '') + '/api/PublicPhishingCheck';
      const userProfile = await this.getCurrentProfile();

      const userEmail = userProfile?.userInfo?.email || null;
      const userDisplayName =
        userProfile?.userInfo?.displayName ||
        userProfile?.userInfo?.name ||
        (userEmail ? userEmail.split('@')[0] : null);

      const browserContext = {
        browserType: userProfile?.browserInfo?.browserType || 'unknown',
        browserVersion: userProfile?.browserInfo?.browserVersion || 'unknown',
        platform: userProfile?.browserInfo?.platform || 'unknown',
        language: userProfile?.browserInfo?.language || 'unknown',
        extensionVersion:
          userProfile?.browserInfo?.version ||
          chrome.runtime.getManifest().version,
        installType: userProfile?.browserInfo?.installType || 'unknown',
      };

      const enhancedPayload = {
        ...basePayload,
        tenantId: config.cippTenantId || null,
        userEmail: userEmail,
        userDisplayName: userDisplayName,
        accountType: userProfile?.userInfo?.accountType || 'unknown',
        isManaged: userProfile?.isManaged || false,
        profileId: userProfile?.profileId || null,
        browserContext: browserContext,
        alertSeverity: this.mapSeverityLevel(basePayload.severity || basePayload.threatLevel),
        alertCategory: this.categorizeSecurityEvent(basePayload),
        detectionMethod: 'chrome_extension',
        extensionId: chrome.runtime.id,
        reportVersion: '2.0',
        ...(basePayload.redirectTo && {
          redirectContext: {
            redirectHost: basePayload.redirectTo,
            isLocalhost: basePayload.redirectTo?.includes('localhost'),
            isPrivateIP: this.isPrivateIP(basePayload.redirectTo),
          },
        }),
        ...(basePayload.clientId && {
          oauthContext: {
            clientId: basePayload.clientId,
            appName: basePayload.appName || 'Unknown',
            ...(basePayload.reason && { threatReason: basePayload.reason }),
          },
        }),
      };

      logger.log(`Sending enhanced CIPP report to: ${cippUrl}`);
      logger.debug(`Report type: ${basePayload.type}, severity: ${enhancedPayload.alertSeverity}, category: ${enhancedPayload.alertCategory}`);

      if (config.cippTenantId) {
        logger.debug(`Including tenant ID: ${config.cippTenantId}`);
      }
      if (userEmail) {
        logger.debug(`Including user profile: ${userEmail}`);
      }

      const response = await fetch(cippUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Check/${chrome.runtime.getManifest().version}`,
          'X-Report-Version': '2.0',
        },
        body: JSON.stringify(enhancedPayload),
      });

      if (!response.ok) {
        throw new Error(`CIPP server responded with ${response.status}: ${response.statusText}`);
      }

      logger.log('✅ Enhanced CIPP report sent successfully');
    } catch (error) {
      logger.error('Failed to send CIPP report:', error);
      throw error;
    }
  }

  mapSeverityLevel(severity: string): string {
    const severityMap: Record<string, string> = {
      critical: 'CRITICAL',
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW',
      info: 'INFORMATIONAL',
    };
    return severityMap[severity?.toLowerCase()] || 'MEDIUM';
  }

  categorizeSecurityEvent(payload: any): string {
    const type = payload.type?.toLowerCase() || '';

    if (type.includes('rogue_app') || payload.ruleType === 'rogue_app_detection') {
      return 'OAUTH_THREAT';
    }
    if (type.includes('phishing') || type.includes('blocked')) {
      return 'PHISHING_ATTEMPT';
    }
    if (type.includes('suspicious')) {
      return 'SUSPICIOUS_ACTIVITY';
    }
    if (type.includes('microsoft_logon')) {
      return 'LEGITIMATE_ACCESS';
    }

    return 'SECURITY_EVENT';
  }

  isPrivateIP(host: string): boolean {
    if (!host) return false;

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

  async getStatistics(): Promise<any> {
    try {
      const result = await safe(chrome.storage.local.get(['securityEvents', 'accessLogs', 'debugLogs'])) || {};

      const securityEvents = result.securityEvents || [];
      const accessLogs = result.accessLogs || [];

      let blockedThreats = 0;
      let scannedPages = 0;
      let securityEventsCount = 0;

      securityEvents.forEach((entry: any) => {
        const event = entry.event;
        if (!event) return;

        securityEventsCount++;

        if (
          event.type === 'threat_blocked' ||
          event.type === 'threat_detected' ||
          event.type === 'content_threat_detected' ||
          (event.action && event.action.includes('blocked')) ||
          (event.threatLevel && ['high', 'critical'].includes(event.threatLevel))
        ) {
          blockedThreats++;
        }
      });

      accessLogs.forEach((entry: any) => {
        const event = entry.event;
        if (event && event.type === 'page_scanned') {
          scannedPages++;
        }
      });

      securityEvents.forEach((entry: any) => {
        const event = entry.event;
        if (event && event.type === 'legitimate_access') {
          scannedPages++;
        }
      });

      const statistics = {
        blockedThreats: blockedThreats,
        scannedPages: scannedPages,
        securityEvents: securityEventsCount,
        lastUpdated: new Date().toISOString(),
      };

      logger.log('Calculated statistics:', statistics);
      return statistics;
    } catch (error) {
      logger.error('Failed to calculate statistics:', error);
      return {
        blockedThreats: 0,
        scannedPages: 0,
        securityEvents: 0,
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async testDetectionRules(testData: any = null): Promise<any> {
    const results = {
      timestamp: new Date().toISOString(),
      engineStatus: this.isInitialized,
      rulesLoaded: false,
      message: 'Detection testing moved to content script',
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

  async runComprehensiveTest(): Promise<any> {
    return {
      timestamp: new Date().toISOString(),
      message: 'Comprehensive testing moved to content script',
      testSuites: [],
    };
  }

  async handleMessage(msg: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void): Promise<void> {
    try {
      const messageType = msg.type || msg.action;

      if (messageType === 'ping') {
        sendResponse({
          success: true,
          message: 'Check background script is running',
          timestamp: new Date().toISOString(),
          initialized: this.isInitialized,
          fallbackMode: !this.isInitialized,
          errorCount: this.errorCount,
          lastError: this.lastError?.message || null,
        });
        return;
      }

      if (!this.isInitialized) {
        try {
          await this.initialize();
        } catch (error) {
          logger.warn('CheckBackground.handleMessage: initialization failed, using fallback', error);
        }
      }

      switch (messageType) {
        case 'FLAG_PHISHY':
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            await safe(chrome.storage.session.set({
              ['verdict:' + tabId]: {
                verdict: 'phishy',
                url: sender.tab.url,
              },
            }));
            this.setBadge(tabId, 'phishy');
            sendResponse({ success: true });
            queueMicrotask(() =>
              this.sendEvent({
                type: 'phishy-detected',
                url: sender.tab!.url,
                reason: msg.reason || 'heuristic',
              }).catch(() => {})
            );
          }
          break;

        case 'FLAG_TRUSTED_BY_REFERRER':
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            await safe(chrome.storage.session.set({
              ['verdict:' + tabId]: {
                verdict: 'trusted',
                url: sender.tab.url,
                by: 'referrer',
              },
            }));
            this.setBadge(tabId, 'trusted');
            sendResponse({ success: true });
            queueMicrotask(() => this.showValidBadge(tabId).catch(() => {}));
            if (this.policy?.AlertWhenLogon) {
              queueMicrotask(() =>
                this.sendEvent({
                  type: 'user-logged-on',
                  url: sender.tab!.url,
                  by: 'referrer',
                }).catch(() => {})
              );
            }
          }
          break;

        case 'FLAG_MS_LOGIN_ON_UNKNOWN_DOMAIN':
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            await safe(chrome.storage.session.set({
              ['verdict:' + tabId]: {
                verdict: 'ms-login-unknown',
                url: sender.tab.url,
                origin: msg.origin,
                redirectTo: msg.redirectTo,
              },
            }));
            this.setBadge(tabId, 'ms-login-unknown');
            sendResponse({ success: true });
            queueMicrotask(() =>
              this.sendEvent({
                type: 'ms-login-unknown-domain',
                url: sender.tab!.url,
                origin: msg.origin,
                redirectTo: msg.redirectTo,
                reason: 'Microsoft login page detected on non-trusted domain',
              }).catch(() => {})
            );
          }
          break;

        case 'FLAG_ROGUE_APP':
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            logger.log(`🚨 FLAG_ROGUE_APP received for tab ${tabId}, updating badge to rogue-app`);
            
            await safe(chrome.storage.session.set({
              ['verdict:' + tabId]: {
                verdict: 'rogue-app',
                url: sender.tab.url,
                clientId: msg.clientId,
                appName: msg.appName,
                reason: msg.reason,
              },
            }));
            this.setBadge(tabId, 'rogue-app');
            sendResponse({ success: true });
            queueMicrotask(() =>
              this.sendEvent({
                type: 'rogue-app-detected',
                url: sender.tab!.url,
                clientId: msg.clientId,
                appName: msg.appName,
                reason: msg.reason,
                severity: 'critical',
              }).catch(() => {})
            );
          }
          break;

        case 'UPDATE_VERDICT_TO_SAFE':
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            await safe(chrome.storage.session.set({
              ['verdict:' + tabId]: {
                verdict: 'safe',
                url: sender.tab.url,
                reason: msg.reason,
                analysis: msg.analysis,
                legitimacyScore: msg.legitimacyScore,
                threshold: msg.threshold,
              },
            }));
            this.setBadge(tabId, 'not-evaluated');
            sendResponse({ success: true });
          }
          break;

        case 'CHECK_ROGUE_APP':
          try {
            const clientId = msg.clientId;
            const result = this.rogueAppsManager.checkClientId(clientId);
            sendResponse({ success: true, data: result });
            
            if (result?.isRogue && sender.tab?.id) {
              await safe(chrome.storage.session.set({
                ['verdict:' + sender.tab.id]: {
                  verdict: 'rogue-app',
                  url: sender.tab.url,
                  appId: clientId,
                },
              }));
              this.setBadge(sender.tab.id, 'rogue-app');
              queueMicrotask(() =>
                this.sendEvent({
                  type: 'rogue-app-detected',
                  url: sender.tab!.url,
                  clientId,
                  appName: result.appName,
                }).catch(() => {})
              );
            }
          } catch (error) {
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'REQUEST_POLICY':
          sendResponse({ success: true, policy: this.policy });
          break;

        case 'REQUEST_SHOW_VALID_BADGE':
          if (sender.tab?.id) {
            queueMicrotask(() =>
              this.showValidBadge(sender.tab!.id!).catch(() => {})
            );
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'No tab ID available' });
          }
          break;

        case 'ANALYZE_CONTENT_WITH_RULES':
          sendResponse({
            success: false,
            error: 'Content analysis moved to content script',
          });
          break;

        case 'protection_event':
          try {
            if (msg.data) {
              await this.logEvent(msg.data, sender.tab?.id);
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'No event data provided' });
            }
          } catch (error) {
            logger.error('Failed to handle protection event:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'GET_PAGE_HEADERS':
          try {
            const data = sender.tab?.id != null ? this.tabHeaders.get(sender.tab.id) : null;
            if (data && Date.now() - (data as any).ts > this.HEADER_CACHE_TTL) {
              this.tabHeaders.delete(sender.tab!.id);
              sendResponse({ success: true, headers: {} });
            } else {
              sendResponse({ success: true, headers: (data as any)?.headers || {} });
            }
          } catch (error) {
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'testDetectionEngine':
          sendResponse({
            success: true,
            message: 'Detection engine functionality moved to content script',
            rulesLoaded: 0,
            engineInitialized: false,
            testsRun: 0,
          });
          break;

        case 'testConfiguration':
          try {
            const configTest = {
              configModules: [] as string[],
              initialized: this.isInitialized,
            };

            if (this.configManager) configTest.configModules.push('ConfigManager');
            if (this.policyManager) configTest.configModules.push('PolicyManager');
            if (this.detectionRulesManager) configTest.configModules.push('DetectionRulesManager');

            sendResponse({
              success: true,
              data: configTest,
            });
          } catch (error) {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          break;

        case 'URL_ANALYSIS_REQUEST':
          try {
            if (typeof msg.url !== 'string') {
              sendResponse({ success: false, error: 'Invalid url' });
              return;
            }

            const config = await this.configManager.getConfig();
            const isProtectionEnabled = config?.enablePageBlocking !== false;

            try {
              const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tabs.length > 0) {
                const tabId = tabs[0]!.id!;
                const contentResponse = await chrome.tabs.sendMessage(tabId, { type: 'GET_DETECTION_RESULTS' });

                if (contentResponse && contentResponse.success) {
                  const analysis = {
                    url: msg.url,
                    verdict: contentResponse.verdict || this.verdictForUrl(msg.url),
                    isBlocked: contentResponse.isBlocked || false,
                    isSuspicious: contentResponse.isSuspicious || false,
                    threats: contentResponse.threats || [],
                    reason: contentResponse.reason || 'Analysis from content script',
                    protectionEnabled: isProtectionEnabled,
                    timestamp: new Date().toISOString(),
                  };
                  sendResponse({ success: true, analysis });
                  return;
                }
              }
            } catch (contentError) {
              console.log('Check: Content script not available, using basic analysis');
            }

            const analysis = {
              url: msg.url,
              verdict: this.verdictForUrl(msg.url),
              isBlocked: false,
              isSuspicious: false,
              threats: [],
              reason: 'Basic analysis - content script not available',
              protectionEnabled: isProtectionEnabled,
              timestamp: new Date().toISOString(),
            };

            sendResponse({ success: true, analysis });
          } catch (error) {
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'POLICY_CHECK':
          const policyResult = await this.policyManager.checkPolicy(msg.action, msg.context);
          sendResponse({
            success: true,
            allowed: policyResult.allowed,
            reason: policyResult.reason,
          });
          break;

        case 'CONTENT_MANIPULATION_REQUEST':
          const manipulationAllowed = true; // Placeholder - method doesn't exist
          sendResponse({ success: true, allowed: manipulationAllowed });
          break;

        case 'LOG_EVENT':
          if (!msg.event || typeof msg.event !== 'object') {
            sendResponse({ success: false, error: 'Invalid event' });
            return;
          }
          await this.logEvent(msg.event, sender.tab?.id);
          sendResponse({ success: true });
          break;

        case 'GET_CONFIG':
          try {
            const config = await this.configManager.getConfig();
            sendResponse({ success: true, config });
          } catch (error) {
            logger.error('Check: Failed to get config:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'GET_BRANDING_CONFIG':
          try {
            const brandingConfig = await this.configManager.getBrandingConfig();
            sendResponse({ success: true, branding: brandingConfig });
          } catch (error) {
            logger.error('Check: Failed to get branding config:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'GET_POLICIES':
          try {
            const managedPolicies = await new Promise((resolve, reject) => {
              chrome.storage.managed.get(null, (result) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(result);
                }
              });
            });

            const enterpriseConfig = await this.configManager.getEnterpriseConfig();

            sendResponse({
              success: true,
              managedPolicies,
              enterpriseConfig,
              isManaged: Object.keys(managedPolicies as any).length > 0,
            });
          } catch (error) {
            logger.error('Check: Failed to get policies:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'GET_STATISTICS':
          try {
            const statistics = await this.getStatistics();
            sendResponse({ success: true, statistics });
          } catch (error) {
            logger.error('Check: Failed to get statistics:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'get_detection_rules':
          try {
            const rules = await this.detectionRulesManager.getDetectionRules();
            const cacheInfo = { lastUpdate: Date.now(), isUpdateDue: false }; // Placeholder
            sendResponse({ success: true, rules, cacheInfo });
          } catch (error) {
            logger.error('Check: Failed to get detection rules:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'force_update_detection_rules':
          try {
            const rules = await this.detectionRulesManager.forceUpdate();
            sendResponse({
              success: true,
              rules,
              message: 'Detection rules updated',
            });
          } catch (error) {
            logger.error('Check: Failed to force update detection rules:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'UPDATE_CONFIG':
          try {
            const currentConfig = await this.configManager.getConfig();
            const previousBadgeEnabled = currentConfig?.enableValidPageBadge || this.policy?.EnableValidPageBadge;

            await this.configManager.updateConfig(msg.config);

            const updatedConfig = await this.configManager.getConfig();
            const newBadgeEnabled = updatedConfig?.enableValidPageBadge || this.policy?.EnableValidPageBadge;

            if (previousBadgeEnabled && !newBadgeEnabled) {
              await this.removeValidBadgesFromAllTabs();
            }

            sendResponse({ success: true });
          } catch (error) {
            logger.error('Check: Failed to update config:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'CONFIG_UPDATED':
          try {
            const currentConfig = await this.configManager.getConfig();
            const badgeEnabled = currentConfig?.enableValidPageBadge || this.policy?.EnableValidPageBadge;

            if (!badgeEnabled) {
              await this.removeValidBadgesFromAllTabs();
            }

            sendResponse({ success: true });
          } catch (error) {
            logger.error('Check: Failed to handle config update:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'UPDATE_BRANDING':
          try {
            await this.applyBrandingToAction();
            sendResponse({ success: true });
          } catch (error) {
            logger.error('Check: Failed to update branding:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'TEST_DETECTION_RULES':
          const testResults = await this.testDetectionRules(msg.testData);
          sendResponse({ success: true, results: testResults });
          break;

        case 'VALIDATE_DETECTION_ENGINE':
          sendResponse({
            success: true,
            validation: {
              message: 'Detection engine functionality moved to content script',
              engineInitialized: false,
              detectionEngineStatus: 'removed',
            },
          });
          break;

        case 'GET_PROFILE_INFO':
          try {
            const profileInfo = await this.getCurrentProfile();
            sendResponse({ success: true, profile: profileInfo });
          } catch (error) {
            logger.error('Check: Failed to get profile info:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'REFRESH_PROFILE_INFO':
          try {
            const profileInfo = await this.refreshProfileInformation();
            sendResponse({ success: true, profile: profileInfo });
          } catch (error) {
            logger.error('Check: Failed to refresh profile info:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'RUN_COMPREHENSIVE_TEST':
          const comprehensiveResults = await this.runComprehensiveTest();
          sendResponse({ success: true, tests: comprehensiveResults });
          break;

        case 'send_cipp_report':
          try {
            if (!msg.payload) {
              sendResponse({ success: false, error: 'No payload provided' });
              return;
            }

            await this.handleCippReport(msg.payload);
            sendResponse({ success: true });
          } catch (error) {
            logger.error('Check: Failed to send CIPP report:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'log':
          if ('level' in msg && 'message' in msg) {
            await storeLog(msg.level, msg.message);
          }
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type: ' + messageType });
      }
    } catch (error) {
      logger.error('Check: Error handling message:', error);
      this.errorCount++;

      if (this.errorCount > this.maxErrors) {
        logger.warn('CheckBackground: too many errors, attempting reinitialization');
        this.errorCount = 0;
        this.isInitialized = false;
        this.initializationPromise = null;
        this.initialize().catch((err) => {
          logger.error('CheckBackground: reinitialization failed', err);
        });
      }

      sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

// Initialize the background service worker with singleton pattern
if (!globalThis.checkBackgroundInstance) {
  globalThis.checkBackgroundInstance = new CheckBackground();
  globalThis.checkBackgroundInstance.initialize().catch((error) => {
    console.error('Failed to initialize CheckBackground:', error);
  });
} else {
  // Service worker restarted, ensure existing instance is initialized
  globalThis.checkBackgroundInstance.initialize().catch((error) => {
    console.error('Failed to re-initialize CheckBackground:', error);
  });
}

const check = globalThis.checkBackgroundInstance;

// Export for testing purposes
if (typeof globalThis !== 'undefined' && (globalThis as any).module) {
  (globalThis as any).module.exports = CheckBackground;
}
