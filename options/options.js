/**
 * Check - Options Page JavaScript
 * Comprehensive settings management and configuration interface
 */

class CheckOptions {
  constructor() {
    this.config = null;
    this.brandingConfig = null;
    this.originalConfig = null;
    this.hasUnsavedChanges = false;
    this.currentSection = "general";
    this.configViewMode = "formatted"; // "formatted" or "raw"
    this.currentConfigData = null;
    this.isEnterpriseManaged = false; // Track enterprise management state
    this.simulateEnterpriseMode = false; // Track simulated enterprise mode (dev only)

    this.elements = {};
    this.bindElements();
    this.setupEventListeners();
    this.initialize();
  }

  bindElements() {
    // Navigation
    this.elements.menuItems = document.querySelectorAll(".menu-item");
    this.elements.sections = document.querySelectorAll(".settings-section");
    this.elements.pageTitle = document.getElementById("pageTitle");
    this.elements.policyBadge = document.getElementById("policyBadge");
    this.elements.sidebar = document.querySelector(".sidebar");
    this.elements.mobileMenuToggle =
      document.getElementById("mobileMenuToggle");
    this.elements.mobileTitleText = document.getElementById("mobileTitleText");
    this.elements.mobileSubtitleText =
      document.getElementById("mobileSubtitleText");

    // Header actions
    this.elements.saveSettings = document.getElementById("saveSettings");
    this.elements.darkModeToggle = document.getElementById("darkModeToggle");

    // General settings
    this.elements.extensionEnabled =
      document.getElementById("extensionEnabled");
    this.elements.enableContentManipulation = document.getElementById(
      "enableContentManipulation"
    );
    this.elements.enableUrlMonitoring = document.getElementById(
      "enableUrlMonitoring"
    );
    this.elements.showNotifications =
      document.getElementById("showNotifications");
    this.elements.enableValidPageBadge = document.getElementById(
      "enableValidPageBadge"
    );
    this.elements.validPageBadgeTimeout = document.getElementById(
      "validPageBadgeTimeout"
    );

    // Detection settings
    this.elements.customRulesUrl = document.getElementById("customRulesUrl");
    this.elements.updateInterval = document.getElementById("updateInterval");
    this.elements.urlAllowlist = document.getElementById("urlAllowlist");
    this.elements.refreshDetectionRules = document.getElementById(
      "refreshDetectionRules"
    );
    this.elements.configDisplay = document.getElementById("configDisplay");
    this.elements.toggleConfigView =
      document.getElementById("toggleConfigView");

    // Rule Playground elements
    this.elements.playgroundRulesInput = document.getElementById("playgroundRulesInput");
    this.elements.playgroundTestUrl = document.getElementById("playgroundTestUrl");
    this.elements.playgroundHtmlInput = document.getElementById("playgroundHtmlInput");
    this.elements.playgroundResults = document.getElementById("playgroundResults");
    this.elements.runRuleTestBtn = document.getElementById("runRuleTestBtn");
    this.elements.validateRulesBtn = document.getElementById("validateRulesBtn");
    this.elements.sanitizeRulesBtn = document.getElementById("sanitizeRulesBtn");
    this.elements.copyRulesBtn = document.getElementById("copyRulesBtn");
    this.elements.clearPlaygroundBtn = document.getElementById("clearPlaygroundBtn");
    this.elements.loadCurrentRulesBtn = document.getElementById("loadCurrentRulesBtn");

    this.elements.enableDeveloperConsoleLogging = document.getElementById(
      "enableDeveloperConsoleLogging"
    );
    this.elements.simulateEnterpriseMode = document.getElementById(
      "simulateEnterpriseMode"
    );

    // Logs
    this.elements.logFilter = document.getElementById("logFilter");
    this.elements.refreshLogs = document.getElementById("refreshLogs");
    this.elements.clearLogs = document.getElementById("clearLogs");
    this.elements.exportLogs = document.getElementById("exportLogs");
    this.elements.logsList = document.getElementById("logsList");

    // Branding
    this.elements.companyName = document.getElementById("companyName");
    this.elements.companyURL = document.getElementById("companyURL");
    this.elements.productName = document.getElementById("productName");
    this.elements.supportEmail = document.getElementById("supportEmail");
    this.elements.primaryColor = document.getElementById("primaryColor");
    this.elements.logoUrl = document.getElementById("logoUrl");
    this.elements.brandingPreview = document.getElementById("brandingPreview");
    this.elements.previewLogo = document.getElementById("previewLogo");
    this.elements.previewTitle = document.getElementById("previewTitle");
    this.elements.previewButton = document.getElementById("previewButton");

    // About section
    this.elements.extensionVersion =
      document.getElementById("extensionVersion");
    this.elements.rulesVersion = document.getElementById("rulesVersion");
    this.elements.lastUpdated = document.getElementById("lastUpdated");

    // Modal
    this.elements.modalOverlay = document.getElementById("modalOverlay");
    this.elements.modalTitle = document.getElementById("modalTitle");
    this.elements.modalMessage = document.getElementById("modalMessage");
    this.elements.modalCancel = document.getElementById("modalCancel");
    this.elements.modalConfirm = document.getElementById("modalConfirm");

    // Toast container
    this.elements.toastContainer = document.getElementById("toastContainer");
  }

  setupEventListeners() {
    // Navigation
    this.elements.menuItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        this.switchSection(section);
        // Close mobile menu when navigation item is clicked
        if (this.elements.sidebar?.classList.contains("mobile-open")) {
          this.toggleMobileMenu();
        }
      });
    });

    // Header actions
    this.elements.saveSettings.addEventListener("click", () =>
      this.saveSettings()
    );
    this.elements.darkModeToggle.addEventListener("click", () =>
      this.toggleDarkMode()
    );

    // Mobile menu toggle
    this.elements.mobileMenuToggle?.addEventListener("click", () =>
      this.toggleMobileMenu()
    );

    // Logs actions
    this.elements.logFilter?.addEventListener("change", () => this.loadLogs());
    this.elements.refreshLogs?.addEventListener("click", () =>
      this.refreshLogs()
    );
    this.elements.clearLogs?.addEventListener("click", () => this.clearLogs());
    this.elements.exportLogs?.addEventListener("click", () =>
      this.exportLogs()
    );

    // Config display toggle
    this.elements.toggleConfigView?.addEventListener("click", () =>
      this.toggleConfigView()
    );

    // Simulate enterprise mode toggle (dev only)
    this.elements.simulateEnterpriseMode?.addEventListener("change", () =>
      this.toggleSimulateEnterpriseMode()
    );

    // Detection rules management
    this.elements.refreshDetectionRules?.addEventListener("click", () =>
      this.refreshDetectionRules()
    );

    // Playground actions
    this.elements.runRuleTestBtn?.addEventListener("click", () => this.runRulePlaygroundTest());
    this.elements.validateRulesBtn?.addEventListener("click", () => this.validatePlaygroundRules());
    this.elements.sanitizeRulesBtn?.addEventListener("click", () => this.sanitizePlaygroundRules());
    this.elements.copyRulesBtn?.addEventListener("click", () => this.copyPlaygroundRules());
    this.elements.clearPlaygroundBtn?.addEventListener("click", () => this.clearPlayground());
    this.elements.loadCurrentRulesBtn?.addEventListener("click", () => this.loadCurrentRulesIntoPlayground());

    // Branding preview updates
    const brandingInputs = [
      this.elements.companyName,
      this.elements.companyURL,
      this.elements.productName,
      this.elements.primaryColor,
      this.elements.logoUrl,
    ];

    brandingInputs.forEach((input) => {
      if (input) {
        input.addEventListener("input", () => this.updateBrandingPreview());
      }
    });

    // Validate timeout input
    if (this.elements.validPageBadgeTimeout) {
      this.elements.validPageBadgeTimeout.addEventListener("input", (e) => {
        const input = e.target;
        let value = input.value;
        
        // Remove any non-numeric characters except minus sign at start
        value = value.replace(/[^\d-]/g, '');
        
        // Remove minus signs (we don't allow negative numbers)
        value = value.replace(/-/g, '');
        
        // Parse as integer
        const numValue = parseInt(value, 10);
        
        // If empty or NaN, clear the field
        if (value === '' || isNaN(numValue)) {
          input.value = '';
          return;
        }
        
        // Enforce min/max constraints
        if (numValue < 0) {
          input.value = '0';
        } else if (numValue > 300) {
          input.value = '300';
        } else {
          input.value = numValue.toString();
        }
      });
      
      // Validate on blur - set to default if empty
      this.elements.validPageBadgeTimeout.addEventListener("blur", (e) => {
        const input = e.target;
        if (input.value === '' || input.value === null) {
          input.value = '5'; // Reset to default
        }
      });
    }

    // Modal actions
    this.elements.modalCancel?.addEventListener("click", () =>
      this.hideModal()
    );
    this.elements.modalOverlay?.addEventListener("click", (e) => {
      if (e.target === this.elements.modalOverlay) {
        this.hideModal();
      }
    });

    // Change tracking
    this.setupChangeTracking();

    // Mobile menu outside click handler
    document.addEventListener("click", (e) => {
      if (
        this.elements.sidebar?.classList.contains("mobile-open") &&
        !this.elements.sidebar.contains(e.target) &&
        !this.elements.mobileMenuToggle?.contains(e.target)
      ) {
        this.toggleMobileMenu();
      }
    });

    // Handle URL hash changes
    window.addEventListener("hashchange", () => this.handleHashChange());

    // Handle beforeunload to warn about unsaved changes
    window.addEventListener("beforeunload", (e) => {
      if (this.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
      }
    });
  }

  setupChangeTracking() {
    const inputs = document.querySelectorAll("input, select, textarea");
    inputs.forEach((input) => {
      if (input.type === "button" || input.type === "submit") return;
      // Skip playground-only transient inputs
      if (input.dataset && input.dataset.playgroundInput === "true") return;

      input.addEventListener("change", () => {
        this.markUnsavedChanges();
      });
    });
  }

  async initialize() {
    try {
      // Load configurations
      await this.loadConfiguration();
      await this.loadBrandingConfiguration();
      // Load simulate enterprise mode state (dev only)
      await this.loadSimulateEnterpriseMode();
      // Load policy info and apply enterprise restrictions
      await this.loadPolicyInfo();
      // Initialize dark mode
      await this.initializeDarkMode();
      // Apply branding
      this.applyBranding();
      // Populate form fields
      this.populateFormFields();
      // Load dynamic content
      await this.loadLogs();
      // Handle initial hash
      this.handleHashChange();
      // Update branding preview
      this.updateBrandingPreview();
      this.showToast("Settings loaded successfully", "success");
    } catch (error) {
      console.error("Failed to initialize options page:", error);
      this.showToast(
        "Failed to load some settings - using defaults where possible",
        "warning"
      );
    }
  }

  // Robust communication layer to handle service worker termination
  async ensureServiceWorkerAlive(maxAttempts = 3, initialDelay = 100) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "ping" }, (response) => {
            if (chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });

        if (response && response.success) {
          return true;
        }
      } catch (error) {
        console.warn(`Service worker ping attempt ${attempt} failed:`, error);
      }

      if (attempt < maxAttempts) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return false;
  }

  async sendMessageWithRetry(message, maxAttempts = 3, initialDelay = 5000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await new Promise((resolve, reject) => {
          try {
            chrome.runtime.sendMessage(message, (response) => {
              if (chrome.runtime.lastError) {
                // Silently handle runtime errors to avoid Chrome error list
                reject(new Error("Background worker unavailable"));
              } else {
                resolve(response);
              }
            });
          } catch (error) {
            reject(error);
          }
        });

        return response;
      } catch (error) {
        // Silently handle errors on first attempts, only log on final failure
        if (attempt === maxAttempts) {
          // Don't throw error to avoid uncaught exceptions
          return null;
        }

        // Wait 5 seconds before retry
        await new Promise((resolve) => setTimeout(resolve, initialDelay));
      }
    }
    return null;
  }

  async loadConfiguration() {
    const response = await this.sendMessageWithRetry({
      type: "GET_CONFIG",
    });

    if (response && response.success) {
      this.config = response.config;
      this.originalConfig = JSON.parse(JSON.stringify(response.config));
    } else {
      // Use defaults when background script is unavailable
      this.config = this.configManager?.getDefaultConfig() || {
        extensionEnabled: true,
        enableContentManipulation: true,
        enableUrlMonitoring: true,
        showNotifications: true,
        enableValidPageBadge: false,
        customRulesUrl:
          "https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/rules/detection-rules.json",
        updateInterval: 24,
        enableDebugLogging: false,
        enableDeveloperConsoleLogging: false,
      };
      this.originalConfig = JSON.parse(JSON.stringify(this.config));

      // Schedule silent retry in 5 seconds
      setTimeout(() => {
        this.loadConfiguration();
      }, 5000);
    }
  }

  async waitForRuntimeReady(maxAttempts = 5, initialDelay = 100) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check if chrome.runtime and extension context are available
        if (chrome.runtime && chrome.runtime.id) {
          const testUrl = chrome.runtime.getURL("config/branding.json");
          // Validate the URL is properly formed (not undefined or invalid)
          if (
            testUrl &&
            testUrl.startsWith("chrome-extension://") &&
            !testUrl.includes("undefined")
          ) {
            return true;
          }
        }
      } catch (error) {
        console.warn(
          `Runtime readiness check attempt ${attempt} failed:`,
          error
        );
      }

      if (attempt < maxAttempts) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error("Chrome runtime not ready after maximum attempts");
  }

  async loadBrandingConfiguration() {
    try {
      // Get branding configuration from background script (centralized through config manager)
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "GET_BRANDING_CONFIG" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "Failed to get branding from background:",
                chrome.runtime.lastError.message
              );
              resolve(null);
            } else {
              resolve(response);
            }
          }
        );
      });

      if (response && response.success && response.branding) {
        this.brandingConfig = response.branding;
        console.log(
          "Options: Loaded branding from background script:",
          this.brandingConfig
        );
        return;
      }

      // Fallback to default branding if background script fails
      console.warn("Options: Using fallback branding configuration");
      this.brandingConfig = {
        companyName: "CyberDrain",
    companyURL: "https://cyberdrain.com/",
        productName: "Check",
        primaryColor: "#F77F00",
        logoUrl: "images/icon48.png",
      };
    } catch (error) {
      console.error("Error loading branding configuration:", error);
      this.brandingConfig = {
        companyName: "CyberDrain",
		    companyURL: "https://cyberdrain.com/",
        productName: "Check",
        primaryColor: "#F77F00",
        logoUrl: "images/icon48.png",
      };
    }
  }

  async loadSimulateEnterpriseMode() {
    try {
      // Only load simulate mode in development environment
      const manifestData = chrome.runtime.getManifest();
      const isDev = !("update_url" in manifestData); // No update_url means unpacked extension

      if (!isDev) {
        this.simulateEnterpriseMode = false;
        // Hide the entire toggle in production (find the label element)
        if (this.elements.simulateEnterpriseMode) {
          const labelElement =
            this.elements.simulateEnterpriseMode.closest(".setting-label");
          if (labelElement) {
            labelElement.style.display = "none";
            console.log(
              "Simulate Enterprise Mode toggle hidden (production build)"
            );
          }
        }
        return;
      }

      // In development, ensure the toggle is visible
      if (this.elements.simulateEnterpriseMode) {
        const labelElement =
          this.elements.simulateEnterpriseMode.closest(".setting-label");
        if (labelElement) {
          labelElement.style.display = ""; // Reset to default display
        }
      }

      // Load the stored simulate mode state
      const result = await chrome.storage.local.get(["simulateEnterpriseMode"]);
      this.simulateEnterpriseMode = result.simulateEnterpriseMode || false;

      console.log(
        "Simulate Enterprise Mode loaded:",
        this.simulateEnterpriseMode
      );
    } catch (error) {
      console.error("Error loading simulate enterprise mode:", error);
      this.simulateEnterpriseMode = false;

      // Hide toggle on error as well (safer approach)
      if (this.elements.simulateEnterpriseMode) {
        const labelElement =
          this.elements.simulateEnterpriseMode.closest(".setting-label");
        if (labelElement) {
          labelElement.style.display = "none";
        }
      }
    }
  }

  /* ================= Rule Playground (Beta) ================= */
  getPlaygroundRulesRaw() {
    return (this.elements.playgroundRulesInput?.value || "").trim();
  }

  parsePlaygroundRules(silent = false) {
    const raw = this.getPlaygroundRulesRaw();
    if (!raw) {
      if (!silent) this.showToast("No rules JSON provided", "warning");
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (e) {
      if (!silent) this.showToast("Invalid JSON: " + e.message, "error");
      return null;
    }
  }

  validatePlaygroundRules() {
    const parsed = this.parsePlaygroundRules();
    if (!parsed) return;

    const issues = [];
    const suggestions = [];
    const inspectRule = (rule) => {
      if (!rule.id) issues.push("Rule missing 'id'");
      if (!rule.type) issues.push(`Rule ${rule.id || '(unknown)'} missing 'type'`);
      if (rule.weight !== undefined && typeof rule.weight !== 'number') issues.push(`Rule ${rule.id} weight should be number`);
      if (!rule.description) suggestions.push(`Rule ${rule.id} missing description (optional but recommended)`);
    };

    if (Array.isArray(parsed)) {
      parsed.forEach(inspectRule);
    } else if (parsed && parsed.rules && Array.isArray(parsed.rules)) {
      parsed.rules.forEach(inspectRule);
    } else if (parsed && parsed.id && parsed.type) {
      inspectRule(parsed);
    } else {
      issues.push("JSON does not look like rule(s) array or object with 'rules'.");
    }

    const html = [
      '<div class="playground-result-group">',
      '<div class="playground-result-title">Validation Results</div>'
    ];
    if (issues.length === 0) {
      html.push('<div class="playground-summary pass">No blocking validation issues found.</div>');
    } else {
      html.push('<div class="playground-summary fail"><strong>Issues:</strong><ul>' + issues.map(i => `<li>${i}</li>`).join('') + '</ul></div>');
    }
    if (suggestions.length) {
      html.push('<div class="playground-summary partial"><strong>Suggestions:</strong><ul>' + suggestions.map(i => `<li>${i}</li>`).join('') + '</ul></div>');
    }
    html.push('</div>');
    this.renderPlaygroundResults(html.join('\n'));
  }

  sanitizePlaygroundRules() {
    const parsed = this.parsePlaygroundRules();
    if (!parsed) return;
    try {
      const sanitized = JSON.stringify(parsed, null, 2);
      this.elements.playgroundRulesInput.value = sanitized;
      this.showToast("Rules formatted", "success");
    } catch (e) {
      this.showToast("Failed to sanitize: " + e.message, "error");
    }
  }

  copyPlaygroundRules() {
    const raw = this.getPlaygroundRulesRaw();
    if (!raw) {
      this.showToast("Nothing to copy", "warning");
      return;
    }
    navigator.clipboard.writeText(raw).then(() => {
      this.showToast("Copied to clipboard", "success");
    }).catch(err => {
      this.showToast("Copy failed: " + err.message, "error");
    });
  }

  clearPlayground() {
    if (this.elements.playgroundRulesInput) this.elements.playgroundRulesInput.value = '';
    if (this.elements.playgroundHtmlInput) this.elements.playgroundHtmlInput.value = '';
    if (this.elements.playgroundTestUrl) this.elements.playgroundTestUrl.value = '';
    this.renderPlaygroundResults('<div class="playground-placeholder">Cleared.</div>');
  }

  async loadCurrentRulesIntoPlayground() {
    try {
      // Always load the original packaged detection-rules.json so playground uses the raw rule list
      const response = await fetch(chrome.runtime.getURL('rules/detection-rules.json'));
      const json = await response.json();
      this.elements.playgroundRulesInput.value = JSON.stringify(json, null, 2);
      this.showToast('Loaded full rules file', 'success');
    } catch (e) {
      this.showToast('Failed to load rules: ' + e.message, 'error');
    }
  }

  async runRulePlaygroundTest() {
    // Parse candidate rules JSON from textarea
    const parsed = this.parsePlaygroundRules();
    if (!parsed) return;

    const testUrl = (this.elements.playgroundTestUrl?.value || '').trim();
    if (!testUrl) {
      this.showToast('Provide a Test URL', 'warning');
      return;
    }

    let htmlSource = (this.elements.playgroundHtmlInput?.value || '').trim();
    if (!htmlSource) {
      this.showToast('Provide HTML source', 'warning');
      return;
    }

    // Build rules config ONLY from user-provided input (no baseline merge)
    const normalizeRule = (r) => ({
      id: r.id || 'custom_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 10000).toString(36),
      pattern: r.pattern || r.regex || '',
      flags: r.flags || 'gi',
      severity: r.severity || 'low',
      description: r.description || 'Custom rule',
      confidence: typeof r.confidence === 'number' ? r.confidence : 0.9,
      action: r.action || 'monitor',
      category: r.category || r.type || 'general'
    });

    let fullRulesConfig = null;
    try {
      if (Array.isArray(parsed)) {
        fullRulesConfig = { phishing_indicators: parsed.filter(r => r && (r.pattern || r.regex)).map(normalizeRule), blocking_rules: {} };
      } else if (parsed && parsed.phishing_indicators) {
        fullRulesConfig = { phishing_indicators: parsed.phishing_indicators.filter(r => r && (r.pattern || r.regex)).map(normalizeRule), blocking_rules: parsed.blocking_rules || {} };
      } else if (parsed && parsed.rules) { // legacy/alternate key
        fullRulesConfig = { phishing_indicators: parsed.rules.filter(r => r && (r.pattern || r.regex)).map(normalizeRule), blocking_rules: parsed.blocking_rules || {} };
      } else {
        this.showToast('No usable rules found in input', 'warning');
        return;
      }

      // If no phishing_indicators produced but a classic 'rules' array exists, synthesize indicators from those rules
      if (fullRulesConfig.phishing_indicators.length === 0 && parsed && parsed.rules && Array.isArray(parsed.rules)) {
        const synthesized = [];
        for (const r of parsed.rules) {
          // Attempt to build a regex/pattern from rule.condition
          let patternCandidate = '';
          if (r.condition) {
            if (r.condition.contains) {
              // Escape regex special chars for substring contains
              const esc = String(r.condition.contains).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              patternCandidate = esc;
            } else if (Array.isArray(r.condition.selectors) && r.condition.selectors.length) {
              // Join selectors as alternation, escape special regex characters minimally
              patternCandidate = r.condition.selectors.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            } else if (Array.isArray(r.condition.domains) && r.condition.domains.length) {
              patternCandidate = r.condition.domains.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            }
          }
          if (!patternCandidate) continue; // skip rules we cannot synthesize

          // Map weight to severity heuristically
          const w = r.weight || 0;
          let severity = 'low';
            if (w >= 30) severity = 'critical';
            else if (w >= 25) severity = 'high';
            else if (w >= 15) severity = 'medium';

          synthesized.push({
            id: `syn_${r.id || 'rule'}_${synthesized.length + 1}`,
            pattern: patternCandidate,
            flags: 'i',
            severity,
            description: r.description || 'Synthesized from rules entry',
            action: severity === 'critical' ? 'block' : (severity === 'high' ? 'warn' : 'monitor'),
            confidence: 0.75,
            category: r.type || 'legacy_rule'
          });
        }
        if (synthesized.length) {
          fullRulesConfig.phishing_indicators.push(...synthesized);
          this.showToast(`Synthesized ${synthesized.length} indicators from rules[] for testing`, 'info');
        }
      }
      if (!fullRulesConfig.phishing_indicators.length) {
        this.showToast('No phishing_indicators found. Ensure JSON has phishing_indicators array with objects containing a pattern field.', 'warning');
        return;
      }
    } catch (e) {
      this.showToast('Failed to prepare rules: ' + e.message, 'error');
      return;
    }

    // Dynamically import core engine (works because options page runs in module-capable context)
    let engine = null;
    try {
      engine = await import(chrome.runtime.getURL('scripts/modules/rules-engine-core.js'));
    } catch (e) {
      this.renderPlaygroundResults('<div class="playground-summary fail">Failed to load core engine: ' + e.message + '</div>');
      return;
    }

    let evaluation;
    const start = performance.now();
    try {
      evaluation = engine.evaluatePageWithRules({
        rulesJson: fullRulesConfig,
        pageSource: htmlSource,
        url: testUrl
      });
    } catch (err) {
      this.renderPlaygroundResults('<div class="playground-summary fail">Evaluation error: ' + err.message + '</div>');
      return;
    }
    const elapsed = Math.round(performance.now() - start);

    // Build result HTML
    const parts = [];
    const decisionClass = {
      block: 'playground-badge block',
      warn: 'playground-badge warning',
      pass: 'playground-badge allow'
    }[evaluation.finalDecision] || 'playground-badge secondary';

    parts.push('<div class="playground-result-group">');
    parts.push('<div class="playground-result-title">Decision & Summary</div>');
    parts.push(`<div class="playground-summary ${evaluation.finalDecision === 'block' ? 'fail' : (evaluation.finalDecision === 'warn' ? 'partial' : 'pass')}">` +
      `<span class="${decisionClass}" style="margin-right:8px;">${evaluation.finalDecision.toUpperCase()}</span>` +
      `Score ${evaluation.score} • Threats ${evaluation.summary.totalThreats} • Critical ${evaluation.summary.critical} • High ${evaluation.summary.high} • Medium ${evaluation.summary.medium} • Low ${evaluation.summary.low} • ${elapsed}ms` +
      (evaluation.blocking && evaluation.blocking.shouldBlock ? `<br><strong>Blocking Reason:</strong> ${evaluation.blocking.reason}` : '') +
      '</div>');
    parts.push('</div>');

    if (evaluation.threats && evaluation.threats.length) {
      parts.push('<div class="playground-result-group">');
      parts.push('<div class="playground-result-title">Threats</div>');
      parts.push('<ul class="playground-result-list">');
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      evaluation.threats.sort((a,b)=> (severityOrder[b.severity]||0)-(severityOrder[a.severity]||0));
        for (const t of evaluation.threats) {
          const sevClass = t.severity === 'critical' ? 'error' : (t.severity === 'high' ? 'warning' : (t.severity === 'medium' ? 'success' : ''));
          const actionLabel = t.action === 'block' ? 'Blocking' : (t.action === 'warn' ? 'Warn' : 'Monitor');
            const categoryLabel = t.category ? this.escapeHtml(t.category) : 'general';
          const severityBadgeClass = t.severity === 'critical' ? 'block' : (t.severity === 'high' ? 'warning' : (t.severity === 'medium' ? 'weight' : 'allow'));
          const actionBadgeClass = t.action === 'block' ? 'block' : (t.action === 'warn' ? 'warning' : 'secondary');
          const categoryBadgeClass = 'secondary';
          let desc = t.description ? this.escapeHtml(t.description) : '';
          // Remove generic 'page source' noise phrases to tighten list
          if (desc) {
            desc = desc.replace(/\bpage\s+source\b/gi, '').replace(/\s{2,}/g,' ').trim();
          }
          const matchFrag = t.matchDetails ? `<code class="playground-code-fragment">${this.escapeHtml(t.matchDetails).slice(0,180)}</code>` : '';
          parts.push(`<li class="playground-result-item ${sevClass}">` +
            `<div><strong>${t.id}</strong> ` +
            `<span class="playground-badge ${severityBadgeClass}" style="margin-left:4px;">${t.severity.toUpperCase()}</span>` +
            `<span class="playground-badge ${actionBadgeClass}" style="margin-left:4px;">${actionLabel}</span>` +
            `<span class="playground-badge ${categoryBadgeClass}" style="margin-left:4px;">${categoryLabel}</span>` +
            `${desc ? `<span style=\"font-size:11px;opacity:.85;display:block;margin-top:4px;\">${desc}</span>`:''}` +
            `${matchFrag}</div>` +
          `</li>`);
        }
      parts.push('</ul>');
      parts.push('</div>');
    } else {
      parts.push('<div class="playground-result-group"><div class="playground-result-title">Threats</div><div class="playground-placeholder">No threats detected.</div></div>');
    }

    if (evaluation.unsupported && evaluation.unsupported.length) {
      parts.push('<div class="playground-result-group">');
      parts.push('<div class="playground-result-title">Unsupported Features</div>');
      parts.push('<ul class="playground-result-list">');
      for (const u of evaluation.unsupported) {
        parts.push(`<li class="playground-result-item"><span class="playground-badge secondary">N/A</span><div>${this.escapeHtml(u)}</div></li>`);
      }
      parts.push('</ul></div>');
    }

    parts.push('<div class="playground-result-group">');
    parts.push('<div class="playground-result-title">Raw JSON</div>');
    parts.push('<pre class="playground-code-fragment">' + this.escapeHtml(JSON.stringify(evaluation, null, 2)) + '</pre>');
    parts.push('</div>');

    this.renderPlaygroundResults(parts.join('\n'));
  }

  renderPlaygroundResults(html) {
    if (!this.elements.playgroundResults) return;
    this.elements.playgroundResults.innerHTML = html;
  }
  /* ================= End Rule Playground ================= */

  applyBranding() {
    // Update sidebar branding
    document.getElementById("sidebarTitle").textContent =
      this.brandingConfig?.productName || "Check";

    // Update mobile logo text
    const mobileLogoText = document.getElementById("mobileLogoText");
    if (mobileLogoText) {
      mobileLogoText.textContent = this.brandingConfig?.productName || "Check";
    }

    // Function to set logo src with fallback
    const setLogoSrc = (logoElement, fallbackSrc) => {
      if (!logoElement || !this.brandingConfig?.logoUrl) {
        if (logoElement) {
          logoElement.src = fallbackSrc;
        }
        return;
      }

      console.log("Setting logo:", this.brandingConfig.logoUrl);

      // Handle both relative and absolute URLs
      const logoSrc = this.brandingConfig.logoUrl.startsWith("http")
        ? this.brandingConfig.logoUrl
        : chrome.runtime.getURL(this.brandingConfig.logoUrl);

      // Test if logo loads, fallback to default if it fails
      const testImg = new Image();
      testImg.onload = () => {
        console.log("Logo loaded successfully");
        logoElement.src = logoSrc;
      };
      testImg.onerror = () => {
        console.warn("Failed to load logo, using default");
        logoElement.src = fallbackSrc;
      };
      testImg.src = logoSrc;
    };

    // Update sidebar logo
    const sidebarLogo = document.getElementById("sidebarLogo");
    setLogoSrc(sidebarLogo, chrome.runtime.getURL("images/icon48.png"));

    // Update mobile logo
    const mobileLogo = document.getElementById("mobileLogo");
    setLogoSrc(mobileLogo, chrome.runtime.getURL("images/icon48.png"));

    // Apply primary color to the options page
    if (this.brandingConfig?.primaryColor) {
      this.applyPrimaryColorToOptionsPage(this.brandingConfig.primaryColor);
    }
  }

  populateFormFields() {
    // Extension settings
    this.elements.enablePageBlocking =
      document.getElementById("enablePageBlocking");
    this.elements.enableCippReporting = document.getElementById(
      "enableCippReporting"
    );
    this.elements.cippServerUrl = document.getElementById("cippServerUrl");
    this.elements.cippTenantId = document.getElementById("cippTenantId");

    // Force main thread phishing processing (debug)
    this.elements.forceMainThreadPhishingProcessing = document.getElementById("forceMainThreadPhishingProcessing");


    if (this.elements.enablePageBlocking) {
      this.elements.enablePageBlocking.checked =
        this.config?.enablePageBlocking !== false;
    }
    if (this.elements.enableCippReporting) {
      this.elements.enableCippReporting.checked =
        this.config?.enableCippReporting || false;
    }
    if (this.elements.cippServerUrl) {
      this.elements.cippServerUrl.value = this.config?.cippServerUrl || "";
    }
    if (this.elements.cippTenantId) {
      this.elements.cippTenantId.value = this.config?.cippTenantId || "";
    }
    if (this.elements.forceMainThreadPhishingProcessing) {
      this.elements.forceMainThreadPhishingProcessing.checked = this.config?.forceMainThreadPhishingProcessing || false;
    }

    // UI settings
    this.elements.showNotifications.checked = this.config?.showNotifications;
    this.elements.enableValidPageBadge.checked =
      this.config.enableValidPageBadge || false;
    this.elements.validPageBadgeTimeout.value =
      this.config.validPageBadgeTimeout !== undefined
        ? this.config.validPageBadgeTimeout
        : 5;

    // Detection settings - use top-level customRulesUrl consistently
    this.elements.customRulesUrl.value = this.config?.customRulesUrl || "";

    // Generic webhook settings
    this.elements.genericWebhookEnabled = document.getElementById("genericWebhookEnabled");
    this.elements.genericWebhookUrl = document.getElementById("genericWebhookUrl");
    
    if (this.elements.genericWebhookEnabled) {
      this.elements.genericWebhookEnabled.checked = this.config?.genericWebhook?.enabled || false;
    }
    if (this.elements.genericWebhookUrl) {
      this.elements.genericWebhookUrl.value = this.config?.genericWebhook?.url || "";
    }

    const eventTypes = [
      "detection_alert",
      "false_positive_report",
      "page_blocked",
      "rogue_app_detected",
      "threat_detected",
      "validation_event"
    ];

    const selectedEvents = this.config?.genericWebhook?.events || [];
    eventTypes.forEach(eventType => {
      const checkbox = document.getElementById(`webhookEvent_${eventType}`);
      if (checkbox) {
        checkbox.checked = selectedEvents.includes(eventType);
      }
    });

    // URL Allowlist settings
    if (this.elements.urlAllowlist) {
      const allowlist = this.config?.urlAllowlist || [];
      this.elements.urlAllowlist.value = Array.isArray(allowlist)
        ? allowlist.join('\n')
        : (allowlist || '');
    }

    // Handle updateInterval - ensure we always show hours in the UI
    let updateIntervalHours = 24; // default
    if (this.config?.updateInterval) {
      // Legacy field takes precedence and is always in hours
      updateIntervalHours = this.config.updateInterval;
    } else if (this.config?.detectionRules?.updateInterval) {
      // If it's in the detectionRules object, it could be milliseconds or hours
      const interval = this.config.detectionRules.updateInterval;
      updateIntervalHours =
        interval > 1000 ? Math.round(interval / 3600000) : interval;
    }

    // Ensure the element exists before setting value
    if (this.elements.updateInterval) {
      this.elements.updateInterval.value = updateIntervalHours;
      // Force a refresh to ensure the value sticks
      setTimeout(() => {
        if (this.elements.updateInterval.value != updateIntervalHours) {
          this.elements.updateInterval.value = updateIntervalHours;
        }
      }, 100);
    }

    // Logging settings
    this.elements.enableDeveloperConsoleLogging.checked =
      this.config.enableDeveloperConsoleLogging || false;

    // Development settings (only visible in dev mode)
    if (this.elements.simulateEnterpriseMode) {
      this.elements.simulateEnterpriseMode.checked =
        this.simulateEnterpriseMode;
    }

    // Branding settings
    this.elements.companyName.value = this.brandingConfig?.companyName || "";
    this.elements.companyURL.value = this.brandingConfig?.companyURL || "";
    this.elements.productName.value = this.brandingConfig?.productName || "";
    this.elements.supportEmail.value = this.brandingConfig?.supportEmail || "";
    this.elements.primaryColor.value =
    this.brandingConfig?.primaryColor || "#F77F00";
    this.elements.logoUrl.value = this.brandingConfig?.logoUrl || "";
  }

  switchSection(sectionName) {
    // Update active menu item
    this.elements.menuItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.section === sectionName);
    });

    // Update active section
    this.elements.sections.forEach((section) => {
      section.classList.toggle(
        "active",
        section.id === `${sectionName}-section`
      );
    });

    // Update page title and subtitle
    const sectionInfo = {
      general: {
        title: "General Settings",
        subtitle:
          "Configure basic phishing protection behavior and detection features",
      },
      detection: {
        title: "Detection Rules",
        subtitle: "Load custom detection rules for phishing protection",
      },
      logs: {
        title: "Activity Logs",
        subtitle: "View security events and extension activity",
      },
      branding: {
        title: "Branding & White Labeling",
        subtitle: "Customize the extension's appearance and branding",
      },
      about: {
        title: "About Check, a product by CyberDrain",
        subtitle:
          "Enterprise-grade protection against Microsoft 365 phishing attacks",
      },
    };

    const info = sectionInfo[sectionName] || {
      title: "Settings",
      subtitle: "",
    };
    this.elements.pageTitle.textContent = info.title;

    // Update subtitle if it exists
    const pageSubtitle = document.getElementById("pageSubtitle");
    if (pageSubtitle) {
      pageSubtitle.textContent = info.subtitle;
    }

    // Update mobile title elements
    if (this.elements.mobileTitleText) {
      this.elements.mobileTitleText.textContent = info.title;
    }
    if (this.elements.mobileSubtitleText) {
      this.elements.mobileSubtitleText.textContent = info.subtitle;
    }

    this.currentSection = sectionName;

    // Update URL hash
    window.location.hash = sectionName;

    // Load section-specific data
    if (sectionName === "logs") {
      this.loadLogs();
    } else if (sectionName === "detection") {
      this.loadConfigDisplay();
    } else if (sectionName === "about") {
      this.loadAboutSection();
    }
  }

  handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (hash && document.getElementById(`${hash}-section`)) {
      this.switchSection(hash);
    }
  }

  async saveSettings() {
    try {
      const newConfig = this.gatherFormData();
      const newBranding = this.gatherBrandingData();

      // Validate configuration
      const validation = this.validateConfiguration(newConfig);
      if (!validation.valid) {
        this.showToast(validation.message, "error");
        return;
      }

      // Save configuration
      const response = await this.sendMessage({
        type: "UPDATE_CONFIG",
        config: newConfig,
      });

      // Save branding configuration separately
      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ brandingConfig: newBranding }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });

        this.brandingConfig = newBranding;
        console.log("Branding config saved:", newBranding);

        // Notify background script to update branding
        try {
          const brandingResponse = await this.sendMessage({
            type: "UPDATE_BRANDING",
          });

          if (brandingResponse && brandingResponse.success) {
            console.log("Background script updated with new branding");
          } else {
            console.warn(
              "Failed to notify background script of branding update"
            );
          }
        } catch (brandingNotifyError) {
          console.error(
            "Failed to notify background script:",
            brandingNotifyError
          );
        }
      } catch (brandingError) {
        console.error("Failed to save branding config:", brandingError);
        this.showToast("Failed to save branding settings", "warning");
      }

      if (response && response.success) {
        this.config = newConfig;
        this.originalConfig = JSON.parse(JSON.stringify(newConfig));
        this.hasUnsavedChanges = false;
        this.updateSaveButton();
        this.showToast("Settings saved successfully", "success");
      } else {
        throw new Error(response?.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      this.showToast("Failed to save settings", "error");
    }
  }

  gatherFormData() {
       const formData = {
      // Extension settings
      enablePageBlocking: this.elements.enablePageBlocking?.checked !== false,
      enableCippReporting: this.elements.enableCippReporting?.checked || false,
      cippServerUrl: this.elements.cippServerUrl?.value || "",
      cippTenantId: this.elements.cippTenantId?.value || "",
      // Debug: force main thread phishing processing
      forceMainThreadPhishingProcessing: this.elements.forceMainThreadPhishingProcessing?.checked || false,

      // UI settings
      showNotifications: this.elements.showNotifications?.checked || false,
      enableValidPageBadge:
        this.elements.enableValidPageBadge?.checked || false,
      validPageBadgeTimeout: (() => {
        const value = parseInt(this.elements.validPageBadgeTimeout?.value, 10);
        if (isNaN(value)) return 5; // Default if invalid
        return Math.min(300, Math.max(0, value)); // Clamp to 0-300 range
      })(),

      // Detection settings
      customRulesUrl: this.elements.customRulesUrl?.value || "",
      updateInterval: (() => {
        const value = parseInt(this.elements.updateInterval?.value, 10);
        if (isNaN(value)) return 24; // Default if invalid
        return Math.min(168, Math.max(1, value)); // Clamp to 1-168 range
      })(),

      // Generic webhook
      genericWebhook: {
        enabled: this.elements.genericWebhookEnabled?.checked || false,
        url: this.elements.genericWebhookUrl?.value || "",
        events: [
          "detection_alert",
          "false_positive_report",
          "page_blocked",
          "rogue_app_detected",
          "threat_detected",
          "validation_event"
        ].filter(eventType => 
          document.getElementById(`webhookEvent_${eventType}`)?.checked
        )
      },
      
      // URL Allowlist settings
      urlAllowlist: this.elements.urlAllowlist?.value
        ? this.elements.urlAllowlist.value.split('\n').filter(line => line.trim())
        : [],

      // Developer mode (debug logging auto-enabled when this is true)
      enableDeveloperConsoleLogging:
        this.elements.enableDeveloperConsoleLogging?.checked || false,
      // Auto-enable debug logging when developer mode is enabled
      enableDebugLogging:
        this.elements.enableDeveloperConsoleLogging?.checked || false,
    };

    // If in managed mode, filter out settings that are managed by policy
    if (this.managedPolicies && Object.keys(this.managedPolicies).length > 0) {
      const filteredData = {};
      const managedSettingsList = Object.keys(this.managedPolicies);

      // Add custom branding properties to managed list if present
      if (this.managedPolicies.customBranding) {
        managedSettingsList.push(
          ...Object.keys(this.managedPolicies.customBranding)
        );
      }

      // Only include settings that are NOT managed by policy
      Object.keys(formData).forEach((key) => {
        if (!managedSettingsList.includes(key)) {
          filteredData[key] = formData[key];
        } else {
          console.log(`⚠️ Skipping managed setting: ${key}`);
        }
      });

      console.log(
        "💾 Saving only non-managed settings:",
        Object.keys(filteredData)
      );
      return filteredData;
    }

    // If not in managed mode, return all settings
    return formData;
  }

  validateConfiguration(config) {
    // Basic validation
    if (config.updateInterval < 1 || config.updateInterval > 168) {
      return {
        valid: false,
        message: "Update interval must be between 1-168 hours",
      };
    }

    // URL validation
    if (config.customRulesUrl && !this.isValidUrl(config.customRulesUrl)) {
      return { valid: false, message: "Custom rules URL is not valid" };
    }

    // URL Allowlist validation
    if (config.urlAllowlist && Array.isArray(config.urlAllowlist)) {
      for (const pattern of config.urlAllowlist) {
        if (pattern.trim()) {
          const validationResult = this.validateUrlPattern(pattern.trim());
          if (!validationResult.valid) {
            return {
              valid: false,
              message: `Invalid pattern in URL allowlist: "${pattern.trim()}" - ${validationResult.error}`
            };
          }
        }
      }
    }

    return { valid: true };
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Convert URL pattern with wildcards to regex
  urlPatternToRegex(pattern) {
    // If it's already a regex pattern (starts with ^ or contains regex chars), return as-is
    if (pattern.startsWith('^') || pattern.includes('\\') || pattern.includes('[') || pattern.includes('(')) {
      return pattern;
    }
    // Escape special regex characters except *
    let escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Convert * to .* for wildcard matching
    escaped = escaped.replace(/\*/g, '.*');
    // Ensure it matches from the beginning
    if (!escaped.startsWith('^')) {
      escaped = '^' + escaped;
    }
    // Add end anchor if pattern doesn't end with wildcard
    if (!pattern.endsWith('*') && !escaped.endsWith('.*')) {
      escaped = escaped + '$';
    }
    return escaped;
  }

  // Validate URL pattern (either URL with wildcards or regex)
  validateUrlPattern(pattern) {
    try {
      // Try to convert to regex and test it
      const regexPattern = this.urlPatternToRegex(pattern);
      new RegExp(regexPattern);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  gatherBrandingData() {
    return {
      companyName: this.elements.companyName.value,
      companyURL: this.elements.companyURL.value,
      productName: this.elements.productName.value,
      supportEmail: this.elements.supportEmail.value,
      primaryColor: this.elements.primaryColor.value,
      logoUrl: this.elements.logoUrl.value,
    };
  }

  async loadDefaultDetectionRules() {
    try {
      // Add timeout to fetch operations
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          chrome.runtime.getURL("rules/detection-rules.json"),
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const defaultRules = await response.json();

        // No longer editing rules, just display them
        this.currentConfigData = defaultRules;
        this.updateConfigDisplay();
        this.showToast("Default rules loaded", "success");
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error("Failed to load default rules:", error);
      this.showToast("Failed to load default rules", "error");
    }
  }

  async loadConfigDisplay() {
    try {
      if (!this.elements.configDisplay) return;

      this.elements.configDisplay.innerHTML =
        '<div class="config-loading">Loading configuration...</div>';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          chrome.runtime.getURL("rules/detection-rules.json"),
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const config = await response.json();

        this.currentConfigData = config;
        this.updateConfigDisplay();
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error("Failed to load config display:", error);
      if (this.elements.configDisplay) {
        this.elements.configDisplay.innerHTML =
          '<div class="config-loading" style="color: var(--error-color);">Failed to load configuration</div>';
      }
    }
  }

  displayConfigInCard(config) {
    if (!this.elements.configDisplay) return;

    const sections = [];

    // Basic info
    sections.push(`
      <div class="config-section">
        <div class="config-section-title">Basic Information</div>
        <div class="config-item"><strong>Version:</strong> <span class="config-value">${
          config.version || "Unknown"
        }</span></div>
        <div class="config-item"><strong>Last Updated:</strong> <span class="config-value">${
          config.lastUpdated || "Unknown"
        }</span></div>
        <div class="config-item"><strong>Description:</strong> ${
          config.description || "No description"
        }</div>
      </div>
    `);

    // Detection Thresholds
    if (config.thresholds) {
      sections.push(`
        <div class="config-section">
          <div class="config-section-title">Detection Thresholds</div>
          <div class="config-item"><strong>Legitimate Site Threshold:</strong> <span class="config-value">${config.thresholds.legitimate}%</span></div>
          <div class="config-item"><strong>Suspicious Site Threshold:</strong> <span class="config-value">${config.thresholds.suspicious}%</span></div>
          <div class="config-item"><strong>Phishing Site Threshold:</strong> <span class="config-value">${config.thresholds.phishing}%</span></div>
        </div>
      `);
    }

    // Trusted Login Patterns
    if (
      config.trusted_login_patterns &&
      config.trusted_login_patterns.length > 0
    ) {
      sections.push(`
        <div class="config-section">
          <div class="config-section-title">Trusted Login Patterns (${
            config.trusted_login_patterns.length
          })</div>
          ${config.trusted_login_patterns
            .slice(0, 5)
            .map((pattern) => `<div class="config-item">• ${pattern}</div>`)
            .join("")}
          ${
            config.trusted_login_patterns.length > 5
              ? `<div class="config-item">... and ${
                  config.trusted_login_patterns.length - 5
                } more</div>`
              : ""
          }
        </div>
      `);
    }

    // Microsoft 365 Detection Requirements
    if (config.m365_detection_requirements) {
      const req = config.m365_detection_requirements;
      const primaryCount = req.primary_elements
        ? req.primary_elements.length
        : 0;
      const secondaryCount = req.secondary_elements
        ? req.secondary_elements.length
        : 0;

      sections.push(`
        <div class="config-section">
          <div class="config-section-title">Microsoft 365 Detection Requirements</div>
          <div class="config-item"><strong>Primary Elements:</strong> <span class="config-value">${primaryCount}</span></div>
          <div class="config-item"><strong>Secondary Elements:</strong> <span class="config-value">${secondaryCount}</span></div>
          <div class="config-item"><strong>Description:</strong> ${
            req.description || "No description"
          }</div>
        </div>
      `);
    }

    // Microsoft Domain Patterns
    if (
      config.microsoft_domain_patterns &&
      config.microsoft_domain_patterns.length > 0
    ) {
      sections.push(`
        <div class="config-section">
          <div class="config-section-title">Microsoft Domain Patterns (${
            config.microsoft_domain_patterns.length
          })</div>
          ${config.microsoft_domain_patterns
            .slice(0, 10)
            .map((pattern) => `<div class="config-item">• ${pattern}</div>`)
            .join("")}
          ${
            config.microsoft_domain_patterns.length > 10
              ? `<div class="config-item">... and ${
                  config.microsoft_domain_patterns.length - 10
                } more</div>`
              : ""
          }
        </div>
      `);
    }

    // Exclusion System
    if (config.exclusion_system) {
      const exclusions = config.exclusion_system;
      const domainPatterns = exclusions.domain_patterns || [];
      const legitimateContexts =
        exclusions.context_indicators?.legitimate_contexts || [];
      const legitimateSsoPatterns =
        exclusions.context_indicators?.legitimate_sso_patterns || [];
      const suspiciousContexts =
        exclusions.context_indicators?.suspicious_contexts || [];

      sections.push(`
        <div class="config-section">
          <div class="config-section-title">Exclusion System</div>
          <div class="config-item"><strong>Domain Patterns:</strong> <span class="config-value">${
            domainPatterns.length
          }</span></div>
          <div class="config-item"><strong>Legitimate Context Indicators:</strong> <span class="config-value">${
            legitimateContexts.length
          }</span></div>
          <div class="config-item"><strong>Legitimate SSO Patterns:</strong> <span class="config-value">${
            legitimateSsoPatterns.length
          }</span></div>
          <div class="config-item"><strong>Suspicious Context Indicators:</strong> <span class="config-value">${
            suspiciousContexts.length
          }</span></div>
          <div class="config-item"><strong>Description:</strong> ${
            exclusions.description || "No description"
          }</div>
          ${
            domainPatterns.length > 0
              ? `<div class="config-subsection">
              <div class="config-subsection-title">Sample Domain Patterns:</div>
              ${domainPatterns
                .slice(0, 5)
                .map((pattern) => `<div class="config-item">• ${pattern}</div>`)
                .join("")}
              ${
                domainPatterns.length > 5
                  ? `<div class="config-item">... and ${
                      domainPatterns.length - 5
                    } more</div>`
                  : ""
              }
            </div>`
              : ""
          }
        </div>
      `);
    }

    // Phishing Indicators Summary
    if (config.phishing_indicators && config.phishing_indicators.length > 0) {
      const indicatorTypes = {};
      const criticalCount = config.phishing_indicators.filter(
        (indicator) => indicator.severity === "critical"
      ).length;

      config.phishing_indicators.forEach((indicator) => {
        const type = indicator.type || "unknown";
        indicatorTypes[type] = (indicatorTypes[type] || 0) + 1;
      });

      const indicatorSections = Object.entries(indicatorTypes)
        .map(
          ([type, count]) =>
            `<div class="config-item"><strong>${type}:</strong> <span class="config-value">${count}</span></div>`
        )
        .join("");

      // Code-driven indicators summary
      const codeDrivenIndicators = config.phishing_indicators.filter(r => r.code_driven);
      let codeDrivenHtml = '';
      if (codeDrivenIndicators.length > 0) {
        codeDrivenHtml = `<div class="config-item"><strong>Code-Driven Indicators:</strong> <span class="config-value">${codeDrivenIndicators.length}</span></div>`;
      }

      sections.push(`
        <div class="config-section">
          <div class="config-section-title">Phishing Indicators (${config.phishing_indicators.length} total)</div>
          <div class="config-item"><strong>Critical Severity Rules:</strong> <span class="config-value">${criticalCount}</span></div>
          ${indicatorSections}
          ${codeDrivenHtml}
        </div>
      `);
    }

    // Legacy format support - Trusted origins
    if (config.trusted_origins && config.trusted_origins.length > 0) {
      sections.push(`
        <div class="config-section">
          <div class="config-section-title">Trusted Origins (${
            config.trusted_origins.length
          })</div>
          ${config.trusted_origins
            .map((origin) => `<div class="config-item">• ${origin}</div>`)
            .join("")}
        </div>
      `);
    }

    // Legacy format support - Pattern categories
    const patternSections = [];
    if (config.phishing && config.phishing.length > 0) {
      patternSections.push(
        `<div class="config-item"><strong>Phishing Patterns:</strong> <span class="config-value">${config.phishing.length}</span></div>`
      );
    }
    if (config.malicious && config.malicious.length > 0) {
      patternSections.push(
        `<div class="config-item"><strong>Malicious Patterns:</strong> <span class="config-value">${config.malicious.length}</span></div>`
      );
    }
    if (config.suspicious && config.suspicious.length > 0) {
      patternSections.push(
        `<div class="config-item"><strong>Suspicious Patterns:</strong> <span class="config-value">${config.suspicious.length}</span></div>`
      );
    }
    if (config.legitimate_patterns && config.legitimate_patterns.length > 0) {
      patternSections.push(
        `<div class="config-item"><strong>Legitimate Patterns:</strong> <span class="config-value">${config.legitimate_patterns.length}</span></div>`
      );
    }

    if (patternSections.length > 0) {
      sections.push(`
        <div class="config-section">
          <div class="config-section-title">Legacy Pattern Categories</div>
          ${patternSections.join("")}
        </div>
      `);
    }

    // Rogue apps detection
    if (config.rogue_apps_detection) {
      const rogue = config.rogue_apps_detection;
      sections.push(`
        <div class="config-section">
          <div class="config-section-title">Rogue Apps Detection</div>
          <div class="config-item"><strong>Enabled:</strong> <span class="config-value">${
            rogue.enabled ? "Yes" : "No"
          }</span></div>
          <div class="config-item"><strong>Source:</strong> <span class="config-value">${
            rogue.source_url ? rogue.source_url : "None"
          }</span></div>
          <div class="config-item"><strong>Cache Duration:</strong> <span class="config-value">${Math.round(
            (rogue.cache_duration || 0) / 3600000
          )}h</span></div>
          <div class="config-item"><strong>Update Interval:</strong> <span class="config-value">${Math.round(
            (rogue.update_interval || 0) / 3600000
          )}h</span></div>
          <div class="config-item"><strong>Detection Action:</strong> <span class="config-value">${
            rogue.detection_action || "None"
          }</span></div>
          <div class="config-item"><strong>Auto Update:</strong> <span class="config-value">${
            rogue.auto_update ? "Yes" : "No"
          }</span></div>
        </div>
      `);
    }

    // Configuration statistics
    let totalPatterns = 0;
    if (config.phishing_indicators)
      totalPatterns += config.phishing_indicators.length;
    if (config.phishing) totalPatterns += config.phishing.length;
    if (config.malicious) totalPatterns += config.malicious.length;
    if (config.suspicious) totalPatterns += config.suspicious.length;
    if (config.legitimate_patterns)
      totalPatterns += config.legitimate_patterns.length;

    let totalDetectionElements = 0;
    if (config.m365_detection_requirements) {
      if (config.m365_detection_requirements.primary_elements)
        totalDetectionElements +=
          config.m365_detection_requirements.primary_elements.length;
      if (config.m365_detection_requirements.secondary_elements)
        totalDetectionElements +=
          config.m365_detection_requirements.secondary_elements.length;
    }

    let totalExclusions = 0;
    if (config.exclusion_system) {
      if (config.exclusion_system.domain_patterns)
        totalExclusions += config.exclusion_system.domain_patterns.length;
      if (config.exclusion_system.context_indicators?.legitimate_contexts)
        totalExclusions +=
          config.exclusion_system.context_indicators.legitimate_contexts.length;
      if (config.exclusion_system.context_indicators?.legitimate_sso_patterns)
        totalExclusions +=
          config.exclusion_system.context_indicators.legitimate_sso_patterns
            .length;
      if (config.exclusion_system.context_indicators?.suspicious_contexts)
        totalExclusions +=
          config.exclusion_system.context_indicators.suspicious_contexts.length;
    }

    let criticalRules = 0;
    if (config.phishing_indicators) {
      criticalRules = config.phishing_indicators.filter(
        (indicator) => indicator.severity === "critical"
      ).length;
    }

    sections.push(`
      <div class="config-section">
        <div class="config-section-title">Configuration Statistics</div>
        <div class="config-item"><strong>Total Detection Patterns:</strong> <span class="config-value">${totalPatterns}</span></div>
        <div class="config-item"><strong>Microsoft 365 Detection Elements:</strong> <span class="config-value">${totalDetectionElements}</span></div>
        <div class="config-item"><strong>Trusted Login Patterns:</strong> <span class="config-value">${
          config.trusted_login_patterns
            ? config.trusted_login_patterns.length
            : 0
        }</span></div>
        <div class="config-item"><strong>Microsoft Domain Patterns:</strong> <span class="config-value">${
          config.microsoft_domain_patterns
            ? config.microsoft_domain_patterns.length
            : 0
        }</span></div>
        <div class="config-item"><strong>Critical Severity Rules:</strong> <span class="config-value">${criticalRules}</span></div>
        <div class="config-item"><strong>Total Exclusions:</strong> <span class="config-value">${totalExclusions}</span></div>
      </div>
    `);

    this.elements.configDisplay.innerHTML = sections.join("");
  }

  toggleConfigView() {
    if (!this.currentConfigData) return;

    this.configViewMode =
      this.configViewMode === "formatted" ? "raw" : "formatted";

    // Update button text and icon
    if (this.elements.toggleConfigView) {
      const icon =
        this.elements.toggleConfigView.querySelector(".material-icons");
      const text =
        this.elements.toggleConfigView.querySelector(
          ".material-icons"
        ).nextSibling;

      if (this.configViewMode === "raw") {
        icon.textContent = "view_list";
        this.elements.toggleConfigView.innerHTML =
          '<span class="material-icons">view_list</span> Show Formatted';
      } else {
        icon.textContent = "code";
        this.elements.toggleConfigView.innerHTML =
          '<span class="material-icons">code</span> Show Raw JSON';
      }
    }

    // Update display
    this.updateConfigDisplay();
  }

  toggleMobileMenu() {
    if (this.elements.sidebar) {
      const isOpen = this.elements.sidebar.classList.contains("mobile-open");
      this.elements.sidebar.classList.toggle("mobile-open", !isOpen);

      // Update aria-expanded attribute for accessibility
      if (this.elements.mobileMenuToggle) {
        this.elements.mobileMenuToggle.setAttribute("aria-expanded", !isOpen);
      }
    }
  }

  async toggleSimulateEnterpriseMode() {
    this.simulateEnterpriseMode = this.elements.simulateEnterpriseMode.checked;

    // Save the simulate mode state to storage for persistence
    await chrome.storage.local.set({
      simulateEnterpriseMode: this.simulateEnterpriseMode,
    });

    console.log("Simulate Enterprise Mode:", this.simulateEnterpriseMode);

    // Reload the policy information to apply/remove enterprise restrictions
    await this.loadPolicyInfo();

    // Refresh the UI to reflect the change
    this.populateFormFields();

    // Show notification to user
    const mode = this.simulateEnterpriseMode ? "enabled" : "disabled";
    this.showToast(
      `Enterprise simulation mode ${mode}. Page will reflect policy restrictions.`,
      "info"
    );
  }

  updateConfigDisplay() {
    if (!this.currentConfigData || !this.elements.configDisplay) return;

    if (this.configViewMode === "raw") {
      this.elements.configDisplay.innerHTML = `<div class="config-raw-json">${JSON.stringify(
        this.currentConfigData,
        null,
        2
      )}</div>`;
    } else {
      this.displayConfigInCard(this.currentConfigData);
    }
  }

  async loadLogs() {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async (promise) => {
        try {
          return await promise;
        } catch (_) {
          return {};
        }
      };

      const result = await safe(
        chrome.storage.local.get(["securityEvents", "accessLogs", "debugLogs"])
      );
      const securityEvents = result?.securityEvents || [];
      const accessLogs = result?.accessLogs || [];
      const debugLogs = result?.debugLogs || [];

      // Combine and sort logs with proper categorization
      const allLogs = [
        ...securityEvents.map((event) => {
          // Properly categorize based on event type
          let category = "security"; // default

          if (event.event?.type === "legitimate_access") {
            category = "legitimate";
          } else if (event.event?.type === "rogue_app_detected") {
            category = "rogue_app";
          } else if (
            event.event?.type === "url_access" ||
            event.event?.type === "page_scanned"
          ) {
            category = "access";
          }

          return { ...event, category };
        }),
        ...accessLogs.map((event) => ({ ...event, category: "access" })),
        ...debugLogs.map((log) => ({ ...log, category: "debug" })),
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      this.displayLogs(allLogs);
    } catch (error) {
      console.error("Failed to load logs:", error);
      this.showToast("Failed to load logs", "error");
    }
  }

  displayLogs(logs) {
    this.elements.logsList.innerHTML = "";

    if (logs.length === 0) {
      const item = document.createElement("div");
      item.className = "log-entry";
      item.innerHTML =
        '<div class="log-column" style="grid-column: 1 / -1; text-align: center; color: #9ca3af;">No logs available</div>';
      this.elements.logsList.appendChild(item);
      return;
    }

    // Filter logs based on debug logging setting
    const filteredLogs = this.filterLogsForDisplay(logs);

    filteredLogs.slice(0, 100).forEach((log, index) => {
      const item = document.createElement("div");
      item.className = "log-entry";
      item.dataset.logIndex = index;

      // Main row container
      const mainRow = document.createElement("div");
      mainRow.className = "log-entry-main";

      // Timestamp column
      const timestamp = document.createElement("div");
      timestamp.className = "log-column timestamp";
      timestamp.textContent = new Date(log.timestamp).toLocaleString();

      // Event type column
      const eventType = document.createElement("div");
      eventType.className = `log-column event-type ${log.category}`;
      const eventTypeText = this.getEventTypeDisplay(log);
      eventType.textContent = eventTypeText;

      // Apply color based on event type
      this.applyEventTypeColor(eventType, log);

      // URL/Domain column
      const url = document.createElement("div");
      url.className = "log-column url";
      url.textContent = this.getUrlDisplay(log);

      // Threat level column
      const threatLevel = document.createElement("div");
      threatLevel.className = "log-column threat-level";
      const threatLevelText = this.getThreatLevelDisplay(log);
      threatLevel.textContent = threatLevelText;

      // Apply color based on threat level
      this.applyThreatLevelColor(threatLevel, threatLevelText, log);

      // Action taken column
      const action = document.createElement("div");
      action.className = "log-column action";
      action.textContent = this.getActionDisplay(log);

      // Details column
      const details = document.createElement("div");
      details.className = "log-column details";
      details.textContent = this.formatLogMessage(log);

      // Expand icon
      const expandIcon = document.createElement("div");
      expandIcon.className = "log-expand-icon";
      expandIcon.innerHTML = "▶";

      // Append all columns to main row
      mainRow.appendChild(timestamp);
      mainRow.appendChild(eventType);
      mainRow.appendChild(url);
      mainRow.appendChild(threatLevel);
      mainRow.appendChild(action);
      mainRow.appendChild(details);
      mainRow.appendChild(expandIcon);

      // Details section (initially hidden)
      const detailsSection = document.createElement("div");
      detailsSection.className = "log-entry-details";
      detailsSection.innerHTML = this.createLogDetailsHTML(log);

      // Append both main row and details to the item
      item.appendChild(mainRow);
      item.appendChild(detailsSection);

      // Add click event to main row only to toggle expansion
      mainRow.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleLogEntry(item);
      });

      // Add copy button event listeners
      const copyButtons = detailsSection.querySelectorAll(".copy-button");
      copyButtons.forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          const copyValue = button.getAttribute("data-copy-value");
          this.copyToClipboard(copyValue, button);
        });
      });

      // Add mobile tap-to-copy event listeners
      const mobileCopyableElements =
        detailsSection.querySelectorAll(".mobile-copyable");
      mobileCopyableElements.forEach((element) => {
        element.addEventListener("click", (e) => {
          e.stopPropagation();
          const copyValue = element.getAttribute("data-copy-value");
          this.copyToClipboardMobile(copyValue, element);
        });

        // Add visual feedback for touch
        element.addEventListener("touchstart", (e) => {
          element.style.backgroundColor = "var(--primary-color)";
          element.style.color = "white";
        });

        element.addEventListener("touchend", (e) => {
          setTimeout(() => {
            element.style.backgroundColor = "";
            element.style.color = "";
          }, 200);
        });
      });

      this.elements.logsList.appendChild(item);
    });
  }

  toggleLogEntry(item) {
    const isExpanded = item.classList.contains("expanded");

    // Close all other expanded entries
    document.querySelectorAll(".log-entry.expanded").forEach((entry) => {
      if (entry !== item) {
        entry.classList.remove("expanded");
      }
    });

    // Toggle current entry
    item.classList.toggle("expanded", !isExpanded);
  }

  createLogDetailsHTML(log) {
    let html = "";
    const isMobile = this.isMobileDevice();

    // Basic Information Section
    html += `<div class="log-details-section">
      <div class="log-details-title">Basic Information</div>
      <div class="log-details-grid">`;

    if (log.timestamp) {
      const timestampValue = new Date(log.timestamp).toISOString();
      if (isMobile) {
        html += `<div class="log-details-field">
          <div class="log-details-field-label">Timestamp <span class="mobile-copy-hint">(tap to copy)</span></div>
          <div class="log-details-field-value mobile-copyable" data-copy-value="${this.escapeHtml(
            timestampValue
          )}">${timestampValue}</div>
        </div>`;
      } else {
        html += `<div class="log-details-field">
          <div class="log-details-field-label">Timestamp</div>
          <div class="log-details-field-value-container">
            <div class="log-details-field-value">${timestampValue}</div>
            <button class="copy-button" title="Copy timestamp" data-copy-value="${this.escapeHtml(
              timestampValue
            )}">
              <span class="material-icons" style="font-size: 14px;">content_copy</span>
            </button>
          </div>
        </div>`;
      }
    }

    if (log.category) {
      if (isMobile) {
        html += `<div class="log-details-field">
          <div class="log-details-field-label">Category <span class="mobile-copy-hint">(tap to copy)</span></div>
          <div class="log-details-field-value mobile-copyable" data-copy-value="${this.escapeHtml(
            log.category
          )}">${log.category}</div>
        </div>`;
      } else {
        html += `<div class="log-details-field">
          <div class="log-details-field-label">Category</div>
          <div class="log-details-field-value-container">
            <div class="log-details-field-value">${log.category}</div>
            <button class="copy-button" title="Copy category" data-copy-value="${this.escapeHtml(
              log.category
            )}">
              <span class="material-icons" style="font-size: 14px;">content_copy</span>
            </button>
          </div>
        </div>`;
      }
    }

    if (log.level) {
      if (isMobile) {
        html += `<div class="log-details-field">
          <div class="log-details-field-label">Level <span class="mobile-copy-hint">(tap to copy)</span></div>
          <div class="log-details-field-value mobile-copyable" data-copy-value="${this.escapeHtml(
            log.level
          )}">${log.level}</div>
        </div>`;
      } else {
        html += `<div class="log-details-field">
          <div class="log-details-field-label">Level</div>
          <div class="log-details-field-value-container">
            <div class="log-details-field-value">${log.level}</div>
            <button class="copy-button" title="Copy level" data-copy-value="${this.escapeHtml(
              log.level
            )}">
              <span class="material-icons" style="font-size: 14px;">content_copy</span>
            </button>
          </div>
        </div>`;
      }
    }

    if (log.source) {
      if (isMobile) {
        html += `<div class="log-details-field">
          <div class="log-details-field-label">Source <span class="mobile-copy-hint">(tap to copy)</span></div>
          <div class="log-details-field-value mobile-copyable" data-copy-value="${this.escapeHtml(
            log.source
          )}">${log.source}</div>
        </div>`;
      } else {
        html += `<div class="log-details-field">
          <div class="log-details-field-label">Source</div>
          <div class="log-details-field-value-container">
            <div class="log-details-field-value">${log.source}</div>
            <button class="copy-button" title="Copy source" data-copy-value="${this.escapeHtml(
              log.source
            )}">
              <span class="material-icons" style="font-size: 14px;">content_copy</span>
            </button>
          </div>
        </div>`;
      }
    }

    html += "</div></div>";

    // Event Information Section
    if (log.event) {
      html += `<div class="log-details-section">
        <div class="log-details-title">Event Details</div>
        <div class="log-details-grid">`;

      Object.entries(log.event).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          const jsonValue = JSON.stringify(value, null, 2);
          if (isMobile) {
            html += `<div class="log-details-field" style="grid-column: 1 / -1;">
              <div class="log-details-field-label">${key} <span class="mobile-copy-hint">(tap to copy)</span></div>
              <div class="log-details-content mobile-copyable" data-copy-value="${this.escapeHtml(
                jsonValue
              )}">${this.escapeHtml(jsonValue)}</div>
            </div>`;
          } else {
            html += `<div class="log-details-field" style="grid-column: 1 / -1;">
              <div class="log-details-field-label">${key}</div>
              <div class="log-details-content-container">
                <div class="log-details-content">${this.escapeHtml(
                  jsonValue
                )}</div>
                <button class="copy-button" title="Copy ${key}" data-copy-value="${this.escapeHtml(
              jsonValue
            )}">
                  <span class="material-icons" style="font-size: 14px;">content_copy</span>
                </button>
              </div>
            </div>`;
          }
        } else {
          const valueStr = this.escapeHtml(String(value));
          if (isMobile) {
            html += `<div class="log-details-field">
              <div class="log-details-field-label">${key} <span class="mobile-copy-hint">(tap to copy)</span></div>
              <div class="log-details-field-value mobile-copyable" data-copy-value="${valueStr}">${valueStr}</div>
            </div>`;
          } else {
            html += `<div class="log-details-field">
              <div class="log-details-field-label">${key}</div>
              <div class="log-details-field-value-container">
                <div class="log-details-field-value">${valueStr}</div>
                <button class="copy-button" title="Copy ${key}" data-copy-value="${valueStr}">
                  <span class="material-icons" style="font-size: 14px;">content_copy</span>
                </button>
              </div>
            </div>`;
          }
        }
      });

      html += "</div></div>";
    }

    // Additional Properties Section
    const additionalProps = { ...log };
    delete additionalProps.timestamp;
    delete additionalProps.category;
    delete additionalProps.level;
    delete additionalProps.source;
    delete additionalProps.event;

    if (Object.keys(additionalProps).length > 0) {
      html += `<div class="log-details-section">
        <div class="log-details-title">Additional Properties</div>
        <div class="log-details-grid">`;

      Object.entries(additionalProps).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          const jsonValue = JSON.stringify(value, null, 2);
          if (isMobile) {
            html += `<div class="log-details-field" style="grid-column: 1 / -1;">
              <div class="log-details-field-label">${key} <span class="mobile-copy-hint">(tap to copy)</span></div>
              <div class="log-details-content mobile-copyable" data-copy-value="${this.escapeHtml(
                jsonValue
              )}">${this.escapeHtml(jsonValue)}</div>
            </div>`;
          } else {
            html += `<div class="log-details-field" style="grid-column: 1 / -1;">
              <div class="log-details-field-label">${key}</div>
              <div class="log-details-content-container">
                <div class="log-details-content">${this.escapeHtml(
                  jsonValue
                )}</div>
                <button class="copy-button" title="Copy ${key}" data-copy-value="${this.escapeHtml(
              jsonValue
            )}">
                  <span class="material-icons" style="font-size: 14px;">content_copy</span>
                </button>
              </div>
            </div>`;
          }
        } else {
          const valueStr = this.escapeHtml(String(value));
          if (isMobile) {
            html += `<div class="log-details-field">
              <div class="log-details-field-label">${key} <span class="mobile-copy-hint">(tap to copy)</span></div>
              <div class="log-details-field-value mobile-copyable" data-copy-value="${valueStr}">${valueStr}</div>
            </div>`;
          } else {
            html += `<div class="log-details-field">
              <div class="log-details-field-label">${key}</div>
              <div class="log-details-field-value-container">
                <div class="log-details-field-value">${valueStr}</div>
                <button class="copy-button" title="Copy ${key}" data-copy-value="${valueStr}">
                  <span class="material-icons" style="font-size: 14px;">content_copy</span>
                </button>
              </div>
            </div>`;
          }
        }
      });

      html += "</div></div>";
    }

    // Raw Data Section
    const rawJson = JSON.stringify(log, null, 2);
    if (isMobile) {
      html += `<div class="log-details-section">
        <div class="log-details-title">Raw Data <span class="mobile-copy-hint">(tap to copy)</span></div>
        <div class="log-details-content mobile-copyable" data-copy-value="${this.escapeHtml(
          rawJson
        )}">${this.escapeHtml(rawJson)}</div>
      </div>`;
    } else {
      html += `<div class="log-details-section">
        <div class="log-details-title">Raw Data</div>
        <div class="log-details-content-container">
          <div class="log-details-content">${this.escapeHtml(rawJson)}</div>
          <button class="copy-button" title="Copy raw JSON" data-copy-value="${this.escapeHtml(
            rawJson
          )}">
            <span class="material-icons" style="font-size: 14px;">content_copy</span>
          </button>
        </div>
      </div>`;
    }

    return html;
  }

  escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, function (m) {
      return map[m];
    });
  }

  // Escape text for safe inclusion in JavaScript strings
  escapeForJS(text) {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
  }

  // Copy to clipboard helper function
  async copyToClipboard(text, button) {
    try {
      // Decode HTML entities back to original text
      const decodedText = this.decodeHtml(text);
      await navigator.clipboard.writeText(decodedText);

      // Visual feedback
      const originalText = button.innerHTML;
      button.innerHTML =
        '<span class="material-icons" style="font-size: 14px;">check</span>';
      button.classList.add("copied");

      setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove("copied");
      }, 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);

      // Fallback for older browsers
      const decodedText = this.decodeHtml(text);
      const textArea = document.createElement("textarea");
      textArea.value = decodedText;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      // Visual feedback
      const originalText = button.innerHTML;
      button.innerHTML =
        '<span class="material-icons" style="font-size: 14px;">check</span>';
      button.classList.add("copied");

      setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove("copied");
      }, 2000);
    }
  }

  // Mobile copy to clipboard function
  async copyToClipboardMobile(text, element) {
    try {
      // Decode HTML entities back to original text
      const decodedText = this.decodeHtml(text);
      await navigator.clipboard.writeText(decodedText);

      this.showMobileToast("Copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);

      // Fallback for older browsers
      const decodedText = this.decodeHtml(text);
      const textArea = document.createElement("textarea");
      textArea.value = decodedText;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      this.showMobileToast("Copied to clipboard!");
    }
  }

  // Decode HTML entities back to original text
  decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }

  // Mobile device detection
  isMobileDevice() {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) ||
      window.innerWidth <= 768 ||
      "ontouchstart" in window
    );
  }

  // Show mobile toast notification
  showMobileToast(message) {
    // Remove any existing toast
    const existingToast = document.querySelector(".mobile-toast");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.className = "mobile-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add("show"), 100);

    // Hide and remove toast
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  filterLogsForDisplay(logs) {
    const debugLoggingEnabled = this.config?.enableDebugLogging || false;

    if (debugLoggingEnabled) {
      return logs; // Show all logs including debug
    } else {
      // Filter out page scan events and debug logs unless they're important
      return logs.filter((log) => {
        if (log.category === "debug" && log.level === "debug") {
          return false; // Hide debug logs
        }
        if (log.event?.type === "page_scanned" && !log.event?.threatDetected) {
          return false; // Hide routine page scans
        }
        return true;
      });
    }
  }

  async loadPolicyInfo() {
    try {
      // Check if we're in development mode
      const manifestData = chrome.runtime.getManifest();
      const isDev = !("update_url" in manifestData); // No update_url means unpacked extension

      let policies = {};
      let isManaged = false;

      if (isDev && this.simulateEnterpriseMode) {
        // Mock managed policies for development testing (only when simulate mode is enabled)
        console.log(
          "🔧 Development mode: Using mock managed policies (simulate mode enabled)"
        );

        policies = {
          // Extension configuration
          showNotifications: true,
          enableValidPageBadge: true,
          enablePageBlocking: true,
          enableCippReporting: false,
          cippServerUrl: "",
          cippTenantId: "",
          customRulesUrl:
            "https://raw.githubusercontent.com/CyberDrain/ProjectX/refs/heads/main/rules/detection-rules.json",
          updateInterval: 24,
          enableDebugLogging: false,
          // Note: enableDeveloperConsoleLogging is not policy-managed - remains under user control

          // Custom branding (matches managed_schema.json structure)
          customBranding: {
            companyName: "CyberDrain",
            companyURL: "https://cyberdrain.com/",
            productName: "Check Enterprise",
            primaryColor: "#F77F00",
            logoUrl:
              "https://cyberdrain.com/images/favicon_hu_20e77b0e20e363e.png",
          },
        };

        isManaged = true;
        this.showDevelopmentNotice();
      } else {
        // Either production mode or dev mode with simulate disabled: Use actual managed storage
        const safe = async (promise) => {
          try {
            return await promise;
          } catch (_) {
            return {};
          }
        };

        policies = await safe(chrome.storage.managed.get(null));
        isManaged = policies && Object.keys(policies).length > 0;
      }

      if (isManaged) {
        console.log("📋 Managed policies active:", policies);

        // Store managed policies for use during saving
        this.managedPolicies = policies;

        // Update branding configuration with managed custom branding
        if (policies.customBranding) {
          this.brandingConfig = policies.customBranding;
          console.log(
            "Updated branding with managed custom branding:",
            this.brandingConfig
          );
        }

        // Show policy badge
        if (this.elements.policyBadge) {
          this.elements.policyBadge.style.display = "flex";
        }

        // Apply enterprise restrictions
        this.applyEnterpriseRestrictions(policies);

        // Disable policy-managed fields
        this.disablePolicyManagedFields(policies);

        // Re-apply branding in case managed branding is different
        this.applyBranding();
      } else {
        console.log("👤 No managed policies found - user mode");

        // Hide policy badge
        if (this.elements.policyBadge) {
          this.elements.policyBadge.style.display = "none";
        }
      }
    } catch (error) {
      console.error("Failed to load policy info:", error);
      // Retry in 5 seconds
      setTimeout(() => {
        this.loadPolicyInfo().catch(() => {
          console.log("Policy info still unavailable");
        });
      }, 5000);
    }
  }

  showDevelopmentNotice() {
    // Find the settings container
    const container =
      document.querySelector(".settings-container") ||
      document.querySelector("main") ||
      document.body;

    if (!container) return;

    // Remove existing development notice
    const existingNotice = document.querySelector(".development-notice");
    if (existingNotice) {
      existingNotice.remove();
    }

    // Create development notice
    const notice = document.createElement("div");
    notice.className = "development-notice";
    notice.style.cssText = `
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 20px;
      position: relative;
    `;

    notice.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <span style="font-size: 20px; line-height: 1;">🔧</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #856404; margin-bottom: 6px;">
            Development Mode Active
          </div>
          <div style="font-size: 14px; color: #856404; line-height: 1.4;">
            Using mock managed policies for testing. Sideloaded extensions don't support real managed storage.
            <br><strong>Set DEVELOPMENT_MODE = false in options.js for production testing.</strong>
          </div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          color: #856404;
          padding: 0;
          line-height: 1;
        ">×</button>
      </div>
    `;

    // Insert at the beginning of the container
    container.insertBefore(notice, container.firstChild);
  }

  disablePolicyManagedFields(policies) {
    const policyFieldMap = {
      showNotifications: this.elements.showNotifications,
      enableValidPageBadge: this.elements.enableValidPageBadge,
      enablePageBlocking: this.elements.enablePageBlocking,
      enableCippReporting: this.elements.enableCippReporting,
      cippServerUrl: this.elements.cippServerUrl,
      cippTenantId: this.elements.cippTenantId,
      customRulesUrl: this.elements.customRulesUrl,
      updateInterval: this.elements.updateInterval,
      urlAllowlist: this.elements.urlAllowlist,
      enableDebugLogging: this.elements.enableDebugLogging,
      // Note: enableDeveloperConsoleLogging is excluded - should remain available for debugging
      // Branding fields (if customBranding policy is present)
      companyName: this.elements.companyName,
      companyURL: this.elements.companyURL,
      productName: this.elements.productName,
      supportEmail: this.elements.supportEmail,
      primaryColor: this.elements.primaryColor,
      logoUrl: this.elements.logoUrl,
    };

    Object.keys(policies).forEach((policyKey) => {
      if (policyKey === "customBranding" && policies.customBranding) {
        // Handle nested branding policies
        Object.keys(policies.customBranding).forEach((brandingKey) => {
          const element = policyFieldMap[brandingKey];
          if (element) {
            this.disableFieldWithPolicy(
              element,
              `customBranding.${brandingKey}`
            );
          }
        });
      } else {
        // Handle top-level policies
        const element = policyFieldMap[policyKey];
        if (element) {
          this.disableFieldWithPolicy(element, policyKey);
        }
      }
    });
  }

  disableFieldWithPolicy(element, policyPath) {
    if (!element) return;

    element.disabled = true;
    element.title = `This setting is managed by your organization's policy (${policyPath})`;

    // Add visual indicator
    element.classList.add("policy-managed");

    // Add a small lock icon next to the field (avoid duplicates)
    if (!element.parentNode?.querySelector(".policy-lock")) {
      const lockIcon = document.createElement("span");
      lockIcon.className = "material-icons policy-lock";
      lockIcon.textContent = "lock";
      lockIcon.title = "Managed by policy";
      lockIcon.style.cssText = `
        font-size: 16px;
        margin-left: 8px;
        color: #666;
        vertical-align: middle;
      `;

      if (element.parentNode) {
        element.parentNode.appendChild(lockIcon);
      }
    }
  }

  applyEnterpriseRestrictions(policies) {
    // Set enterprise managed flag
    this.isEnterpriseManaged = true;

    // Hide enterprise-managed tabs from navigation
    const restrictedTabs = ["general", "detection", "branding"];

    restrictedTabs.forEach((tabName) => {
      const menuItem = document.querySelector(`[data-section="${tabName}"]`);
      if (menuItem) {
        const listItem = menuItem.closest("li");
        if (listItem) {
          listItem.style.display = "none";
        }
      }
    });

    // Modify the save button for mixed mode (some settings managed, some user-controlled)
    if (this.elements.saveSettings) {
      // Don't fully disable the save button - allow saving of non-managed settings
      this.elements.saveSettings.title =
        "Save non-managed settings (managed settings cannot be modified)";
      this.elements.saveSettings.textContent = "Save Available Settings";
      this.elements.saveSettings.classList.add("managed-mode");
    }

    // Disable the debug logging checkbox specifically
    if (this.elements.enableDebugLogging) {
      this.elements.enableDebugLogging.disabled = true;
      this.elements.enableDebugLogging.title =
        "Debug logging is managed by your organization's policy";
      this.elements.enableDebugLogging.classList.add("policy-managed");
    }

    // Note: Developer console logging remains available for troubleshooting in managed mode

    // If currently on a restricted tab, switch to logs tab
    if (restrictedTabs.includes(this.currentSection)) {
      this.switchSection("logs");
    }

    // Add enterprise notice to the interface
    this.addEnterpriseNotice();
  }

  addEnterpriseNotice() {
    // Check if notice already exists
    if (document.querySelector(".enterprise-notice")) {
      return;
    }

    // Create enterprise management notice
    const notice = document.createElement("div");
    notice.className = "enterprise-notice";
    notice.innerHTML = `
      <div class="notice-content">
        <span class="material-icons notice-icon">admin_panel_settings</span>
        <div class="notice-text">
          <strong>Enterprise Managed</strong>
          <p>This extension is managed by your organization. Most settings cannot be modified.</p>
        </div>
      </div>
    `;

    // Insert after the header
    const contentHeader = document.querySelector(".content-header");
    if (contentHeader) {
      contentHeader.insertAdjacentElement("afterend", notice);
    }
  }

  getEventTypeDisplay(log) {
    if (log.category === "debug") {
      return log.level.toUpperCase();
    }
    if (log.event?.type) {
      return this.getEventDisplayName(log.event.type);
    }
    return (log.type || "UNKNOWN").toUpperCase();
  }

  getEventDisplayName(eventType) {
    const eventDisplayNames = {
      // Core security events
      url_access: "Page Scanned",
      content_threat_detected: "Content Threat Detected",
      threat_detected: "Security Threat Detected",
      form_submission: "Form Monitored",
      script_injection: "Security Script Injected",
      page_scanned: "Page Scanned",
      blocked_page_viewed: "Blocked Content Viewed",
      threat_blocked: "Threat Blocked",
      threat_detected_no_action: "Threat Detected",
      legitimate_access: "Legitimate Access",

      // Phishing threats
      phishing_page: "Phishing Page Blocked",
      fake_login: "Fake Login Blocked",
      credential_harvesting: "Credential Harvesting Blocked",
      microsoft_impersonation: "Microsoft Impersonation Blocked",
      o365_phishing: "Office 365 Phishing Blocked",
      login_spoofing: "Login Page Spoofing Blocked",

      // Malicious content
      malicious_script: "Malicious Script Blocked",
      suspicious_redirect: "Suspicious Redirect Blocked",
      unsafe_download: "Unsafe Download Blocked",
      malware_detected: "Malware Detected",
      suspicious_form: "Suspicious Form Blocked",

      // Domain threats
      typosquatting: "Typosquatting Domain Blocked",
      suspicious_domain: "Suspicious Domain Blocked",
      homograph_attack: "Homograph Attack Blocked",
      punycode_abuse: "Punycode Abuse Blocked",

      // Content threats
      suspicious_keywords: "Suspicious Keywords Detected",
      social_engineering: "Social Engineering Blocked",
      urgency_tactics: "Urgency Tactics Detected",
      trust_indicators: "Fake Trust Indicators Detected",

      // Technical threats
      dom_manipulation: "DOM Manipulation Blocked",
      form_tampering: "Form Tampering Blocked",
      content_injection: "Content Injection Blocked",

      // Behavioral threats
      unusual_behavior: "Unusual Behavior Detected",
      rapid_redirects: "Rapid Redirects Blocked",
      clipboard_access: "Clipboard Access Detected",

      // Policy events
      policy_violation: "Policy Violation",
      suspicious_activity: "Suspicious Activity Detected",
    };

    return (
      eventDisplayNames[eventType] ||
      eventType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }

  getUrlDisplay(log) {
    try {
      if (log.event?.url) {
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

        // Check if URL is already defanged (contains [.] or [:])
        const isDefanged =
          log.event.url.includes("[.]") || log.event.url.includes("[:]");

        if (isDefanged) {
          // URL is already defanged, extract hostname-like part without additional processing
          const urlStr = log.event.url;
          // Extract hostname from defanged URL
          const match = urlStr.match(/^https?\[:\]\/\/([^\/]+)/);
          if (match) {
            return match[1]; // Return the defanged hostname as-is
          }
          return urlStr; // Fallback to full defanged URL
        } else {
          // URL is not defanged - check if it should be defanged
          const shouldDefangUrl =
            threatEvents.has(log.event.type) &&
            !legitimateEvents.has(log.event.type);

          if (shouldDefangUrl) {
            // Defang the URL and then extract hostname
            const defangedUrl = log.event.url
              .replace(/:/g, "[:]")
              .replace(/\./g, "[.]");
            const match = defangedUrl.match(/^https?\[:\]\/\/([^\/]+)/);
            if (match) {
              return match[1]; // Return the defanged hostname
            }
            return defangedUrl; // Fallback to full defanged URL
          } else {
            // URL should not be defanged, parse normally and show hostname only
            const url = new URL(log.event.url);
            return url.hostname;
          }
        }
      }
      if (log.url) {
        const url = new URL(log.url);
        return url.hostname;
      }
    } catch (e) {
      // If parsing fails, return raw URL (might be defanged)
      return log.event?.url || log.url || "-";
    }
    return "-";
  }

  getThreatLevelDisplay(log) {
    const threatLevel = log.event?.threatLevel;

    if (threatLevel) {
      if (threatLevel === "none") {
        return "NONE";
      }
      return threatLevel.toUpperCase();
    }

    // Special handling for legitimate access
    if (log.event?.type === "legitimate_access") {
      return "NONE";
    }

    if (
      log.event?.type === "threat_detected" ||
      log.event?.type === "content_threat_detected"
    ) {
      return "HIGH";
    }
    if (log.category === "security") {
      return "MEDIUM";
    }
    return "-";
  }

  applyThreatLevelColor(element, threatLevelText, log) {
    // Reset any existing threat level classes
    element.classList.remove(
      "threat-critical",
      "threat-high",
      "threat-medium",
      "threat-low",
      "threat-none"
    );

    // Apply CSS class based on threat level
    const threatLevel = log.event?.threatLevel || "";
    const eventType = log.event?.type || "";

    if (threatLevel === "critical" || threatLevelText === "CRITICAL") {
      element.classList.add("threat-critical");
    } else if (threatLevel === "high" || threatLevelText === "HIGH") {
      element.classList.add("threat-high");
    } else if (threatLevel === "medium" || threatLevelText === "MEDIUM") {
      element.classList.add("threat-medium");
    } else if (threatLevel === "low" || threatLevelText === "LOW") {
      element.classList.add("threat-low");
    } else if (threatLevel === "none" || eventType === "legitimate_access") {
      element.classList.add("threat-none");
    } else {
      // Default/unknown threat level - no special class, use default color
    }
  }

  applyEventTypeColor(element, log) {
    // Reset any existing event type classes
    element.classList.remove(
      "event-type-security",
      "event-type-threat",
      "event-type-rogue",
      "event-type-legitimate",
      "event-type-access",
      "event-type-warning",
      "event-type-default"
    );

    const eventType = log.event?.type || "";
    const category = log.category || "";

    // Apply color based on event type/category - prioritize specific event types
    if (eventType === "legitimate_access" || category === "legitimate") {
      element.classList.add("event-type-legitimate");
    } else if (eventType === "rogue_app_detected" || category === "rogue_app") {
      element.classList.add("event-type-rogue");
    } else if (
      eventType === "threat_detected" ||
      eventType === "content_threat_detected" ||
      category === "security"
    ) {
      element.classList.add("event-type-security");
    } else if (category === "access" || eventType.includes("access")) {
      element.classList.add("event-type-access");
    } else if (eventType.includes("warning") || category === "warning") {
      element.classList.add("event-type-warning");
    } else if (eventType.includes("threat") || category === "threat") {
      element.classList.add("event-type-threat");
    } else {
      element.classList.add("event-type-default");
    }
  }

  getActionDisplay(log) {
    if (log.event?.action) {
      return log.event.action.replace(/_/g, " ").toUpperCase();
    }
    if (
      log.event?.type === "content_threat_detected" ||
      log.event?.type === "threat_detected"
    ) {
      return "BLOCKED";
    }
    if (log.event?.type === "url_access") {
      return "ALLOWED";
    }
    return "-";
  }

  formatLogMessage(log) {
    if (log.category === "debug") {
      return log.message || "";
    }

    // Helper function to format redirect destination
    const formatRedirectInfo = (event) => {
      let info = "";
      if (event.redirectTo) {
        info += ` → ${event.redirectTo}`;
      }
      if (event.clientId) {
        info += ` [Client: ${event.clientId}`;
        if (event.clientSuspicious) {
          info += ` ⚠️`;
          if (event.clientReason) {
            info += `: ${event.clientReason}`;
          }
        }
        info += `]`;
      }
      return info;
    };

    if (log.event) {
      switch (log.event.type) {
        case "url_access":
          try {
            return `Accessed: ${
              new URL(log.event.url).hostname
            }${formatRedirectInfo(log.event)}`;
          } catch {
            return `Accessed: ${log.event.url || "unknown"}${formatRedirectInfo(
              log.event
            )}`;
          }
        case "legitimate_access":
          try {
            return `Legitimate access: ${
              new URL(log.event.url).hostname
            }${formatRedirectInfo(log.event)}`;
          } catch {
            return `Legitimate access: ${
              log.event.url || "unknown"
            }${formatRedirectInfo(log.event)}`;
          }
        case "content_threat_detected":
          let details = `Malicious content detected`;
          if (log.event.reason) {
            details += `: ${log.event.reason}`;
          }
          if (log.event.details) {
            details += `. ${log.event.details}`;
          }
          if (log.event.analysis) {
            const analysis = log.event.analysis;
            const indicators = [];
            if (analysis.aadLike) indicators.push("AAD-like elements");
            if (analysis.formActionFail)
              indicators.push("Non-Microsoft form action");
            if (analysis.nonMicrosoftResources > 0)
              indicators.push(
                `${analysis.nonMicrosoftResources} external resources`
              );
            if (indicators.length > 0) {
              details += ` [${indicators.join(", ")}]`;
            }
          }
          return details + formatRedirectInfo(log.event);
        case "threat_detected":
        case "threat_blocked":
        case "threat_detected_no_action":
          let threatDetails = `Security threat detected`;
          if (log.event.reason) {
            threatDetails += `: ${log.event.reason}`;
          }
          if (log.event.triggeredRules && log.event.triggeredRules.length > 0) {
            const ruleNames = log.event.triggeredRules
              .map((rule) => rule.id || rule.type)
              .join(", ");
            threatDetails += ` [Triggered rules: ${ruleNames}]`;
          } else if (log.event.ruleDetails) {
            threatDetails += ` [${log.event.ruleDetails}]`;
          }
          if (
            log.event.score !== undefined &&
            log.event.threshold !== undefined
          ) {
            threatDetails += ` [Score: ${log.event.score}/${log.event.threshold}]`;
          }
          if (log.event.details) {
            threatDetails += `. ${log.event.details}`;
          }
          return threatDetails + formatRedirectInfo(log.event);
        case "form_submission":
          let formDetails = `Form submission`;
          if (log.event.action) {
            formDetails += ` to ${log.event.action.replace(/:/g, "[:]")}`;
          }
          if (log.event.reason) {
            formDetails += ` - ${log.event.reason}`;
          }
          return formDetails + formatRedirectInfo(log.event);
        case "script_injection":
          return `Security script injected to protect user`;
        case "page_scanned":
          return `Page security scan completed` + formatRedirectInfo(log.event);
        default:
          let defaultMsg =
            log.event.description || log.event.type.replace(/_/g, " ");
          if (log.event.url) {
            defaultMsg += ` on ${log.event.url.replace(/:/g, "[:]")}`;
          }
          if (log.event.reason) {
            defaultMsg += `: ${log.event.reason}`;
          }
          return defaultMsg + formatRedirectInfo(log.event);
      }
    }
    return log.message || log.type || "Unknown event";
  }

  async refreshLogs() {
    try {
      // Show a loading indicator
      if (this.elements.refreshLogs) {
        const originalText = this.elements.refreshLogs.innerHTML;
        this.elements.refreshLogs.innerHTML = "🔄 Refreshing...";
        this.elements.refreshLogs.disabled = true;

        // Reload the logs
        await this.loadLogs();

        // Show success feedback
        this.showToast("Logs refreshed successfully", "success");

        // Restore button state
        this.elements.refreshLogs.innerHTML = originalText;
        this.elements.refreshLogs.disabled = false;
      } else {
        // Fallback if button element not found
        await this.loadLogs();
        this.showToast("Logs refreshed successfully", "success");
      }
    } catch (error) {
      console.error("Failed to refresh logs:", error);
      this.showToast("Failed to refresh logs", "error");

      // Restore button state on error
      if (this.elements.refreshLogs) {
        this.elements.refreshLogs.innerHTML = "Refresh";
        this.elements.refreshLogs.disabled = false;
      }
    }
  }

  async clearLogs() {
    const confirmed = await this.showConfirmDialog(
      "Clear All Logs",
      "Are you sure you want to clear all activity logs? This action cannot be undone."
    );

    if (confirmed) {
      try {
        // Safe wrapper for chrome.* operations
        const safe = async (promise) => {
          try {
            return await promise;
          } catch (_) {
            return undefined;
          }
        };

        await safe(
          chrome.storage.local.remove([
            "securityEvents",
            "accessLogs",
            "debugLogs",
          ])
        );
        this.loadLogs();
        this.showToast("Logs cleared successfully", "success");
      } catch (error) {
        console.error("Failed to clear logs:", error);
        this.showToast("Failed to clear logs", "error");
      }
    }
  }

  async exportLogs() {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async (promise) => {
        try {
          return await promise;
        } catch (_) {
          return {};
        }
      };

      const result = await safe(
        chrome.storage.local.get(["securityEvents", "accessLogs", "debugLogs"])
      );
      const exportData = {
        securityEvents: result?.securityEvents || [],
        accessLogs: result?.accessLogs || [],
        debugLogs: result?.debugLogs || [],
        timestamp: new Date().toISOString(),
        version: chrome.runtime.getManifest().version,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `check-logs-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast("Logs exported successfully", "success");
    } catch (error) {
      console.error("Failed to export logs:", error);
      this.showToast("Failed to export logs", "error");
    }
  }

  // Detection Rules Management Methods
  async refreshDetectionRules() {
    try {
      // Update button state
      if (this.elements.refreshDetectionRules) {
        this.elements.refreshDetectionRules.innerHTML =
          '<span class="material-icons">hourglass_empty</span> Updating...';
        this.elements.refreshDetectionRules.disabled = true;
      }

      // Send message to background to force update detection rules
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "force_update_detection_rules" },
          resolve
        );
      });

      if (response?.success) {
        this.showToast("Detection rules updated successfully", "success");

        // Reload configuration display if visible
        await this.updateConfigDisplay();
      } else {
        throw new Error(response?.error || "Failed to update detection rules");
      }
    } catch (error) {
      console.error("Failed to refresh detection rules:", error);
      this.showToast(
        "Failed to update detection rules: " + error.message,
        "error"
      );
    } finally {
      // Restore button state
      if (this.elements.refreshDetectionRules) {
        this.elements.refreshDetectionRules.innerHTML =
          '<span class="material-icons">refresh</span> Update Rules Now';
        this.elements.refreshDetectionRules.disabled = false;
      }
    }
  }

  updateBrandingPreview() {
    const companyName =
      this.elements.companyName.value || this.brandingConfig.companyName;
    const companyURL =
      this.elements.companyURL.value || this.brandingConfig.companyURL;
    const productName =
      this.elements.productName.value || this.brandingConfig.productName;
    const primaryColor =
      this.elements.primaryColor.value || this.brandingConfig.primaryColor;
    const logoUrl = this.elements.logoUrl.value || this.brandingConfig.logoUrl;

    this.elements.previewTitle.textContent = productName;
    this.elements.previewButton.style.backgroundColor = primaryColor;

    if (logoUrl) {
      this.elements.previewLogo.src = logoUrl.startsWith("http")
        ? logoUrl
        : chrome.runtime.getURL(logoUrl);
    }

    // Apply primary color to the options page interface itself
    this.applyPrimaryColorToOptionsPage(primaryColor);
  }

  applyPrimaryColorToOptionsPage(primaryColor) {
    if (!primaryColor) return;

    // Remove existing primary color styles
    const existingStyle = document.getElementById("options-primary-color");
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create new style element
    const style = document.createElement("style");
    style.id = "options-primary-color";
    style.textContent = `
      :root {
        --primary-color: ${primaryColor} !important;
        --primary-hover: ${primaryColor}dd !important;
        --warning-color: ${primaryColor} !important;
      }

      /* Apply to buttons and interactive elements */
      .btn-primary {
        background-color: ${primaryColor} !important;
      }

      .btn-primary:hover {
        background-color: ${primaryColor}dd !important;
      }

      /* Apply to menu active states */
      .menu-item.active {
        background-color: ${primaryColor} !important;
        border-left-color: ${primaryColor} !important;
      }

      .menu-item.active .menu-icon,
      .menu-item.active .menu-text {
        color: white !important;
      }

      /* Apply to checkboxes and form elements */
      .setting-checkbox:checked + .checkbox-custom {
        background-color: ${primaryColor} !important;
        border-color: ${primaryColor} !important;
      }

      /* Apply to color inputs */
      .setting-color {
        border-color: ${primaryColor} !important;
      }

      /* Apply to focus states */
      .setting-input:focus,
      .setting-select:focus,
      .setting-textarea:focus {
        border-color: ${primaryColor} !important;
        box-shadow: 0 0 0 2px ${primaryColor}22 !important;
      }

      /* Apply to range sliders */
      .setting-range::-webkit-slider-thumb {
        background: ${primaryColor} !important;
      }

      .setting-range::-moz-range-thumb {
        background: ${primaryColor} !important;
      }

      .setting-range:focus::-webkit-slider-thumb {
        box-shadow: 0 0 0 3px ${primaryColor}33, 0 2px 4px rgba(0, 0, 0, 0.2) !important;
      }

      .setting-range:focus::-moz-range-thumb {
        box-shadow: 0 0 0 3px ${primaryColor}33, 0 2px 4px rgba(0, 0, 0, 0.2) !important;
      }
    `;

    document.head.appendChild(style);
  }

  markUnsavedChanges() {
    this.hasUnsavedChanges = true;
    this.updateSaveButton();
  }

  updateSaveButton() {
    if (this.hasUnsavedChanges) {
      this.elements.saveSettings.textContent = "Save Changes *";
      this.elements.saveSettings.classList.add("unsaved");
    } else {
      this.elements.saveSettings.textContent = "Save Settings";
      this.elements.saveSettings.classList.remove("unsaved");
    }
  }

  async sendMessage(message) {
    try {
      return await this.sendMessageWithRetry(message);
    } catch (error) {
      console.error("Failed to send message after retries:", error);
      throw error;
    }
  }

  // Add "respond once" guard for options page
  createOnceGuard(fn) {
    let called = false;
    return (...args) => {
      if (!called) {
        called = true;
        fn(...args);
      }
    };
  }

  showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const content = document.createElement("div");
    content.className = "toast-content";

    const messageEl = document.createElement("span");
    messageEl.className = "toast-message";
    messageEl.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.className = "toast-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = () => toast.remove();

    content.appendChild(messageEl);
    content.appendChild(closeBtn);
    toast.appendChild(content);

    this.elements.toastContainer.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }

  async showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      this.elements.modalTitle.textContent = title;
      this.elements.modalMessage.textContent = message;
      this.elements.modalOverlay.style.display = "flex";

      const handleConfirm = () => {
        this.hideModal();
        resolve(true);
        cleanup();
      };

      const handleCancel = () => {
        this.hideModal();
        resolve(false);
        cleanup();
      };

      const cleanup = () => {
        this.elements.modalConfirm.removeEventListener("click", handleConfirm);
        this.elements.modalCancel.removeEventListener("click", handleCancel);
      };

      this.elements.modalConfirm.addEventListener("click", handleConfirm);
      this.elements.modalCancel.addEventListener("click", handleCancel);
    });
  }

  hideModal() {
    this.elements.modalOverlay.style.display = "none";
  }

  async loadAboutSection() {
    try {
      // Get extension manifest for version info
      const manifest = chrome.runtime.getManifest();
      if (this.elements.extensionVersion) {
        this.elements.extensionVersion.textContent = manifest.version;
      }

      // Get detection rules version from cache
      try {
        const result = await chrome.storage.local.get([
          "detection_rules_cache",
        ]);

        if (
          result.detection_rules_cache &&
          result.detection_rules_cache.rules
        ) {
          const cachedRules = result.detection_rules_cache.rules;
          const lastUpdate = result.detection_rules_cache.lastUpdate;

          // Extract version from cached rules
          if (cachedRules.version && this.elements.rulesVersion) {
            this.elements.rulesVersion.textContent = cachedRules.version;
          } else if (this.elements.rulesVersion) {
            this.elements.rulesVersion.textContent = "Not available";
          }

          // Format last updated timestamp (prefer rules lastUpdated if available, otherwise use cache timestamp)
          if (this.elements.lastUpdated) {
            let displayDate;
            if (cachedRules.lastUpdated) {
              // Use the lastUpdated from the rules file itself
              displayDate = new Date(cachedRules.lastUpdated);
            } else if (lastUpdate) {
              // Fallback to cache timestamp
              displayDate = new Date(lastUpdate);
            }

            if (displayDate) {
              this.elements.lastUpdated.textContent =
                displayDate.toLocaleDateString() +
                " " +
                displayDate.toLocaleTimeString();
            } else {
              this.elements.lastUpdated.textContent = "Never";
            }
          }
        } else {
          if (this.elements.rulesVersion) {
            this.elements.rulesVersion.textContent = "Not cached";
          }
          if (this.elements.lastUpdated) {
            this.elements.lastUpdated.textContent = "Never";
          }
        }
      } catch (error) {
        console.error("Error loading detection rules info:", error);
        if (this.elements.rulesVersion) {
          this.elements.rulesVersion.textContent = "Error loading";
        }
        if (this.elements.lastUpdated) {
          this.elements.lastUpdated.textContent = "Error loading";
        }
      }
    } catch (error) {
      console.error("Error loading about section:", error);
    }
  }

  // Dark Mode Management
  async initializeDarkMode() {
    // Get stored theme preference
    const result = await chrome.storage.local.get(["themeMode"]);
    const stored = result.themeMode;

    let isDarkMode;

    if (stored === "dark") {
      isDarkMode = true;
    } else if (stored === "light") {
      isDarkMode = false;
    } else {
      // Default to system preference
      isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    this.applyTheme(isDarkMode);
  }

  async toggleDarkMode() {
    const html = document.documentElement;
    const currentlyDark = html.classList.contains("dark-theme");
    const newDarkMode = !currentlyDark;

    // Store preference
    await chrome.storage.local.set({
      themeMode: newDarkMode ? "dark" : "light",
    });

    this.applyTheme(newDarkMode);
  }

  applyTheme(isDarkMode) {
    const html = document.documentElement;
    const toggleIcon =
      this.elements.darkModeToggle.querySelector(".material-icons");

    if (isDarkMode) {
      html.classList.add("dark-theme");
      html.classList.remove("light-theme");
      toggleIcon.textContent = "light_mode";
    } else {
      html.classList.remove("dark-theme");
      html.classList.add("light-theme");
      toggleIcon.textContent = "dark_mode";
    }
  }
}

// Initialize options page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.checkOptions = new CheckOptions();
});
