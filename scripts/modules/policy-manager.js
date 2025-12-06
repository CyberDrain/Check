/**
 * Policy Manager for Check
 * Handles enterprise policies, permissions, and compliance enforcement
 * Supports both Chrome (managed storage) and Firefox (3rdparty policies)
 */

import { chrome, storage } from "../browser-polyfill.js";
import logger from "../utils/logger.js";

export class PolicyManager {
  constructor() {
    this.policies = null;
    this.enterprisePolicies = null;
    this.isInitialized = false;
    this.complianceMode = false;
  }

  async initialize() {
    try {
      await this.loadPolicies();
      this.isInitialized = true;
      logger.log("Check: Policy manager initialized successfully");
    } catch (error) {
      logger.error("Check: Failed to initialize policy manager:", error);
      throw error;
    }
  }

  async loadPolicies() {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async (promise) => {
        try { return await promise; } catch(_) { return {}; }
      };
      
      // Load enterprise policies from managed storage
      this.enterprisePolicies = await this.loadEnterprisePolicies();

      // Load local policies with safe wrapper
      const localPolicies = await safe(storage.local.get(["policies"]));

      // Merge policies with enterprise taking precedence
      this.policies = this.mergePolicies(
        localPolicies?.policies,
        this.enterprisePolicies
      );

      // Set compliance mode based on enterprise policies
      this.complianceMode = this.enterprisePolicies?.complianceMode || false;

      logger.log("Check: Policies loaded successfully");
    } catch (error) {
      logger.error("Check: Failed to load policies:", error);
      this.loadDefaultPolicies();
    }
  }

  async loadEnterprisePolicies() {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async (promise) => {
        try { return await promise; } catch(_) { return {}; }
      };
      
      // Firefox uses 3rdparty extension policies instead of managed storage
      if (this.isFirefox) {
        logger.log("Check: Firefox detected, policies loaded via 3rdparty extension settings (handled by ConfigManager)");
        // Firefox policies are loaded through the extension's configuration system
        // which reads from browser.storage.managed automatically
        return {};
      }
      
      // Chrome/Edge: Load from managed storage
      const managedPolicies = await safe(storage.managed.get(["policies"]));
      return managedPolicies?.policies || {};
    } catch (error) {
      logger.log("Check: No enterprise policies available");
      return {};
    }
  }

  mergePolicies(localPolicies, enterprisePolicies) {
    const defaultPolicies = this.getDefaultPolicies();

    // Start with defaults
    let merged = { ...defaultPolicies };

    // Apply local policies
    if (localPolicies) {
      merged = { ...merged, ...localPolicies };
    }

    // Apply enterprise policies (highest precedence)
    if (enterprisePolicies) {
      merged = { ...merged, ...enterprisePolicies };

      // Mark enterprise-enforced policies
      if (enterprisePolicies.enforcedPolicies) {
        merged.enforcedPolicies = enterprisePolicies.enforcedPolicies;
      }
    }

    return merged;
  }

  getDefaultPolicies() {
    return {
      // Content manipulation policies
      contentManipulation: {
        enabled: true,
        allowedDomains: ["*"],
        blockedDomains: [],
        allowScriptInjection: true,
        allowStyleInjection: true,
        allowDomModification: true,
        requireUserConfirmation: false,
      },

      // URL access policies
      urlAccess: {
        blockMaliciousUrls: true,
        blockPhishingUrls: true,
        allowBypassForAdmins: false,
        logAllAccess: true,
        enableRealTimeScanning: true,
      },

      // Data collection policies
      dataCollection: {
        collectBrowsingHistory: false,
        collectFormData: false,
        collectUserInput: false,
        logSecurityEvents: true,
        anonymizeData: true,
        retentionPeriod: 30, // days
      },

      // Privacy policies
      privacy: {
        respectDoNotTrack: true,
        enableIncognitoMode: true,
        disableInPrivateBrowsing: false,
        shareDataWithThirdParties: false,
      },

      // Security policies
      security: {
        enableCSPEnforcement: true,
        blockMixedContent: true,
        enforceHTTPS: false,
        validateCertificates: true,
        enableHSTS: true,
      },

      // User interface policies
      userInterface: {
        showSecurityWarnings: true,
        allowUserOverrides: true,
        enableNotifications: true,
        showBrandingElements: true,
        customizableTheme: true,
      },

      // Administrative policies
      administration: {
        allowConfigurationChanges: true,
        requireAdminPassword: false,
        enableRemoteManagement: false,
        autoUpdate: true,
        telemetryEnabled: false,
      },

      // Compliance policies
      compliance: {
        enableAuditLogging: false,
        requireDigitalSignatures: false,
        enforceDataRetention: false,
        enableComplianceReporting: false,
      },
    };
  }

  async checkPolicy(action, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result = {
      allowed: true,
      reason: "",
      requiresConfirmation: false,
      restrictions: [],
    };

    try {
      switch (action) {
        case "CONTENT_MANIPULATION":
          return this.checkContentManipulationPolicy(context);

        case "URL_ACCESS":
          return this.checkUrlAccessPolicy(context);

        case "DATA_COLLECTION":
          return this.checkDataCollectionPolicy(context);

        case "SCRIPT_INJECTION":
          return this.checkScriptInjectionPolicy(context);

        case "CONFIGURATION_CHANGE":
          return this.checkConfigurationChangePolicy(context);

        case "PRIVACY_MODE":
          return this.checkPrivacyModePolicy(context);

        default:
          result.reason = "Unknown action";
          return result;
      }
    } catch (error) {
      logger.error("Check: Policy check failed:", error);
      result.allowed = false;
      result.reason = "Policy check failed";
      return result;
    }
  }

  checkContentManipulationPolicy(context) {
    const policy = this.policies.contentManipulation;
    const result = {
      allowed: policy.enabled,
      reason: "",
      requiresConfirmation: policy.requireUserConfirmation,
      restrictions: [],
    };

    if (!policy.enabled) {
      result.reason = "Content manipulation disabled by policy";
      return result;
    }

    // Check domain restrictions
    if (context.domain) {
      const isBlocked = policy.blockedDomains.some((domain) =>
        this.matchesDomain(context.domain, domain)
      );

      if (isBlocked) {
        result.allowed = false;
        result.reason = "Domain blocked for content manipulation";
        return result;
      }

      const isAllowed =
        policy.allowedDomains.includes("*") ||
        policy.allowedDomains.some((domain) =>
          this.matchesDomain(context.domain, domain)
        );

      if (!isAllowed) {
        result.allowed = false;
        result.reason = "Domain not in allowed list for content manipulation";
        return result;
      }
    }

    // Check manipulation type restrictions
    if (context.manipulationType) {
      switch (context.manipulationType) {
        case "script":
          if (!policy.allowScriptInjection) {
            result.allowed = false;
            result.reason = "Script injection disabled by policy";
          }
          break;
        case "style":
          if (!policy.allowStyleInjection) {
            result.allowed = false;
            result.reason = "Style injection disabled by policy";
          }
          break;
        case "dom":
          if (!policy.allowDomModification) {
            result.allowed = false;
            result.reason = "DOM modification disabled by policy";
          }
          break;
      }
    }

    return result;
  }

  checkUrlAccessPolicy(context) {
    const policy = this.policies.urlAccess;
    const result = {
      allowed: true,
      reason: "",
      requiresConfirmation: false,
      restrictions: [],
    };

    // Check if URL blocking is enabled
    if (!policy.blockMaliciousUrls && !policy.blockPhishingUrls) {
      result.reason = "URL blocking disabled";
      return result;
    }

    // Check threat level
    if (context.threatLevel) {
      if (context.threatLevel === "malicious" && policy.blockMaliciousUrls) {
        result.allowed = false;
        result.reason = "Malicious URL blocked by policy";
      } else if (
        context.threatLevel === "phishing" &&
        policy.blockPhishingUrls
      ) {
        result.allowed = false;
        result.reason = "Phishing URL blocked by policy";
      }
    }

    // Check admin bypass
    if (!result.allowed && policy.allowBypassForAdmins && context.isAdmin) {
      result.allowed = true;
      result.requiresConfirmation = true;
      result.reason = "Admin bypass available";
    }

    return result;
  }

  checkDataCollectionPolicy(context) {
    const policy = this.policies.dataCollection;
    const result = {
      allowed: false,
      reason: "",
      requiresConfirmation: false,
      restrictions: [],
    };

    switch (context.dataType) {
      case "browsing_history":
        result.allowed = policy.collectBrowsingHistory;
        result.reason = policy.collectBrowsingHistory
          ? "Browsing history collection allowed"
          : "Browsing history collection disabled";
        break;

      case "form_data":
        result.allowed = policy.collectFormData;
        result.reason = policy.collectFormData
          ? "Form data collection allowed"
          : "Form data collection disabled";
        break;

      case "user_input":
        result.allowed = policy.collectUserInput;
        result.reason = policy.collectUserInput
          ? "User input collection allowed"
          : "User input collection disabled";
        break;

      case "security_events":
        result.allowed = policy.logSecurityEvents;
        result.reason = policy.logSecurityEvents
          ? "Security event logging allowed"
          : "Security event logging disabled";
        break;

      default:
        result.reason = "Unknown data type";
    }

    return result;
  }

  checkScriptInjectionPolicy(context) {
    const policy = this.policies.contentManipulation;
    const securityPolicy = this.policies.security;

    const result = {
      allowed: policy.allowScriptInjection,
      reason: "",
      requiresConfirmation: policy.requireUserConfirmation,
      restrictions: [],
    };

    if (!policy.allowScriptInjection) {
      result.reason = "Script injection disabled by policy";
      return result;
    }

    // Check CSP enforcement
    if (securityPolicy.enableCSPEnforcement && context.hasCSP) {
      result.restrictions.push("CSP_ENFORCEMENT");
      result.reason = "Script injection restricted by CSP policy";
    }

    return result;
  }

  checkConfigurationChangePolicy(context) {
    const policy = this.policies.administration;
    const result = {
      allowed: policy.allowConfigurationChanges,
      reason: "",
      requiresConfirmation: policy.requireAdminPassword,
      restrictions: [],
    };

    if (!policy.allowConfigurationChanges) {
      result.reason = "Configuration changes disabled by policy";
      return result;
    }

    // Check if this is an enterprise-enforced setting
    if (
      this.policies.enforcedPolicies &&
      context.configKey &&
      this.policies.enforcedPolicies[context.configKey]?.locked
    ) {
      result.allowed = false;
      result.reason = "Configuration locked by enterprise policy";
      return result;
    }

    return result;
  }

  checkPrivacyModePolicy(context) {
    const policy = this.policies.privacy;
    const result = {
      allowed: true,
      reason: "",
      requiresConfirmation: false,
      restrictions: [],
    };

    if (context.isIncognito && policy.disableInPrivateBrowsing) {
      result.allowed = false;
      result.reason = "Extension disabled in private browsing mode";
      return result;
    }

    if (context.doNotTrack && policy.respectDoNotTrack) {
      result.restrictions.push("DO_NOT_TRACK");
      result.reason = "Respecting Do Not Track preference";
    }

    return result;
  }

  async checkContentManipulation(domain) {
    return this.checkPolicy("CONTENT_MANIPULATION", { domain });
  }

  matchesDomain(testDomain, policyDomain) {
    if (policyDomain === "*") return true;
    if (policyDomain.startsWith("*.")) {
      return testDomain.endsWith(policyDomain.substring(2));
    }
    return testDomain === policyDomain;
  }

  async updatePolicies(newPolicies) {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async (promise) => {
        try { return await promise; } catch(_) { return undefined; }
      };
      
      // Prevent updating enterprise-enforced policies
      if (this.enterprisePolicies?.enforcedPolicies) {
        Object.keys(this.enterprisePolicies.enforcedPolicies).forEach(
          (policy) => {
            if (this.enterprisePolicies.enforcedPolicies[policy]?.locked) {
              delete newPolicies[policy];
            }
          }
        );
      }

      // Merge with existing policies
      const updatedPolicies = { ...this.policies, ...newPolicies };

      // Save to storage with safe wrapper
      await safe(storage.local.set({ policies: updatedPolicies }));
      this.policies = updatedPolicies;

      logger.log("Check: Policies updated");
    } catch (error) {
      logger.error("Check: Failed to update policies:", error);
      throw error;
    }
  }

  async getPolicies() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.policies;
  }

  getEnforcedPolicies() {
    return this.policies?.enforcedPolicies || {};
  }

  isComplianceMode() {
    return this.complianceMode;
  }

  async generateComplianceReport() {
    if (!this.complianceMode) {
      throw new Error("Compliance mode not enabled");
    }

    const report = {
      timestamp: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      browser: this.isFirefox ? 'Firefox' : 'Chrome/Edge',
      policies: this.policies,
      enforcedPolicies: this.policies?.enforcedPolicies || {},
      violations: this.getComplianceViolations(),
      auditLog: await this.getAuditLog(),
    };

    return report;
  }

  getComplianceViolations() {
    // Implementation would check for policy violations
    // This is a placeholder for actual compliance checking logic
    return [];
  }

  async getAuditLog() {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async (promise) => {
        try { return await promise; } catch(_) { return {}; }
      };
      
      const auditLog = await safe(storage.local.get(["auditLog"]));
      return auditLog?.auditLog || [];
    } catch (error) {
      logger.error("Check: Failed to get audit log:", error);
      return [];
    }
  }

  async logAuditEvent(event) {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async (promise) => {
        try { return await promise; } catch(_) { return {}; }
      };
      
      const auditEntry = {
        timestamp: new Date().toISOString(),
        event,
        user: "system", // Could be enhanced to track actual users
        source: "policy_manager",
      };

      const auditLog = await safe(storage.local.get(["auditLog"]));
      const logs = auditLog?.auditLog || [];
      logs.push(auditEntry);

      // Keep only last 10000 audit entries
      if (logs.length > 10000) {
        logs.splice(0, logs.length - 10000);
      }

      await safe(storage.local.set({ auditLog: logs }));
    } catch (error) {
      logger.error("Check: Failed to log audit event:", error);
    }
  }

  loadDefaultPolicies() {
    this.policies = this.getDefaultPolicies();
    logger.log("Check: Using default policies");
  }
}
