/**
 * Check - Background Service Worker
 * Handles core extension functionality, policy enforcement, and threat detection
 * Enhanced with CyberDrain Microsoft 365 phishing detection
 */

import { ConfigManager } from "./modules/config-manager.js";
import { DetectionEngine } from "./modules/detection-engine.js";
import { PolicyManager } from "./modules/policy-manager.js";
import logger from "./utils/logger.js";
import { store as storeLog } from "./utils/background-logger.js";

// Initialize logger with default settings before any components use it
logger.init({ level: "info", enabled: true });
logger.log("Check: Background service worker loaded");

class CheckBackground {
  constructor() {
    this.configManager = new ConfigManager();
    this.detectionEngine = new DetectionEngine();
    this.policyManager = new PolicyManager();
    this.isInitialized = false;

    // CyberDrain integration
    this.policy = null;
    this.extraWhitelist = new Set();
    this.tabHeaders = new Map();
    this.HEADER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    this.MAX_HEADER_CACHE_ENTRIES = 100;

    // Set up message handlers immediately to handle early connections
    logger.log("Check: Registering message handlers");
    this.setupMessageHandlers();
    logger.log("Check: Message handlers registered");
  }

  setupMessageHandlers() {
    // Handle messages from content scripts and popups
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });
  }

  async initialize() {
    logger.log("Check: initialize() start");
    try {
      // Load configuration and initialize logger based on settings
      const config = await this.configManager.loadConfig();
      logger.init({
        level: config?.logLevel || "info",
        enabled: config?.enableLogging ?? true,
      });

      // Load policies and initialize detection engine
      await this.policyManager.loadPolicies();
      await this.detectionEngine.initialize();

      // CyberDrain integration - Load policy
      await this.refreshPolicy();

      this.setupEventListeners();
      this.isInitialized = true;

      logger.log("Check: initialize() complete");
    } catch (error) {
      logger.error("Check: initialize() failed:", error);
    }
  }

  // CyberDrain integration - Policy management
  async refreshPolicy() {
    this.policy = await this.detectionEngine.policy || this.getDefaultPolicy();
    this.extraWhitelist = new Set((this.policy.ExtraWhitelist || []).map(s => this.urlOrigin(s)).filter(Boolean));
    await this.applyBrandingToAction();
  }

  getDefaultPolicy() {
    return {
      BrandingName: "Microsoft 365 Phishing Protection",
      BrandingImage: "",
      ExtraWhitelist: [],
      CIPPReportingServer: "",
      AlertWhenLogon: true,
      ValidPageBadgeImage: "",
      StrictResourceAudit: true,
      RequireMicrosoftAction: true,
      EnableValidPageBadge: false
    };
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
    if (this.detectionEngine.TRUSTED_ORIGINS.has(origin)) return "trusted";
    if (this.extraWhitelist.has(origin)) return "trusted-extra";
    return "unknown";
  }

  // CyberDrain integration - Badge management
  async setBadge(tabId, verdict) {
    const map = {
      "trusted":       { text: "MS", color: "#0a5" },
      "trusted-extra": { text: "OK", color: "#0a5" },
      "phishy":        { text: "!",  color: "#d33" },
      "unknown":       { text: "?",  color: "#777" }
    };
    const cfg = map[verdict] || map.unknown;
    try {
      await chrome.action.setBadgeText({ tabId, text: cfg.text });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color });
    } catch {}
  }

  // CyberDrain integration - Notify tab to show valid badge
  async showValidBadge(tabId) {
    try {
      const config = await this.configManager.getConfig();
      const enabled =
        this.policy?.EnableValidPageBadge ||
        config?.showValidPageBadge ||
        config?.enableValidPageBadge;
      if (enabled) {
        await chrome.tabs.sendMessage(tabId, {
          type: "SHOW_VALID_BADGE",
          image: this.policy?.ValidPageBadgeImage,
          branding: this.policy?.BrandingName,
        });
      }
    } catch {}
  }

  // CyberDrain integration - Apply branding to extension action
  async applyBrandingToAction() {
    // Title
    await chrome.action.setTitle({ title: this.policy.BrandingName || this.getDefaultPolicy().BrandingName });
    
    // Icon (optional)
    if (this.policy.BrandingImage) {
      try {
        const img = await fetch(this.policy.BrandingImage);
        const blob = await img.blob();
        const bmp = await createImageBitmap(blob);
        const sizes = [16, 32, 48, 128];
        const images = {};
        for (const s of sizes) {
          const canvas = new OffscreenCanvas(s, s);
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0,0,s,s);
          ctx.drawImage(bmp, 0, 0, s, s);
          images[String(s)] = ctx.getImageData(0, 0, s, s);
        }
        await chrome.action.setIcon({ imageData: images });
      } catch (e) {
        // ignore icon errors
      }
    }
  }

  // CyberDrain integration - Send event to reporting server
  async sendEvent(evt) {
    if (!this.policy.CIPPReportingServer) return;
    try {
      await fetch(this.policy.CIPPReportingServer.replace(/\/+$/,"") + "/events/cyberdrain-phish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({
          ts: new Date().toISOString(),
          ua: navigator.userAgent
        }, evt))
      });
    } catch {/* best-effort */}
  }

  setupEventListeners() {
    // Handle extension installation/startup
    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });

    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    // Handle tab updates for URL monitoring
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // CyberDrain integration - Handle tab activation for badge updates
    chrome.tabs.onActivated.addListener(async ({ tabId }) => {
      const data = (await chrome.storage.session.get("verdict:" + tabId))["verdict:" + tabId];
      this.setBadge(tabId, data?.verdict || "unknown");
    });

    // Note: Message handler is set up in constructor for immediate availability

    // Handle storage changes (for enterprise policy updates)
    chrome.storage.onChanged.addListener((changes, namespace) => {
      this.handleStorageChange(changes, namespace);
    });

    // Handle web navigation events
    chrome.webNavigation?.onCompleted?.addListener((details) => {
      this.handleNavigationCompleted(details);
    });

    // Capture response headers for top-level requests
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        if (details.tabId >= 0) {
          const headers = {};
          for (const h of details.responseHeaders || []) {
            headers[h.name.toLowerCase()] = h.value;
          }
          this.tabHeaders.set(details.tabId, { headers, ts: Date.now() });
          if (this.tabHeaders.size > this.MAX_HEADER_CACHE_ENTRIES) {
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
        }
      },
      { urls: ["<all_urls>"], types: ["main_frame"] },
      ["responseHeaders"]
    );

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.tabHeaders.delete(tabId);
    });
  }

  async handleStartup() {
    logger.log("Check: Extension startup detected");
    const config = await this.configManager.refreshConfig();
    logger.init({
      level: config?.logLevel || "info",
      enabled: config?.enableLogging ?? true,
    });
  }

  async handleInstalled(details) {
    logger.log("Check: Extension installed/updated:", details.reason);

    if (details.reason === "install") {
      // Set default configuration
      await this.configManager.setDefaultConfig();

      // Open options page for initial setup
      chrome.tabs.create({
        url: chrome.runtime.getURL("options/options.html"),
      });
    } else if (details.reason === "update") {
      // Handle extension updates
      await this.configManager.migrateConfig(details.previousVersion);
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    if (!this.isInitialized) return;

    try {
      // CyberDrain integration - Handle URL changes and set badges
      if (changeInfo.status === "complete" && tab?.url) {
        const verdict = this.verdictForUrl(tab.url);
        await chrome.storage.session.set({ ["verdict:" + tabId]: { verdict, url: tab.url } });
        this.setBadge(tabId, verdict);

        if (verdict === "trusted") {
          // "Valid page" sighting
          await this.sendEvent({ type: "trusted-login-page", url: tab.url });
          this.showValidBadge(tabId);
        }
      }

      if (!changeInfo.url) return;

      // Analyze URL for threats
      const urlAnalysis = await this.detectionEngine.analyzeUrl(changeInfo.url);

      if (urlAnalysis.isBlocked) {
        // Block navigation if URL is flagged
        chrome.tabs.update(tabId, {
          url:
            chrome.runtime.getURL("blocked.html") +
            "?reason=" +
            encodeURIComponent(urlAnalysis.reason),
        });
        return;
      }

      // Check if page requires content script injection
      if (urlAnalysis.requiresContentScript) {
        await this.injectContentScript(tabId);
      }

      // Log URL access for audit purposes
      await this.logUrlAccess(tab.url, tabId);
    } catch (error) {
      logger.error("Check: Error handling tab update:", error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      // Handle both message.type and message.action for compatibility
      const messageType = message.type || message.action;

      switch (messageType) {
        case "ping":
          sendResponse({
            success: true,
            message: "Check background script is running",
            timestamp: new Date().toISOString(),
            initialized: this.isInitialized,
          });
          break;

        // CyberDrain integration - Handle phishing detection
        case "FLAG_PHISHY":
          if (sender.tab?.id) {
            const tabId = sender.tab.id;
            chrome.storage.session.set({ ["verdict:" + tabId]: { verdict: "phishy", url: sender.tab.url } });
            this.setBadge(tabId, "phishy");
            sendResponse({ ok: true });
            this.sendEvent({ type: "phishy-detected", url: sender.tab.url, reason: message.reason || "heuristic" });
          }
          break;

          case "FLAG_TRUSTED_BY_REFERRER":
            if (sender.tab?.id) {
              const tabId = sender.tab.id;
              chrome.storage.session.set({ ["verdict:" + tabId]: { verdict: "trusted", url: sender.tab.url, by: "referrer" } });
              this.setBadge(tabId, "trusted");
              this.showValidBadge(tabId);
              sendResponse({ ok: true });
              if (this.policy.AlertWhenLogon) {
                this.sendEvent({ type: "user-logged-on", url: sender.tab.url, by: "referrer" });
              }
            }
            break;

        case "REQUEST_POLICY":
          sendResponse({ policy: this.policy });
          break;

        case "ANALYZE_CONTENT_WITH_RULES":
          try {
            const analysis = await this.detectionEngine.analyzeContentWithRules(
              message.content,
              { origin: message.origin }
            );
            sendResponse({ success: true, analysis });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "log":
          if (message.level && message.message) {
            await storeLog(message.level, message.message);
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

        case "testDetectionEngine":
          try {
            const detectionTest = {
              rulesLoaded: this.detectionEngine?.detectionRules
                ? Object.keys(this.detectionEngine.detectionRules).length
                : 0,
              engineInitialized: this.detectionEngine?.isInitialized || false,
              testsRun: 0,
            };

            if (message.testData) {
              const testResults = await this.testDetectionRules([
                {
                  id: "quick_test",
                  type: "url_analysis",
                  input: { url: message.testData.url },
                  expected: { analyzed: true },
                },
              ]);
              detectionTest.testsRun = testResults.summary.total;
            }

            sendResponse({
              success: true,
              ...detectionTest,
            });
          } catch (error) {
            sendResponse({
              success: false,
              error: error.message,
            });
          }
          break;

        case "testConfiguration":
          try {
            const configTest = {
              configModules: [],
              initialized: this.isInitialized,
            };

            if (this.configManager)
              configTest.configModules.push("ConfigManager");
            if (this.detectionEngine)
              configTest.configModules.push("DetectionEngine");
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
          const analysis = await this.detectionEngine.analyzeUrl(message.url);
          sendResponse({ success: true, analysis });
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

        case "UPDATE_CONFIG":
          try {
            await this.configManager.updateConfig(message.config);
            sendResponse({ success: true });
          } catch (error) {
            logger.error("Check: Failed to update config:", error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case "TEST_DETECTION_RULES":
          const testResults = await this.testDetectionRules(message.testData);
          sendResponse({ success: true, results: testResults });
          break;

        case "VALIDATE_DETECTION_ENGINE":
          const validationResults = await this.validateDetectionEngine();
          sendResponse({ success: true, validation: validationResults });
          break;

        case "RUN_COMPREHENSIVE_TEST":
          const comprehensiveResults = await this.runComprehensiveTest();
          sendResponse({ success: true, tests: comprehensiveResults });
          break;

        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      logger.error("Check: Error handling message:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleStorageChange(changes, namespace) {
    if (namespace === "managed") {
      // Enterprise policy changes
      logger.log("Check: Enterprise policy updated");
      await this.policyManager.loadPolicies();
      const config = await this.configManager.refreshConfig();
      logger.init({
        level: config?.logLevel || "info",
        enabled: config?.enableLogging ?? true,
      });
      // CyberDrain integration - Refresh policy
      await this.refreshPolicy();
    }
  }

  async handleNavigationCompleted(details) {
    if (details.frameId === 0) {
      // Main frame only
      // Run post-navigation analysis
      await this.detectionEngine.analyzePageContent(details.tabId, details.url);
    }
  }

  async injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["scripts/content.js"],
      });
    } catch (error) {
      logger.error("Check: Failed to inject content script:", error);
    }
  }

  async logUrlAccess(url, tabId) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      url,
      tabId,
      type: "url_access",
    };

    // Store in local storage for audit
    const result = await chrome.storage.local.get(["accessLogs"]);
    const logs = result.accessLogs || [];
    logs.push(logEntry);

    // Keep only last 1000 entries
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }

    await chrome.storage.local.set({ accessLogs: logs });
  }

  async logEvent(event, tabId) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      tabId,
      type: "security_event",
    };

    logger.log("Check: Security Event:", logEntry);

    // Store security events separately
    const result = await chrome.storage.local.get(["securityEvents"]);
    const logs = result.securityEvents || [];
    logs.push(logEntry);

    // Keep only last 500 security events
    if (logs.length > 500) {
      logs.splice(0, logs.length - 500);
    }

    await chrome.storage.local.set({ securityEvents: logs });
  }

  // Detection Rules Testing Methods
  async testDetectionRules(testData = null) {
    const results = {
      timestamp: new Date().toISOString(),
      engineStatus: this.isInitialized,
      rulesLoaded: this.detectionEngine.detectionRules !== null,
      testResults: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
    };

    // Default test cases if none provided
    if (!testData) {
      testData = this.getDefaultTestCases();
    }

    for (const testCase of testData) {
      const testResult = await this.runSingleTest(testCase);
      results.testResults.push(testResult);
      results.summary.total++;

      if (testResult.status === "passed") {
        results.summary.passed++;
      } else if (testResult.status === "failed") {
        results.summary.failed++;
      } else {
        results.summary.warnings++;
      }
    }

    // Log test results
    await this.logEvent({
      type: "detection_rules_test",
      results: results.summary,
    });

    return results;
  }

  async runSingleTest(testCase) {
    const result = {
      testId: testCase.id,
      description: testCase.description,
      type: testCase.type,
      input: testCase.input,
      expected: testCase.expected,
      actual: null,
      status: "unknown",
      message: "",
      timestamp: new Date().toISOString(),
    };

    try {
      switch (testCase.type) {
        case "url_analysis":
          result.actual = await this.detectionEngine.analyzeUrl(
            testCase.input.url
          );
          break;
        case "content_analysis":
          result.actual = await this.detectionEngine.analyzeContent(
            testCase.input.content,
            testCase.input.context
          );
          break;
        case "form_analysis":
          result.actual = await this.detectionEngine.analyzeForm(
            testCase.input.formData
          );
          break;
        case "header_analysis":
          result.actual = await this.detectionEngine.analyzeHeaders(
            testCase.input.headers
          );
          break;
        case "referrer_check":
          result.actual = await this.detectionEngine.validateReferrer(
            testCase.input.referrer
          );
          break;
        default:
          result.status = "failed";
          result.message = `Unknown test type: ${testCase.type}`;
          return result;
      }

      // Compare results
      if (this.compareTestResults(result.expected, result.actual)) {
        result.status = "passed";
        result.message = "Test passed successfully";
      } else {
        result.status = "failed";
        result.message = `Expected: ${JSON.stringify(
          result.expected
        )}, Got: ${JSON.stringify(result.actual)}`;
      }
    } catch (error) {
      result.status = "failed";
      result.message = `Test execution failed: ${error.message}`;
      result.actual = { error: error.message };
    }

    return result;
  }

  async validateDetectionEngine() {
    const validation = {
      timestamp: new Date().toISOString(),
      engineInitialized: this.isInitialized,
      detectionEngineStatus: this.detectionEngine ? "loaded" : "not_loaded",
      rulesValidation: {},
      componentsStatus: {},
      configurationStatus: {},
    };

    try {
      // Validate rules structure
      validation.rulesValidation = await this.validateRulesStructure();

      // Validate components
      validation.componentsStatus = await this.validateComponents();

      // Validate configuration
      validation.configurationStatus = await this.validateConfiguration();
    } catch (error) {
      validation.error = error.message;
    }

    return validation;
  }

  async runComprehensiveTest() {
    const comprehensiveResults = {
      timestamp: new Date().toISOString(),
      testSuites: [],
    };

    // Test Suite 1: Microsoft Authentication Detection
    const msAuthTests = await this.testMicrosoftAuthDetection();
    comprehensiveResults.testSuites.push({
      suite: "Microsoft Authentication Detection",
      results: msAuthTests,
    });

    // Test Suite 2: Phishing Detection
    const phishingTests = await this.testPhishingDetection();
    comprehensiveResults.testSuites.push({
      suite: "Phishing Detection",
      results: phishingTests,
    });

    // Test Suite 3: Referrer Validation
    const referrerTests = await this.testReferrerValidation();
    comprehensiveResults.testSuites.push({
      suite: "Referrer Validation",
      results: referrerTests,
    });

    // Test Suite 4: Content Security Policy
    const cspTests = await this.testCSPValidation();
    comprehensiveResults.testSuites.push({
      suite: "Content Security Policy Validation",
      results: cspTests,
    });

    return comprehensiveResults;
  }

  getDefaultTestCases() {
    return [
      {
        id: "legitimate_microsoft_url",
        description: "Test legitimate Microsoft login URL",
        type: "url_analysis",
        input: {
          url: "https://login.microsoftonline.com/common/oauth2/authorize",
        },
        expected: { isLegitimate: true, threat_level: "none" },
      },
      {
        id: "phishing_microsoft_url",
        description: "Test phishing URL mimicking Microsoft",
        type: "url_analysis",
        input: { url: "https://secure-microsoft-login.com/oauth2/authorize" },
        expected: { isLegitimate: false, threat_level: "high" },
      },
      {
        id: "valid_referrer",
        description: "Test valid referrer from allow list",
        type: "referrer_check",
        input: { referrer: "https://tasks.office.com" },
        expected: { isValid: true },
      },
      {
        id: "invalid_referrer",
        description: "Test invalid referrer not in allow list",
        type: "referrer_check",
        input: { referrer: "https://evil-site.com" },
        expected: { isValid: false },
      },
      {
        id: "legitimate_form_elements",
        description: "Test legitimate Microsoft form elements",
        type: "content_analysis",
        input: {
          content:
            '<input name="loginfmt"><input name="idPartnerPL"><script>var urlMsaSignUp = "...";</script>',
          context: "form_analysis",
        },
        expected: { hasRequiredElements: true, legitimacyLevel: "high" },
      },
    ];
  }

  compareTestResults(expected, actual) {
    // Simple comparison logic - can be enhanced based on test requirements
    if (typeof expected === "object" && typeof actual === "object") {
      for (const key in expected) {
        if (expected[key] !== actual[key]) {
          return false;
        }
      }
      return true;
    }
    return expected === actual;
  }

  async validateRulesStructure() {
    const validation = {
      hasRules: false,
      rulesCount: 0,
      validRules: 0,
      invalidRules: 0,
      issues: [],
    };

    try {
      if (!this.detectionEngine.detectionRules) {
        validation.issues.push("Detection rules not loaded");
        return validation;
      }

      const rules = this.detectionEngine.detectionRules;
      validation.hasRules = true;

      if (rules.rules && Array.isArray(rules.rules)) {
        validation.rulesCount = rules.rules.length;

        for (const rule of rules.rules) {
          if (this.validateSingleRule(rule)) {
            validation.validRules++;
          } else {
            validation.invalidRules++;
            validation.issues.push(`Invalid rule: ${rule.id || "unnamed"}`);
          }
        }
      }
    } catch (error) {
      validation.issues.push(`Validation error: ${error.message}`);
    }

    return validation;
  }

  validateSingleRule(rule) {
    const requiredFields = ["id", "type", "weight", "condition", "description"];
    return requiredFields.every((field) => field in rule);
  }

  async validateComponents() {
    return {
      configManager: this.configManager ? "loaded" : "not_loaded",
      detectionEngine: this.detectionEngine ? "loaded" : "not_loaded",
      policyManager: this.policyManager ? "loaded" : "not_loaded",
      detectionEngineInitialized: this.detectionEngine?.isInitialized || false,
    };
  }

  async validateConfiguration() {
    const config = await this.configManager.getConfig();
    return {
      configLoaded: !!config,
      hasValidReferrers: config?.valid_referrers?.referrers?.length > 0,
      hasWhitelistDomains: config?.whitelist_domains?.length > 0,
      detectionEnabled: config?.detection_settings?.enable_real_time_scanning,
    };
  }

  async testMicrosoftAuthDetection() {
    const testCases = [
      "https://login.microsoftonline.com",
      "https://fake-microsoft-login.com",
      "https://login.microsoft.com",
      "https://secure-office365-login.phishing.com",
    ];

    const results = [];
    for (const url of testCases) {
      try {
        const analysis = await this.detectionEngine.analyzeUrl(url);
        results.push({
          url,
          analysis,
          expected:
            url.includes("microsoftonline.com") ||
            url.includes("microsoft.com"),
          passed: this.evaluateMicrosoftAuthResult(url, analysis),
        });
      } catch (error) {
        results.push({
          url,
          error: error.message,
          passed: false,
        });
      }
    }
    return results;
  }

  async testPhishingDetection() {
    const phishingUrls = [
      "https://secure-microsoft365.com/login",
      "https://office-security-update.com",
      "https://microsoft-account-verify.net",
    ];

    const results = [];
    for (const url of phishingUrls) {
      try {
        const analysis = await this.detectionEngine.analyzeUrl(url);
        results.push({
          url,
          analysis,
          expected: "blocked_or_flagged",
          passed: analysis.isBlocked || analysis.threat_level === "high",
        });
      } catch (error) {
        results.push({
          url,
          error: error.message,
          passed: false,
        });
      }
    }
    return results;
  }

  async testReferrerValidation() {
    const validReferrers = [
      "https://login.microsoftonline.com",
      "https://tasks.office.com",
      "https://login.microsoft.net",
    ];

    const invalidReferrers = [
      "https://evil-site.com",
      "https://phishing-microsoft.com",
      "https://fake-office.net",
    ];

    const results = [];

    for (const referrer of validReferrers) {
      const isValid = await this.detectionEngine.validateReferrer(referrer);
      results.push({
        referrer,
        expected: true,
        actual: isValid,
        passed: isValid === true,
      });
    }

    for (const referrer of invalidReferrers) {
      const isValid = await this.detectionEngine.validateReferrer(referrer);
      results.push({
        referrer,
        expected: false,
        actual: isValid,
        passed: isValid === false,
      });
    }

    return results;
  }

  async testCSPValidation() {
    const validCSP =
      "content-security-policy-report-only: default-src 'self'; connect-src https://*.msauth.net/ https://*.microsoft.com/";
    const invalidCSP =
      "content-security-policy-report-only: default-src 'self'; connect-src https://evil-site.com/";

    const results = [];

    try {
      const validResult = await this.detectionEngine.validateCSP(validCSP);
      results.push({
        csp: validCSP,
        expected: true,
        actual: validResult,
        passed: validResult === true,
      });

      const invalidResult = await this.detectionEngine.validateCSP(invalidCSP);
      results.push({
        csp: invalidCSP,
        expected: false,
        actual: invalidResult,
        passed: invalidResult === false,
      });
    } catch (error) {
      results.push({
        error: error.message,
        passed: false,
      });
    }

    return results;
  }

  evaluateMicrosoftAuthResult(url, analysis) {
    const isLegitimateUrl =
      url.includes("microsoftonline.com") || url.includes("microsoft.com");

    if (isLegitimateUrl) {
      return !analysis.isBlocked && analysis.threat_level !== "high";
    } else {
      return analysis.isBlocked || analysis.threat_level === "high";
    }
  }
}

// Initialize the background service worker
const check = new CheckBackground();
check.initialize();

// Export for testing purposes
if (typeof module !== "undefined" && module.exports) {
  module.exports = CheckBackground;
}
