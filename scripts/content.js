/**
 * Check - Content Script
 * Handles page manipulation, monitoring, and security enforcement
 * Enhanced with CyberDrain Microsoft 365 phishing detection
 *
 * NOTE: An early lightweight detection (startDetection) runs before the
 * full DetectionEngine initializes. This quick pass flags obviously
 * suspicious pages, then the full engine performs deeper analysis.
 */

import logger from "./utils/logger.js";

// CyberDrain integration - Precomputed Microsoft login origins
const DEFAULT_TRUSTED_ORIGINS = [
  "https://login.microsoftonline.com",
  "https://login.microsoft.com",
  "https://login.windows.net",
  "https://login.microsoftonline.us",
  "https://login.partner.microsoftonline.cn",
  "https://login.live.com",
];

let trustedOrigins = new Set(DEFAULT_TRUSTED_ORIGINS);
let rulesLoaded = false;

function urlOrigin(u) {
  try {
    return new URL(u).origin.toLowerCase();
  } catch {
    return "";
  }
}

async function ensureRulesLoaded() {
  if (!rulesLoaded) {
    await rulesPromise;
    rulesLoaded = true;
  }
}

async function isTrustedOrigin(u) {
  await ensureRulesLoaded();
  return trustedOrigins.has(urlOrigin(u));
}

async function isTrustedReferrer(ref) {
  if (!ref) return false;
  await ensureRulesLoaded();
  return trustedOrigins.has(urlOrigin(ref));
}

// Load detection rules: prefer cached rules, fall back to bundled JSON
async function loadRulesFast() {
  try {
    const { rulesCached } = await chrome.storage.local.get("rulesCached");
    if (rulesCached && (rulesCached.rules || rulesCached.signals)) {
      return rulesCached;
    }
  } catch {}

  try {
    const res = await fetch(
      chrome.runtime.getURL("rules/detection-rules.json"),
      { cache: "no-cache" }
    );
    return res.ok ? await res.json() : { rules: [], thresholds: {} };
  } catch {
    return { rules: [], thresholds: {} };
  }
}

// Shared promise for detection rules so early scan and main script use same data
const rulesPromise = loadRulesFast().then((rules) => {
  const origins = rules.trusted_origins
    ? rules.trusted_origins.map((u) => urlOrigin(u))
    : DEFAULT_TRUSTED_ORIGINS;
  trustedOrigins = new Set(origins);
  rulesLoaded = true;
  return rules;
});

// Basic rule scoring and block action.
// This is a lightweight early pass; the full DetectionEngine runs later.
async function startDetection(rules) {
  if (await isTrustedOrigin(location.origin)) return;
  if (!rules) return;
  try {
    const html = document.documentElement.outerHTML;
    let score = 0;
    let headersCache = null;

    for (const rule of rules.rules || []) {
      switch (rule.type) {
        case "url":
          if (
            rule.condition?.domains?.some((d) => location.hostname === d)
          ) {
            score += rule.weight || 0;
          }
          break;
        case "form_action": {
          const forms = document.querySelectorAll(
            rule.condition?.form_selector || "form"
          );
          for (const f of forms) {
            if ((f.action || "").includes(rule.condition?.contains || "")) {
              score += rule.weight || 0;
              break;
            }
          }
          break;
        }
        case "dom":
          if (
            rule.condition?.selectors?.some((s) => document.querySelector(s))
          ) {
            score += rule.weight || 0;
          }
          break;
        case "content":
          if (html.includes(rule.condition?.contains || "")) {
            score += rule.weight || 0;
          }
          break;
        case "network": {
          // Treat matching resources from the required domain as legitimate.
          // We intentionally add points only for required domains; non-matching
          // domains simply don't contribute to the score and are handled by the
          // full DetectionEngine.
          const nodes = document.querySelectorAll(
            "[src], link[rel='stylesheet'][href]"
          );
          for (const n of nodes) {
            const url = n.src || n.href;
            if (!url) continue;
            if (url.includes(rule.condition?.network_pattern || "")) {
              if (url.startsWith(rule.condition?.required_domain || "")) {
                score += rule.weight || 0;
              }
              break;
            }
          }
          break;
        }
        case "header": {
          if (!headersCache) {
            headersCache = await new Promise((resolve) => {
              chrome.runtime.sendMessage(
                { type: "GET_PAGE_HEADERS" },
                (resp) => resolve(resp?.headers || {})
              );
            });
          }
          const headerName = rule.condition?.header_name?.toLowerCase();
          const value = headerName ? headersCache[headerName] : undefined;
          let valid = false;
          if (value) {
            if (rule.condition?.required_domains) {
              valid = rule.condition.required_domains.every((d) => {
                const pattern = d
                  .replace(/\*/g, "[^\\s]*")
                  .replace(/\./g, "\\.");
                const regex = new RegExp(pattern, "i");
                return regex.test(value);
              });
            } else if (rule.condition?.allowed_referrers) {
              valid = rule.condition.allowed_referrers.some((r) =>
                value.startsWith(r)
              );
            }
          }
          if (valid) score += rule.weight || 0;
          break;
        }
        default:
          break;
      }
    }

    const threshold = rules.thresholds?.legitimate || 100;
    // Scores accumulate legitimacy points; failing to meet the legitimate
    // threshold marks the page as suspicious during this early pass.
    if (score < threshold) {
      const banner = document.createElement("div");
      banner.className = "check-warning-overlay";
      banner.textContent = "Suspicious page detected";
      document.documentElement.appendChild(banner);
    }
  } catch (e) {
    // ignore rule errors
  }
}

class CheckContent {
  constructor() {
    this.isInitialized = false;
    this.config = null;
    this.observers = [];
    this.securityMonitor = null;
    this.pageAnalyzer = null;
    this.uiManager = null;
    
    // CyberDrain integration
    this.policy = null;
    this.flagged = false;
    this.stopAt = Date.now() + 20000; // watch up to 20s
  }

  async initialize() {
    try {
      logger.log("Check: Initializing content script...");

      // Load configuration from background
      this.config = await this.getConfigFromBackground();
      
      // CyberDrain integration - Request policy from background
      this.policy = await this.getPolicyFromBackground();
      
      // Load detection rules for settings
      this.detectionRules = await rulesPromise;

      // Initialize components
      this.securityMonitor = new SecurityMonitor(this.config);
      this.pageAnalyzer = new PageAnalyzer(this.config);
      this.uiManager = new UIManager(this.config);

      // CyberDrain integration - Initialize detection logic
      await this.initializeCyberDrainDetection();

      // Set up page monitoring
      this.setupPageMonitoring();

      // Set up message handling
      this.setupMessageHandling();

      // Perform initial page analysis
      await this.performInitialAnalysis();

      this.isInitialized = true;
      logger.log("Check: Content script initialized successfully");
    } catch (error) {
      logger.error("Check: Failed to initialize content script:", error);
    }
  }

  // CyberDrain integration - Get policy from background
  async getPolicyFromBackground() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "REQUEST_POLICY" },
        (response) => {
          if (response && response.policy) {
            resolve(response.policy);
          } else {
            resolve(this.getDefaultPolicy());
          }
        }
      );
    });
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

  // CyberDrain integration - Initialize detection logic
  async initializeCyberDrainDetection() {
    const origin = location.origin.toLowerCase();

    // 1) Real Microsoft login → show valid badge (if enabled)
    if (await isTrustedOrigin(origin)) {
      // Check if valid page badge is enabled in settings
      const badgeEnabled = this.config?.enableValidPageBadge ||
                          this.policy?.EnableValidPageBadge ||
                          this.detectionRules?.detection_settings?.enable_verification_badge ||
                          false;
      
      if (badgeEnabled) {
        this.injectValidBadge(this.policy?.ValidPageBadgeImage, this.policy?.BrandingName);
      }
      await this.enforceMicrosoftActionIfConfigured();
      return;
    }

    // 2) Post-login redirect from real login (no password field) → trusted-by-referrer
    if (await isTrustedReferrer(document.referrer) && !this.hasPassword()) {
      chrome.runtime.sendMessage({ type: "FLAG_TRUSTED_BY_REFERRER" });
      return;
    }

    // 3) Live monitor for SPA/dynamic injection (AAD loads content after doc_end)
    this.setupLiveMonitoring();
  }

  // CyberDrain integration - Live monitoring for dynamic content
  setupLiveMonitoring() {
    const observer = new MutationObserver(() => this.evaluateAADFingerprint());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    this.observers.push(observer);
    
    this.evaluateAADFingerprint(); // initial evaluation

    // Stop observing after timeout to reduce overhead
    setTimeout(() => {
      observer.disconnect();
      const index = this.observers.indexOf(observer);
      if (index > -1) this.observers.splice(index, 1);
    }, 20000);
  }

  // CyberDrain integration - Rule-driven AAD fingerprint evaluation
  async evaluateAADFingerprint() {
    if (this.flagged) return;
    
    const origin = location.origin.toLowerCase();
    
    // Request rule-driven analysis from background
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: "ANALYZE_CONTENT_WITH_RULES",
          content: document.documentElement.outerHTML,
          origin: origin
        }, resolve);
      });
      
      if (response && response.success) {
        const analysis = response.analysis;
        
        // Use rule-driven detection results
        if (analysis.aadLike && !(await isTrustedOrigin(origin))) {
          // Check additional rule-based conditions
          const actionCheck = await this.checkFormActions(analysis.detectedElements.password_field);
          const resourceAudit = await this.auditSubresourceOrigins();
          
          const requireAction = this.policy?.RequireMicrosoftAction !== false;
          const strictAudit = this.policy?.StrictResourceAudit !== false;
          
          // Apply rule-based trigger logic
          if (this.shouldTriggerFromRules(analysis, actionCheck, resourceAudit, requireAction, strictAudit)) {
            this.flagged = true;
            this.injectRedBanner(this.policy?.BrandingName, actionCheck, resourceAudit);
            this.lockCredentialInputs();
            this.preventSubmission();
            chrome.runtime.sendMessage({
              type: "FLAG_PHISHY",
              reason: `rule-based-aad-like:${actionCheck.fail?'bad-action':''}:${resourceAudit.nonMicrosoftCount?'bad-assets':''}`
            });
            return;
          }
        }
      }
    } catch (error) {
      logger.error("Check: Rule-driven analysis failed, falling back to basic detection:", error);
      // Fallback to basic detection if rule-driven analysis fails
      await this.evaluateAADFingerprintBasic();
    }
  }

  // Rule-based trigger evaluation
  shouldTriggerFromRules(analysis, actionCheck, resourceAudit, requireAction, strictAudit) {
    // Basic AAD-like detection
    if (analysis.aadLike) return true;
    
    // Form action validation
    if (requireAction && actionCheck.fail) return true;
    
    // Resource audit validation
    if (strictAudit && resourceAudit.nonMicrosoftCount > 0) return true;
    
    return false;
  }

  // Fallback basic detection method
  async evaluateAADFingerprintBasic() {
    const origin = location.origin.toLowerCase();
    
    // Basic AAD fingerprint
    const hasLoginFmt = !!document.querySelector('input[name="loginfmt"], #i0116');
    const hasNextBtn = !!document.querySelector('#idSIButton9');
    const hasPw = this.hasPassword();
    const text = (document.body?.innerText || "").slice(0, 25000);
    const brandingHit = /\b(Microsoft\s*365|Office\s*365|Entra\s*ID|Azure\s*AD|Microsoft)\b/i.test(text);
    const aadLike = (hasLoginFmt && hasNextBtn) || (brandingHit && (hasLoginFmt || hasPw));

    if (aadLike && !(await isTrustedOrigin(origin))) {
      const actionCheck = await this.checkFormActions(hasPw);
      const resourceAudit = await this.auditSubresourceOrigins();
      
      this.flagged = true;
      this.injectRedBanner(this.policy?.BrandingName, actionCheck, resourceAudit);
      this.lockCredentialInputs();
      this.preventSubmission();
      chrome.runtime.sendMessage({
        type: "FLAG_PHISHY",
        reason: `basic-aad-like:${actionCheck.fail?'bad-action':''}:${resourceAudit.nonMicrosoftCount?'bad-assets':''}`
      });
    }
  }

  // CyberDrain integration - Helper methods
  hasPassword() {
    return !!document.querySelector('input[type="password"]');
  }

  async enforceMicrosoftActionIfConfigured() {
    const requireAction = this.policy?.RequireMicrosoftAction !== false;
    if (!requireAction) return;
    const forms = Array.from(document.querySelectorAll("form"));
    const bad = [];

    for (const f of forms) {
      const hasPw = !!f.querySelector('input[type="password"]');
      if (!hasPw) continue;
      const act = this.resolveAction(f.getAttribute("action"));
      if (!(await isTrustedOrigin(act))) bad.push({ action: urlOrigin(act) });
    }

    if (bad.length)
      this.showToast("Unusual: password form posts outside Microsoft login.");
  }

  resolveAction(a) {
    let act = (a || location.href).trim();
    try { act = new URL(act, location.href).href; } catch { act = location.href; }
    return act;
  }

  async checkFormActions(requirePw) {
    const forms = Array.from(document.querySelectorAll("form"));
    const offenders = [];

    for (const f of forms) {
      if (requirePw && !f.querySelector('input[type="password"]')) continue;
      const act = this.resolveAction(f.getAttribute("action"));
      if (!(await isTrustedOrigin(act)))
        offenders.push({ action: act, actionOrigin: urlOrigin(act) });
    }

    return offenders.length
      ? { fail: true, reason: "non-microsoft-form-action", offenders }
      : { fail: false };
  }

  async auditSubresourceOrigins() {
    const nodes = [
      ...document.querySelectorAll('script[src]'),
      ...document.querySelectorAll('link[rel="stylesheet"][href]'),
      ...document.querySelectorAll('img[src]')
    ];

    const origins = new Set();
    const nonMs = new Set();
    const origin = location.origin.toLowerCase();

    for (const el of nodes) {
      const url = el.src || el.href;
      if (!url) continue;
      const o = urlOrigin(new URL(url, location.href).href);
      if (!o) continue;
      origins.add(o);
      // If all assets are on the same fake origin, this may yield 0 — that's fine.
      if (!(await isTrustedOrigin(o)) && o !== origin) nonMs.add(o);
    }

    return {
      origins: Array.from(origins),
      nonMicrosoft: Array.from(nonMs),
      nonMicrosoftCount: nonMs.size
    };
  }

  async getConfigFromBackground() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_CONFIG",
        },
        (response) => {
          if (response && response.success) {
            resolve(response.config);
          } else {
            resolve(this.getDefaultConfig());
          }
        }
      );
    });
  }

  getDefaultConfig() {
    return {
      extensionEnabled: true,
      enableContentManipulation: true,
      enableUrlMonitoring: true,
      showNotifications: true,
      debugMode: false,
    };
  }

  setupPageMonitoring() {
    // Monitor DOM changes
    const domObserver = new MutationObserver((mutations) => {
      this.handleDOMChanges(mutations);
    });

    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href", "action", "onclick"],
    });

    this.observers.push(domObserver);

    // Monitor form submissions
    document.addEventListener("submit", (event) => {
      this.handleFormSubmission(event);
    });

    // Monitor navigation attempts
    document.addEventListener("click", (event) => {
      this.handleLinkClick(event);
    });

    // Monitor script injections
    this.setupScriptMonitoring();
  }

  setupScriptMonitoring() {
    // Override eval to monitor dynamic script execution
    const originalEval = window.eval;
    window.eval = (code) => {
      this.logSecurityEvent({
        type: "dynamic_script_execution",
        code: code.substring(0, 100), // Log first 100 chars only
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });

      // Check if dynamic execution is allowed
      if (this.config.blockDynamicScripts) {
        logger.warn("Check: Dynamic script execution blocked");
        return null;
      }

      return originalEval.call(window, code);
    };

    // Monitor setTimeout/setInterval with code strings
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = (handler, timeout, ...args) => {
      if (typeof handler === "string") {
        this.logSecurityEvent({
          type: "dynamic_timeout_execution",
          code: handler.substring(0, 100),
          url: window.location.href,
          timestamp: new Date().toISOString(),
        });
      }
      return originalSetTimeout.call(window, handler, timeout, ...args);
    };
  }

  setupMessageHandling() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open
    });

    // Expose testing interface to page
    this.exposeTestingInterface();
  }

  async handleTestMessage(data) {
    try {
      // Forward test messages to background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: data.type.replace("CHECK_TEST_", ""),
            ...data.payload,
          },
          resolve
        );
      });

      return response;
    } catch (error) {
      throw error;
    }
  }

  exposeTestingInterface() {
    // Expose testing interface directly in content script context to avoid CSP violations
    // This creates a bridge between page context and extension without inline script injection

    let messageId = 0;
    const pendingMessages = new Map();

    // Define the testing interface that will be accessible from page context
    const testingInterface = {
      sendMessage: function (message) {
        return new Promise((resolve, reject) => {
          const id = ++messageId;
          pendingMessages.set(id, { resolve, reject });

          // Dispatch custom event that content script can catch
          const event = new CustomEvent("checkTestRequest", {
            detail: {
              type: "CHECK_TEST_" + message.type,
              id: id,
              payload: message,
            },
          });
          document.dispatchEvent(event);
        });
      },
    };

    // Inject interface into page context safely using defineProperty
    Object.defineProperty(window, "CheckTesting", {
      value: testingInterface,
      writable: false,
      configurable: false,
    });

    // Listen for test requests from page context
    document.addEventListener("checkTestRequest", async (event) => {
      try {
        const response = await this.handleTestMessage(event.detail);

        // Send response back to page context
        const responseEvent = new CustomEvent("checkTestResponse", {
          detail: {
            id: event.detail.id,
            response: response,
          },
        });
        document.dispatchEvent(responseEvent);
      } catch (error) {
        const errorEvent = new CustomEvent("checkTestResponse", {
          detail: {
            id: event.detail.id,
            error: error.message,
          },
        });
        document.dispatchEvent(errorEvent);
      }
    });

    // Listen for responses in the testing interface
    document.addEventListener("checkTestResponse", (event) => {
      const pending = pendingMessages.get(event.detail.id);
      if (pending) {
        pendingMessages.delete(event.detail.id);

        if (event.detail.error) {
          pending.reject(new Error(event.detail.error));
        } else {
          pending.resolve(event.detail.response);
        }
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case "ANALYZE_PAGE":
          const analysis = await this.pageAnalyzer.analyzePage();
          const urlAnalysis = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: "URL_ANALYSIS_REQUEST",
                url: window.location.href,
              },
              (response) => {
                if (response && response.success && response.analysis) {
                  resolve(response.analysis);
                } else {
                  resolve({});
                }
              }
            );
          });

          if (urlAnalysis.isBlocked !== undefined || urlAnalysis.isSuspicious !== undefined) {
            if (urlAnalysis.isBlocked !== undefined) {
              analysis.isBlocked = analysis.isBlocked || urlAnalysis.isBlocked;
            }
            if (urlAnalysis.isSuspicious !== undefined) {
              analysis.isSuspicious = analysis.isSuspicious || urlAnalysis.isSuspicious;
            }
          }

          sendResponse({ success: true, analysis });
          break;

        case "INJECT_SCRIPT":
          const injectionResult = await this.injectScript(
            message.script,
            message.options
          );
          sendResponse({ success: true, result: injectionResult });
          break;

        case "MANIPULATE_CONTENT":
          const manipulationResult = await this.manipulateContent(
            message.action,
            message.target,
            message.options
          );
          sendResponse({ success: true, result: manipulationResult });
          break;

        case "GET_PAGE_INFO":
          const pageInfo = this.getPageInfo();
          sendResponse({ success: true, info: pageInfo });
          break;

        case "UPDATE_CONFIG":
          this.config = { ...this.config, ...message.config };
          sendResponse({ success: true });
          break;

        case "SHOW_NOTIFICATION":
          this.uiManager.showNotification(message.notification);
          sendResponse({ success: true });
          break;

        case "BLOCK_PAGE":
          this.blockPage(message.reason);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      logger.error("Check: Error handling message:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async performInitialAnalysis() {
    const analysis = await this.pageAnalyzer.analyzePage();

    // Report analysis to background
    chrome.runtime.sendMessage({
      type: "LOG_EVENT",
      event: {
        type: "page_analysis",
        url: window.location.href,
        analysis,
        timestamp: new Date().toISOString(),
      },
    });

    // Take action based on analysis
    if (analysis.threats && analysis.threats.length > 0) {
      this.handleThreatsDetected(analysis.threats);
    }
  }

  handleDOMChanges(mutations) {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        // Check for dynamically added scripts
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.checkNewElement(node);
          }
        });
      } else if (mutation.type === "attributes") {
        // Check for suspicious attribute changes
        this.checkAttributeChange(mutation);
      }
    });
  }

  checkNewElement(element) {
    // Check for script elements
    if (element.tagName === "SCRIPT") {
      this.logSecurityEvent({
        type: "dynamic_script_added",
        src: element.src || "inline",
        content: element.innerHTML.substring(0, 100),
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
    }

    // Check for iframe elements
    if (element.tagName === "IFRAME") {
      this.analyzeIframe(element);
    }

    // Check for form elements
    if (element.tagName === "FORM") {
      this.analyzeForm(element);
    }

    // Recursively check child elements
    element.querySelectorAll("script, iframe, form").forEach((child) => {
      this.checkNewElement(child);
    });
  }

  checkAttributeChange(mutation) {
    const element = mutation.target;
    const attributeName = mutation.attributeName;

    // Check for suspicious attribute changes
    if (["onclick", "onload", "onerror"].includes(attributeName)) {
      this.logSecurityEvent({
        type: "suspicious_attribute_change",
        element: element.tagName,
        attribute: attributeName,
        value: element.getAttribute(attributeName),
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
    }
  }

  handleFormSubmission(event) {
    const form = event.target;

    // Analyze form for potential threats
    const formData = new FormData(form);
    const hasPasswordField = form.querySelector('input[type="password"]');
    const hasEmailField = form.querySelector('input[type="email"]');

    if (hasPasswordField || hasEmailField) {
      // This might be a login form
      this.analyzeLoginForm(form, event);
    }

    // Log form submission
    this.logSecurityEvent({
      type: "form_submission",
      action: form.action,
      method: form.method,
      hasPassword: !!hasPasswordField,
      hasEmail: !!hasEmailField,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  }

  analyzeLoginForm(form, event) {
    // Check if this is a suspicious login form
    const currentDomain = window.location.hostname;
    const formAction = form.action;

    // Check if form submits to different domain
    if (formAction && !formAction.includes(currentDomain)) {
      this.logSecurityEvent({
        type: "suspicious_login_form",
        currentDomain,
        formAction,
        reason: "Cross-domain form submission",
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });

      // Potentially block or warn user
      if (this.config.blockSuspiciousForms) {
        event.preventDefault();
        this.uiManager.showWarning(
          "Suspicious login form detected. Submission blocked."
        );
      }
    }
  }

  handleLinkClick(event) {
    const link = event.target.closest("a");
    if (!link) return;

    const href = link.href;
    if (!href) return;

    // Analyze link for potential threats
    this.analyzeLinkSafety(href, event);
  }

  async analyzeLinkSafety(url, event) {
    // Request URL analysis from background
    chrome.runtime.sendMessage(
      {
        type: "URL_ANALYSIS_REQUEST",
        url,
      },
      (response) => {
        if (response && response.success && response.analysis) {
          if (response.analysis.isBlocked) {
            event.preventDefault();
            this.uiManager.showBlockedLinkWarning(
              url,
              response.analysis.reason
            );
          } else if (response.analysis.isSuspicious) {
            // Show warning but allow navigation
            this.uiManager.showSuspiciousLinkWarning(
              url,
              response.analysis.reason
            );
          }
        }
      }
    );
  }

  async injectScript(script, options = {}) {
    try {
      // Check if script injection is allowed
      const policyCheck = await this.checkPolicy("SCRIPT_INJECTION", {
        domain: window.location.hostname,
        hasCSP: this.hasContentSecurityPolicy(),
      });

      if (!policyCheck.allowed) {
        throw new Error(`Script injection blocked: ${policyCheck.reason}`);
      }

      // Create and inject script element
      const scriptElement = document.createElement("script");

      if (options.src) {
        scriptElement.src = options.src;
      } else {
        scriptElement.textContent = script;
      }

      if (options.async) {
        scriptElement.async = true;
      }

      if (options.defer) {
        scriptElement.defer = true;
      }

      document.head.appendChild(scriptElement);

      this.logSecurityEvent({
        type: "script_injection",
        src: options.src || "inline",
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      logger.error("Check: Script injection failed:", error);
      return { success: false, error: error.message };
    }
  }

  async manipulateContent(action, target, options = {}) {
    try {
      // Check if content manipulation is allowed
      const policyCheck = await this.checkPolicy("CONTENT_MANIPULATION", {
        domain: window.location.hostname,
        manipulationType: action,
      });

      if (!policyCheck.allowed) {
        throw new Error(`Content manipulation blocked: ${policyCheck.reason}`);
      }

      let result;

      switch (action) {
        case "hide_element":
          result = this.hideElement(target, options);
          break;
        case "show_element":
          result = this.showElement(target, options);
          break;
        case "modify_text":
          result = this.modifyText(target, options.text);
          break;
        case "inject_css":
          result = this.injectCSS(options.css);
          break;
        case "remove_element":
          result = this.removeElement(target);
          break;
        default:
          throw new Error(`Unknown manipulation action: ${action}`);
      }

      this.logSecurityEvent({
        type: "content_manipulation",
        action,
        target: typeof target === "string" ? target : target.tagName,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      logger.error("Check: Content manipulation failed:", error);
      return { success: false, error: error.message };
    }
  }

  hideElement(selector, options = {}) {
    const elements =
      typeof selector === "string"
        ? document.querySelectorAll(selector)
        : [selector];

    elements.forEach((element) => {
      if (element) {
        element.style.display = "none";
        if (options.addToHiddenList) {
          element.dataset.checkHidden = "true";
        }
      }
    });

    return { success: true, hiddenCount: elements.length };
  }

  showElement(selector, options = {}) {
    const elements =
      typeof selector === "string"
        ? document.querySelectorAll(selector)
        : [selector];

    elements.forEach((element) => {
      if (element) {
        element.style.display = "";
        delete element.dataset.checkHidden;
      }
    });

    return { success: true, shownCount: elements.length };
  }

  modifyText(selector, newText) {
    const elements =
      typeof selector === "string"
        ? document.querySelectorAll(selector)
        : [selector];

    elements.forEach((element) => {
      if (element) {
        element.textContent = newText;
      }
    });

    return { success: true, modifiedCount: elements.length };
  }

  injectCSS(css) {
    const style = document.createElement("style");
    style.textContent = css;
    style.dataset.checkInjected = "true";
    document.head.appendChild(style);

    return { success: true };
  }

  removeElement(selector) {
    const elements =
      typeof selector === "string"
        ? document.querySelectorAll(selector)
        : [selector];

    elements.forEach((element) => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    return { success: true, removedCount: elements.length };
  }

  async checkPolicy(action, context) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "POLICY_CHECK",
          action,
          context,
        },
        (response) => {
          if (response && response.success) {
            resolve({
              allowed: response.allowed,
              reason: response.reason,
            });
          } else {
            resolve({ allowed: false, reason: "Policy check failed" });
          }
        }
      );
    });
  }

  getPageInfo() {
    return {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      protocol: window.location.protocol,
      hasPasswordFields:
        document.querySelectorAll('input[type="password"]').length > 0,
      hasFormsWithAction: document.querySelectorAll("form[action]").length > 0,
      hasExternalScripts:
        document.querySelectorAll('script[src]:not([src^="/"])').length > 0,
      hasIframes: document.querySelectorAll("iframe").length > 0,
      hasMetaRefresh:
        document.querySelector('meta[http-equiv="refresh"]') !== null,
      contentSecurityPolicy: this.getContentSecurityPolicy(),
    };
  }

  hasContentSecurityPolicy() {
    return !!this.getContentSecurityPolicy();
  }

  getContentSecurityPolicy() {
    const cspMeta = document.querySelector(
      'meta[http-equiv="Content-Security-Policy"]'
    );
    return cspMeta ? cspMeta.getAttribute("content") : null;
  }

  analyzeIframe(iframe) {
    this.logSecurityEvent({
      type: "iframe_detected",
      src: iframe.src,
      sandbox: iframe.getAttribute("sandbox"),
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  }

  analyzeForm(form) {
    const hasPasswordField = form.querySelector('input[type="password"]');
    const hasFileField = form.querySelector('input[type="file"]');

    this.logSecurityEvent({
      type: "form_detected",
      action: form.action,
      method: form.method,
      hasPassword: !!hasPasswordField,
      hasFileUpload: !!hasFileField,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  }

  handleThreatsDetected(threats) {
    threats.forEach((threat) => {
      if (threat.severity === "high") {
        this.uiManager.showCriticalAlert(threat);
      } else if (threat.severity === "medium") {
        this.uiManager.showWarning(threat);
      } else {
        this.uiManager.showInfo(threat);
      }
    });
  }

  blockPage(reason) {
    // Create overlay to block page content
    const overlay = document.createElement("div");
    overlay.className = "check-block-overlay";
    
    const content = document.createElement("div");
    content.className = "check-block-content";
    
    const title = document.createElement("h1");
    title.textContent = "Access Blocked";
    
    const message = document.createElement("p");
    message.textContent = reason;
    
    const goBackBtn = document.createElement("button");
    goBackBtn.textContent = "Go Back";
    goBackBtn.onclick = () => window.history.back();
    
    const continueBtn = document.createElement("button");
    continueBtn.textContent = "Continue Anyway";
    continueBtn.className = "secondary-btn";
    continueBtn.onclick = () => overlay.remove();
    
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(goBackBtn);
    content.appendChild(continueBtn);
    overlay.appendChild(content);

    document.body.appendChild(overlay);
  }

  logSecurityEvent(event) {
    chrome.runtime.sendMessage({
      type: "LOG_EVENT",
      event,
    });
  }

  destroy() {
    // Clean up observers
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];

    // Remove injected styles
    document
      .querySelectorAll("style[data-cyber-shield-injected]")
      .forEach((style) => {
        style.remove();
      });

    logger.log("Check: Content script destroyed");
  }
}

// Helper classes
class SecurityMonitor {
  constructor(config) {
    this.config = config;
  }
}

class PageAnalyzer {
  constructor(config) {
    this.config = config;
  }

  async analyzePage() {
    const analysis = {
      url: window.location.href,
      title: document.title,
      threats: [],
      hasPasswordFields:
        document.querySelectorAll('input[type="password"]').length > 0,
      hasFileUploads:
        document.querySelectorAll('input[type="file"]').length > 0,
      hasExternalResources: this.checkExternalResources(),
      hasSuspiciousScripts: this.checkSuspiciousScripts(),
      hasFormsWithExternalAction: this.checkExternalFormActions(),
      contentSecurityPolicy: this.getCSP(),
      timestamp: new Date().toISOString(),
    };

    // Detect potential threats
    if (analysis.hasSuspiciousScripts) {
      analysis.threats.push({
        type: "suspicious_scripts",
        severity: "medium",
        description: "Potentially malicious JavaScript detected",
      });
    }

    if (analysis.hasFormsWithExternalAction) {
      analysis.threats.push({
        type: "external_form_action",
        severity: "medium",
        description: "Form submitting to external domain detected",
      });
    }

    analysis.isSuspicious = analysis.threats.length > 0;

    return analysis;
  }

  checkExternalResources() {
    const currentDomain = window.location.hostname;
    const externalResources = document.querySelectorAll(
      "script[src], link[href], img[src]"
    );

    return Array.from(externalResources).some((element) => {
      const src = element.src || element.href;
      if (!src) return false;

      try {
        const url = new URL(src);
        return url.hostname !== currentDomain;
      } catch {
        return false;
      }
    });
  }

  checkSuspiciousScripts() {
    const scripts = document.querySelectorAll("script");
    const suspiciousPatterns = [
      /eval\s*\(/,
      /document\.write\s*\(/,
      /location\.replace\s*\(/,
      /window\.open\s*\(/,
    ];

    return Array.from(scripts).some((script) => {
      return suspiciousPatterns.some((pattern) =>
        pattern.test(script.innerHTML)
      );
    });
  }

  checkExternalFormActions() {
    const currentDomain = window.location.hostname;
    const forms = document.querySelectorAll("form[action]");

    return Array.from(forms).some((form) => {
      try {
        const actionUrl = new URL(form.action, window.location.href);
        return actionUrl.hostname !== currentDomain;
      } catch {
        return false;
      }
    });
  }

  getCSP() {
    const cspMeta = document.querySelector(
      'meta[http-equiv="Content-Security-Policy"]'
    );
    return cspMeta ? cspMeta.getAttribute("content") : null;
  }
}

class UIManager {
  constructor(config) {
    this.config = config;
    this.notifications = [];
  }

  showNotification(notification) {
    if (!this.config.showNotifications) return;

    const notificationElement = this.createNotificationElement(notification);
    document.body.appendChild(notificationElement);

    // Auto-remove after duration
    setTimeout(() => {
      notificationElement.remove();
    }, notification.duration || this.config.notificationDuration || 5000);
  }

  showWarning(message) {
    this.showNotification({
      type: "warning",
      message: typeof message === "string" ? message : message.description,
      duration: 8000,
    });
  }

  showCriticalAlert(threat) {
    this.showNotification({
      type: "error",
      message: `Critical threat detected: ${threat.description}`,
      duration: 10000,
    });
  }

  showInfo(message) {
    this.showNotification({
      type: "info",
      message: typeof message === "string" ? message : message.description,
      duration: 5000,
    });
  }

  showBlockedLinkWarning(url, reason) {
    this.showNotification({
      type: "error",
      message: `Link blocked: ${reason}`,
      duration: 8000,
    });
  }

  showSuspiciousLinkWarning(url, reason) {
    this.showNotification({
      type: "warning",
      message: `Suspicious link detected: ${reason}`,
      duration: 6000,
    });
  }

  createNotificationElement(notification) {
    const element = document.createElement("div");
    element.className = `check-notification ${notification.type}`;
    
    // Create title and message structure
    if (notification.title) {
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = notification.title;
      element.appendChild(title);
    }
    
    const message = document.createElement("div");
    message.className = "message";
    message.textContent = notification.message;
    element.appendChild(message);
    
    // Add close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = () => element.remove();
    element.appendChild(closeBtn);

    return element;
  }


}

// CyberDrain integration - UI methods for badges and warnings
CheckContent.prototype.injectValidBadge = function(customImg, branding) {
  const id = "__cd_valid_login_badge";
  if (document.getElementById(id)) return;
  
  const wrap = document.createElement("div");
  wrap.id = id;
  wrap.className = "check-security-badge";
  
  if (customImg) {
    const img = document.createElement("img");
    img.src = customImg;
    img.alt = "Valid Microsoft login";
    wrap.appendChild(img);
  } else {
    wrap.innerHTML = '<svg viewBox="0 0 24 24" width="40" height="40"><circle cx="12" cy="12" r="11" fill="#0a5"/><path d="M6 12l4 4 8-8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  
  const label = document.createElement("div");
  label.textContent = (branding || "Microsoft 365 Phishing Protection") + " • Valid M365 Login";
  wrap.appendChild(label);
  document.documentElement.appendChild(wrap);
};

CheckContent.prototype.injectRedBanner = function(branding, actionCheck, resourceAudit) {
  if (document.getElementById("__cd_banner")) return;
  
  const el = document.createElement("div");
  el.id = "__cd_banner";
  el.className = "check-warning-overlay";
  
  let msg = (branding || "Microsoft 365 Phishing Protection") + ": Phishing suspected – Microsoft 365 login UI on an untrusted domain.";
  if (actionCheck?.fail) msg += " (Form action not to Microsoft)";
  if (resourceAudit?.nonMicrosoftCount) msg += " (Non-Microsoft subresources present)";
  
  el.textContent = msg;
  document.documentElement.appendChild(el);
  
  if (document.body) document.body.style.paddingTop = (parseInt(getComputedStyle(el).height,10) + 8) + "px";
};

CheckContent.prototype.lockCredentialInputs = function() {
  const suspects = [
    'input[type="password"]','input[name="passwd"]','input[name="Password"]','input[name="password"]',
    'input[name="loginfmt"]', '#i0116' // lock username too
  ];
  
  const fields = Array.from(document.querySelectorAll(suspects.join(",")));
  for (const el of fields) {
    try {
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("autocomplete", "off");
      el.setAttribute("readonly", "true");
      el.disabled = true;
      el.style.filter = "grayscale(1)";
      el.style.opacity = "0.6";
      el.style.pointerEvents = "none";
    } catch {}
  }
  
  const msg = document.createElement("div");
  msg.textContent = "⚠️ Disabled by Microsoft 365 Phishing Protection";
  msg.style.cssText = "font:13px/1.4 system-ui;color:#a00;margin-top:6px;";
  
  const pw = document.querySelector('input[type="password"]');
  if (pw) pw.insertAdjacentElement("afterend", msg);
  else if (document.body) document.body.appendChild(msg);
};

CheckContent.prototype.preventSubmission = function() {
  document.addEventListener("submit", (e) => {
    e.stopImmediatePropagation();
    e.preventDefault();
    this.showToast("Blocked form submission: not the official Microsoft login domain.");
  }, true);
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const t = e.target;
      if (t && t.tagName === "INPUT") {
        e.stopImmediatePropagation();
        e.preventDefault();
        this.showToast("Blocked: not the official Microsoft login domain.");
      }
    }
  }, true);
};

CheckContent.prototype.showToast = function(msg) {
  const t = document.createElement("div");
  t.className = "check-notification info";
  
  const message = document.createElement("div");
  message.className = "message";
  message.textContent = msg;
  t.appendChild(message);
  
  if (document.body) document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

// Start detection early using locally loaded rules
(async () => {
  const rules = await rulesPromise;
  const run = () => startDetection(rules);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();

// Initialize content script (prevent multiple initializations)
if (!window.checkContentInitialized) {
  window.checkContentInitialized = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      const check = new CheckContent();
      check.initialize();
    });
  } else {
    const check = new CheckContent();
    check.initialize();
  }
}
