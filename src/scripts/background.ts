import { ConfigManager } from '../modules/config-manager';
import { PolicyManager } from '../modules/policy-manager';
import { DetectionRulesManager } from '../modules/detection-rules-manager';
import logger from '../utils/logger';
import { store as storeLog } from '../utils/background-logger';
import type { ExtensionMessage, MessageResponse } from '../../types/messages';
import type { RogueApp } from '../../types/detection';

console.log('Check: Background service worker loaded');
logger.init({ level: 'info', enabled: true });

const once = (fn: (...args: any[]) => void) => {
  let called = false;
  return (...args: any[]) => {
    if (!called) {
      called = true;
      fn(...args);
    }
  };
};

async function safe<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}

async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

class RogueAppsManager {
  private rogueApps = new Map<string, RogueApp>();
  private lastUpdate = 0;
  private updateInterval = 12 * 60 * 60 * 1000;
  private readonly cacheKey = 'rogue_apps_cache';
  private initialized = false;
  private config: any = null;
  private sourceUrl = '';

  private defaultConfig = {
    enabled: true,
    source_url: 'https://raw.githubusercontent.com/huntresslabs/rogueapps/refs/heads/main/public/rogueapps.json',
    cache_duration: 86400000,
    update_interval: 43200000,
    detection_action: 'warn',
    severity: 'high',
    auto_update: true,
    fallback_on_error: true,
  };

  async loadConfiguration(): Promise<void> {
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
    const highRiskTags = ['BEC', 'exfiltration', 'phishing', 'spam'];
    const mediumRiskTags = ['email', 'backup', 'collection'];

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

  private policy: any = null;
  private extraWhitelist = new Set<string>();
  private tabHeaders = new Map();
  private HEADER_CACHE_TTL = 5 * 60 * 1000;
  private MAX_HEADER_CACHE_ENTRIES = 100;

  private lastError: any = null;
  private errorCount = 0;
  private maxErrors = 10;

  private tabQueues = new Map();
  private tabDebounce = new Map();

  private pendingLocal = { accessLogs: [] as any[], securityEvents: [] as any[] };
  private flushScheduled = false;

  private profileInfo: any = null;

  constructor() {
    this.setupCoreListeners();
    this.setupMessageHandlers();
    this.initialize().catch((error) => {
      logger.error('Failed to initialize background script:', error);
    });
  }

  setupCoreListeners(): void {
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
    chrome.runtime.onMessage.addListener((msg: ExtensionMessage, sender, sendResponseRaw) => {
      const sendResponse = once(sendResponseRaw);
      (async () => {
        await this.handleMessage(msg, sender, sendResponse);
      })().catch((e) => {
        try {
          sendResponse({ success: false, error: e?.message || String(e) });
        } catch {}
      });
      return true;
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initializationPromise || this._retryScheduled) {
      return this.initializationPromise || Promise.resolve();
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  async _doInitialize(): Promise<void> {
    const isFirstInstance = !(globalThis as any).checkBackgroundInstance;
    if (isFirstInstance) {
      logger.log('CheckBackground.initialize: start');
    }

    try {
      const config = await this.configManager.loadConfig();
      logger.init({
        level: 'info',
        enabled: true,
      });

      await this.policyManager.initialize();
      await this.detectionRulesManager.initialize();
      await this.refreshPolicy();
      await this.rogueAppsManager.initialize();
      await this.loadProfileInformation();

      this.setupEventListeners();
      this.isInitialized = true;
      this.initializationRetries = 0;
      this.errorCount = 0;

      if (isFirstInstance) {
        logger.log('CheckBackground.initialize: complete');
      }
    } catch (error) {
      logger.error('CheckBackground.initialize: error', error);
      this.lastError = error;
      this.initializationRetries++;

      this.initializationPromise = null;

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

  async refreshPolicy(): Promise<void> {
    try {
      const policyData = this.policyManager.getPolicies();
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

  verdictForUrl(raw: string): string {
    const origin = this.urlOrigin(raw);
    const trustedOrigins = this.policy?.trustedOrigins || new Set([
      'https://login.microsoftonline.com',
      'https://login.microsoft.com',
      'https://account.microsoft.com',
    ]);
    if (trustedOrigins.has && trustedOrigins.has(origin)) return 'trusted';
    if (this.extraWhitelist.has(origin)) return 'trusted-extra';
    return 'not-evaluated';
  }

  async setBadge(tabId: number, verdict: string): Promise<void> {
    const map: Record<string, { text: string; color: string }> = {
      trusted: { text: 'MS', color: '#0a5' },
      'trusted-extra': { text: 'OK', color: '#0a5' },
      phishy: { text: '!', color: '#d33' },
      'ms-login-unknown': { text: '?', color: '#f90' },
      'rogue-app': { text: '⚠', color: '#f00' },
      'not-evaluated': { text: '', color: '#000' },
    };
    const cfg = map[verdict] ?? map['not-evaluated']!;

    logger.log(`🏷️ Setting badge for tab ${tabId}: verdict="${verdict}" → text="${cfg.text}" color="${cfg.color}"`);

    await safe(chrome.action.setBadgeText({ tabId, text: cfg.text }));
    if (cfg.text) {
      await safe(chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color }));
    } else {
      await safe(chrome.action.setBadgeText({ tabId, text: '' }));
    }
  }

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
          }
        }
      });

      await Promise.allSettled(removePromises);
      logger.log('📋 BADGE CLEANUP: Valid badge removal completed for all tabs');
    } catch (error) {
      logger.warn('Failed to remove valid badges from all tabs:', error instanceof Error ? error.message : String(error));
    }
  }

  async applyBrandingToAction(): Promise<void> {
    try {
      const brandingConfig = await this.configManager.getBrandingConfig();
      console.log('Background: Loaded branding from config manager:', brandingConfig);

      let title = 'Check';
      let iconPath = 'images/icon16.png';

      if (brandingConfig?.companyName || brandingConfig?.productName) {
        title = brandingConfig.productName || brandingConfig.companyName || 'Check';
      }

      if (this.policy?.BrandingImage) {
        iconPath = this.policy.BrandingImage;
      }

      await safe(chrome.action.setTitle({ title: title }));
      
      if (iconPath.startsWith('http')) {
        try {
          const iconResponse = await fetchWithTimeout(iconPath, 3000);
          if (iconResponse.ok) {
            const iconBlob = await iconResponse.blob();
            const iconData = await this.blobToImageData(iconBlob);
            if (iconData) {
              await safe(chrome.action.setIcon({ imageData: iconData }));
            }
          }
        } catch (iconError) {
          logger.warn('Failed to load custom icon:', iconError);
        }
      } else {
        await safe(chrome.action.setIcon({ path: iconPath }));
      }

      logger.log('Applied branding to extension action');
    } catch (error) {
      logger.warn('Failed to apply branding to action:', error instanceof Error ? error.message : String(error));
    }
  }

  async blobToImageData(blob: Blob): Promise<ImageData | null> {
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    } catch {
      return null;
    }
  }

  setupEventListeners(): void {
    chrome.runtime.onStartup.addListener(() => this.handleStartup());
    chrome.runtime.onInstalled.addListener((details) => this.handleInstalled(details));
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => this.handleTabUpdate(tabId, changeInfo, tab));
    chrome.tabs.onRemoved.addListener((tabId) => this.handleTabRemoved(tabId));
  }

  async loadProfileInformation(): Promise<void> {
    try {
      const profile = await new Promise((resolve) => {
        chrome.identity.getProfileUserInfo((userInfo) => {
          resolve(userInfo);
        });
      });
      this.profileInfo = profile;
    } catch (error) {
      logger.log('Profile information not available');
    }
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
    await safe(this.configManager.getConfig());
    logger.init({
      level: 'info',
      enabled: true,
    });
  }

  async handleInstalled(details: chrome.runtime.InstalledDetails): Promise<void> {
    logger.log('Check: Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
      await safe(this.configManager.setDefaultConfig());
      await safe(chrome.tabs.create({
        url: chrome.runtime.getURL('options/options.html'),
      }));
    } else if (details.reason === 'update') {
      // Handle extension updates - placeholder for future migration logic
    }
  }

  async handleTabUpdate(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void> {
    if (!this.isInitialized) return;

    try {
      const latest = await safe(chrome.tabs.get(tabId));
      if (!latest || latest.url !== (tab?.url || changeInfo.url)) return;

      if (changeInfo.status === 'complete' && tab?.url) {
        const urlBasedVerdict = this.verdictForUrl(tab.url);

        const existingData = await safe(chrome.storage.session.get('verdict:' + tabId));
        const existingVerdict = existingData?.['verdict:' + tabId]?.verdict;

        const shouldUpdateVerdict = !existingVerdict || 
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

      if (tab.url) {
        queueMicrotask(() => this.logUrlAccess(tab.url!, tabId).catch(() => {}));
      }
    } catch (error) {
      logger.error('Check: Error handling tab update:', error);
    }
  }

  async handleTabRemoved(tabId: number): Promise<void> {
    try {
      await safe(chrome.storage.session.remove('verdict:' + tabId));
      this.tabQueues.delete(tabId);
      this.tabDebounce.delete(tabId);
    } catch (error) {
      logger.warn('Error handling tab removal:', error);
    }
  }

  shouldInjectContentScript(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async injectContentScript(tabId: number): Promise<void> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['scripts/content.js']
      });
    } catch (error) {
      logger.debug('Failed to inject content script:', error);
    }
  }

  async logUrlAccess(url: string, tabId?: number): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        url,
        tabId,
        type: 'url_access'
      };
      this.pendingLocal.accessLogs.push(logEntry);
      
      if (!this.flushScheduled) {
        this.flushScheduled = true;
        chrome.alarms.create('check:flush', { when: Date.now() + 5000 });
      }
    } catch (error) {
      logger.debug('Failed to log URL access:', error);
    }
  }

  async logEvent(event: any, tabId?: number): Promise<void> {
    try {
      const logEntry = {
        ...event,
        timestamp: new Date().toISOString(),
        tabId
      };
      this.pendingLocal.securityEvents.push(logEntry);
      
      if (!this.flushScheduled) {
        this.flushScheduled = true;
        chrome.alarms.create('check:flush', { when: Date.now() + 5000 });
      }
    } catch (error) {
      logger.debug('Failed to log event:', error);
    }
  }

  async sendEvent(event: any): Promise<void> {
    try {
      await this.logEvent(event);
      
      const config = await safe(this.configManager.getConfig());
      if (config?.enableCippReporting && config.cippServerUrl) {
        queueMicrotask(() => this.sendToCipp(event, config).catch(() => {}));
      }
    } catch (error) {
      logger.debug('Failed to send event:', error);
    }
  }

  async sendToCipp(event: any, config: any): Promise<void> {
    try {
      if (!config.cippServerUrl) return;
      
      const response = await fetchWithTimeout(`${config.cippServerUrl}/api/events`, 5000);
      await fetch(response.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...event, tenantId: config.cippTenantId })
      });
    } catch (error) {
      logger.debug('Failed to send to CIPP:', error);
    }
  }

  async getStatistics(): Promise<any> {
    try {
      const storage = await safe(chrome.storage.local.get(['accessLogs', 'securityEvents'])) || {};
      const accessLogs = storage.accessLogs || [];
      const securityEvents = storage.securityEvents || [];
      
      return {
        totalUrlAccesses: accessLogs.length,
        totalSecurityEvents: securityEvents.length,
        threatsBlocked: securityEvents.filter((e: any) => e.type === 'threat_blocked').length,
        lastActivity: accessLogs.length > 0 ? accessLogs[accessLogs.length - 1].timestamp : null
      };
    } catch (error) {
      return {
        totalUrlAccesses: 0,
        totalSecurityEvents: 0,
        threatsBlocked: 0,
        lastActivity: null
      };
    }
  }

  async handleMessage(msg: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void): Promise<void> {
    try {
      const messageType = msg.type || (msg as any).action;

      if (messageType === 'ping') {
        sendResponse({
          success: true,
          data: {
            message: 'Check background script is running',
            timestamp: new Date().toISOString(),
            initialized: this.isInitialized,
            fallbackMode: !this.isInitialized,
            errorCount: this.errorCount,
            lastError: this.lastError?.message || null,
          }
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
                reason: (msg as any).reason || 'heuristic',
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

        case 'CHECK_ROGUE_APP':
          try {
            const clientId = (msg as any).clientId;
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

        case 'URL_ANALYSIS_REQUEST':
          try {
            if (typeof (msg as any).url !== 'string') {
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

                if (contentResponse && (contentResponse as any).success) {
                  const analysis = {
                    url: (msg as any).url,
                    verdict: (contentResponse as any).verdict || this.verdictForUrl((msg as any).url),
                    isBlocked: (contentResponse as any).isBlocked || false,
                    isSuspicious: (contentResponse as any).isSuspicious || false,
                    threats: (contentResponse as any).threats || [],
                    reason: (contentResponse as any).reason || 'Analysis from content script',
                    protectionEnabled: isProtectionEnabled,
                    timestamp: new Date().toISOString(),
                  };
                  sendResponse({ success: true, data: analysis });
                  return;
                }
              }
            } catch (contentError) {
              console.log('Check: Content script not available, using basic analysis');
            }

            const analysis = {
              url: (msg as any).url,
              verdict: this.verdictForUrl((msg as any).url),
              isBlocked: false,
              isSuspicious: false,
              threats: [],
              reason: 'Basic analysis - content script not available',
              protectionEnabled: isProtectionEnabled,
              timestamp: new Date().toISOString(),
            };

            sendResponse({ success: true, data: analysis });
          } catch (error) {
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'POLICY_CHECK':
          const policyResult = await this.policyManager.checkPolicy((msg as any).action, (msg as any).context);
          sendResponse({
            success: true,
            data: {
              allowed: policyResult.allowed,
              reason: policyResult.reason,
            }
          });
          break;

        case 'LOG_EVENT':
          if (!(msg as any).event || typeof (msg as any).event !== 'object') {
            sendResponse({ success: false, error: 'Invalid event' });
            return;
          }
          await this.logEvent((msg as any).event, sender.tab?.id);
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
              data: {
                managedPolicies,
                enterpriseConfig,
                isManaged: Object.keys(managedPolicies as any).length > 0,
              }
            });
          } catch (error) {
            logger.error('Check: Failed to get policies:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'GET_STATISTICS':
        case 'GET_STATS':
          try {
            const statistics = await this.getStatistics();
            sendResponse({ success: true, stats: statistics });
          } catch (error) {
            logger.error('Check: Failed to get statistics:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'get_detection_rules':
          try {
            const rules = await this.detectionRulesManager.getDetectionRules();
            const cacheInfo = {
              lastUpdate: this.detectionRulesManager.getLastUpdateTime(),
              isUpdateDue: this.detectionRulesManager.isUpdateDue()
            };
            sendResponse({ success: true, rules, data: cacheInfo });
          } catch (error) {
            logger.error('Check: Failed to get detection rules:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'REFRESH_DETECTION_RULES':
        case 'force_update_detection_rules':
          try {
            const rules = await this.detectionRulesManager.forceUpdate();
            sendResponse({
              success: true,
              rules,
              data: { message: 'Detection rules updated' }
            });
          } catch (error) {
            logger.error('Check: Failed to force update detection rules:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'UPDATE_CONFIG':
        case 'SAVE_CONFIG':
          try {
            const currentConfig = await this.configManager.getConfig();
            const previousBadgeEnabled = currentConfig?.enableValidPageBadge || this.policy?.EnableValidPageBadge;

            await this.configManager.updateConfig((msg as any).config);

            const updatedConfig = await this.configManager.getConfig();
            const newBadgeEnabled = updatedConfig?.enableValidPageBadge || this.policy?.EnableValidPageBadge;

            if (previousBadgeEnabled && !newBadgeEnabled) {
              await this.removeValidBadgesFromAllTabs();
            }

            sendResponse({ success: true, config: updatedConfig });
          } catch (error) {
            logger.error('Check: Failed to update configuration:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'GET_LOGS':
          try {
            const storage = await safe(chrome.storage.local.get(['debugLogs'])) || {};
            const logs = storage.debugLogs || [];
            const filter = (msg as any).filter;
            
            let filteredLogs = logs;
            if (filter && filter !== 'all') {
              filteredLogs = logs.filter((log: any) => log.level === filter);
            }
            
            sendResponse({ success: true, logs: filteredLogs });
          } catch (error) {
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'CLEAR_LOGS':
          try {
            await safe(chrome.storage.local.remove(['debugLogs']));
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
          }
          break;

        case 'log':
          if ('level' in msg && 'message' in msg) {
            await storeLog((msg as any).level, (msg as any).message);
          }
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type: ' + messageType });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

const checkBackground = new CheckBackground();
(globalThis as any).checkBackgroundInstance = checkBackground;