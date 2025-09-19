import logger from '../utils/logger';

interface PolicyCheckResult {
  allowed: boolean;
  reason: string;
  requiresConfirmation: boolean;
  restrictions: string[];
}

interface PolicyConfig {
  contentManipulation: {
    enabled: boolean;
    allowedDomains: string[];
    blockedDomains: string[];
    allowScriptInjection: boolean;
    allowStyleInjection: boolean;
    allowDomModification: boolean;
    requireUserConfirmation: boolean;
  };
  urlAccess: {
    blockMaliciousUrls: boolean;
    blockPhishingUrls: boolean;
    allowBypassForAdmins: boolean;
    logAllAccess: boolean;
    enableRealTimeScanning: boolean;
  };
  dataCollection: {
    collectBrowsingHistory: boolean;
    collectFormData: boolean;
    collectUserInput: boolean;
    logSecurityEvents: boolean;
    anonymizeData: boolean;
    retentionPeriod: number;
  };
  privacy: {
    respectDoNotTrack: boolean;
    enableIncognitoMode: boolean;
    disableInPrivateBrowsing: boolean;
    shareDataWithThirdParties: boolean;
  };
  security: {
    enableCSPEnforcement: boolean;
    blockMixedContent: boolean;
    enforceHTTPS: boolean;
    validateCertificates: boolean;
    enableHSTS: boolean;
  };
  userInterface: {
    showSecurityWarnings: boolean;
    allowUserOverrides: boolean;
    enableNotifications: boolean;
    showBrandingElements: boolean;
    customizableTheme: boolean;
  };
  administration: {
    allowConfigurationChanges: boolean;
    requireAdminPassword: boolean;
    enableRemoteManagement: boolean;
    autoUpdate: boolean;
    telemetryEnabled: boolean;
  };
  compliance: {
    enableAuditLogging: boolean;
    requireDigitalSignatures: boolean;
    enforceDataRetention: boolean;
    enableComplianceReporting: boolean;
  };
  enforcedPolicies?: Record<string, { locked: boolean }>;
}

/**
 * Policy Manager for Check
 * Handles enterprise policies, permissions, and compliance enforcement
 */
export class PolicyManager {
  private policies: PolicyConfig | null = null;
  private enterprisePolicies: Partial<PolicyConfig> | null = null;
  private isInitialized = false;
  private complianceMode = false;

  async initialize(): Promise<void> {
    try {
      await this.loadPolicies();
      this.isInitialized = true;
      logger.log('Check: Policy manager initialized successfully');
    } catch (error) {
      logger.error('Check: Failed to initialize policy manager:', error);
      throw error;
    }
  }

  async loadPolicies(): Promise<void> {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async <T>(promise: Promise<T>): Promise<T | Record<string, never>> => {
        try { 
          return await promise; 
        } catch {
          return {}; 
        }
      };
      
      // Load enterprise policies from managed storage
      this.enterprisePolicies = await this.loadEnterprisePolicies();

      // Load local policies with safe wrapper
      const localPolicies = await safe(chrome.storage.local.get(['policies']));

      // Merge policies with enterprise taking precedence
      this.policies = this.mergePolicies(
        (localPolicies as { policies?: Partial<PolicyConfig> }).policies,
        this.enterprisePolicies
      );

      // Set compliance mode based on enterprise policies
      this.complianceMode = this.enterprisePolicies?.compliance?.enableAuditLogging || false;

      logger.log('Check: Policies loaded successfully');
    } catch (error) {
      logger.error('Check: Failed to load policies:', error);
      this.loadDefaultPolicies();
    }
  }

  async loadEnterprisePolicies(): Promise<Partial<PolicyConfig>> {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async <T>(promise: Promise<T>): Promise<T | Record<string, never>> => {
        try { 
          return await promise; 
        } catch {
          return {}; 
        }
      };
      
      const managedPolicies = await safe(chrome.storage.managed.get(['policies']));
      return (managedPolicies as { policies?: Partial<PolicyConfig> }).policies || {};
    } catch (error) {
      logger.log('Check: No enterprise policies available');
      return {};
    }
  }

  mergePolicies(
    localPolicies?: Partial<PolicyConfig>,
    enterprisePolicies?: Partial<PolicyConfig>
  ): PolicyConfig {
    const defaultPolicies = this.getDefaultPolicies();

    // Start with defaults
    let merged = { ...defaultPolicies };

    // Apply local policies
    if (localPolicies) {
      merged = { 
        ...merged, 
        ...this.deepMerge(merged, localPolicies)
      };
    }

    // Apply enterprise policies (highest precedence)
    if (enterprisePolicies) {
      merged = { 
        ...merged, 
        ...this.deepMerge(merged, enterprisePolicies)
      };

      // Mark enterprise-enforced policies
      if (enterprisePolicies.enforcedPolicies) {
        merged.enforcedPolicies = enterprisePolicies.enforcedPolicies;
      }
    }

    return merged;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  getDefaultPolicies(): PolicyConfig {
    return {
      // Content manipulation policies
      contentManipulation: {
        enabled: true,
        allowedDomains: ['*'],
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

  loadDefaultPolicies(): void {
    this.policies = this.getDefaultPolicies();
    this.complianceMode = false;
  }

  async checkPolicy(action: string, context: Record<string, unknown> = {}): Promise<PolicyCheckResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result: PolicyCheckResult = {
      allowed: true,
      reason: '',
      requiresConfirmation: false,
      restrictions: [],
    };

    if (!this.policies) {
      return result;
    }

    try {
      switch (action) {
        case 'CONTENT_MANIPULATION':
          return this.checkContentManipulationPolicy(context);

        case 'URL_ACCESS':
          return this.checkUrlAccessPolicy(context);

        case 'DATA_COLLECTION':
          return this.checkDataCollectionPolicy(context);

        case 'SCRIPT_INJECTION':
          return this.checkScriptInjectionPolicy(context);

        case 'CONFIGURATION_CHANGE':
          return this.checkConfigurationChangePolicy(context);

        default:
          return result;
      }
    } catch (error) {
      logger.error('Check: Failed to check policy:', error);
      return {
        allowed: false,
        reason: 'Policy check failed',
        requiresConfirmation: false,
        restrictions: [],
      };
    }
  }

  private checkContentManipulationPolicy(context: Record<string, unknown>): PolicyCheckResult {
    if (!this.policies?.contentManipulation.enabled) {
      return {
        allowed: false,
        reason: 'Content manipulation is disabled by policy',
        requiresConfirmation: false,
        restrictions: ['content_manipulation_disabled'],
      };
    }

    return {
      allowed: true,
      reason: '',
      requiresConfirmation: this.policies.contentManipulation.requireUserConfirmation,
      restrictions: [],
    };
  }

  private checkUrlAccessPolicy(context: Record<string, unknown>): PolicyCheckResult {
    const url = context.url as string;
    
    if (!this.policies?.urlAccess.enableRealTimeScanning) {
      return {
        allowed: true,
        reason: 'Real-time scanning disabled',
        requiresConfirmation: false,
        restrictions: ['no_real_time_scanning'],
      };
    }

    if (this.policies.urlAccess.blockPhishingUrls && context.isPhishing) {
      return {
        allowed: false,
        reason: 'URL blocked as potential phishing attempt',
        requiresConfirmation: false,
        restrictions: ['phishing_blocked'],
      };
    }

    return {
      allowed: true,
      reason: '',
      requiresConfirmation: false,
      restrictions: [],
    };
  }

  private checkDataCollectionPolicy(context: Record<string, unknown>): PolicyCheckResult {
    if (!this.policies?.dataCollection.logSecurityEvents) {
      return {
        allowed: false,
        reason: 'Security event logging is disabled by policy',
        requiresConfirmation: false,
        restrictions: ['no_security_logging'],
      };
    }

    return {
      allowed: true,
      reason: '',
      requiresConfirmation: false,
      restrictions: [],
    };
  }

  private checkScriptInjectionPolicy(context: Record<string, unknown>): PolicyCheckResult {
    if (!this.policies?.contentManipulation.allowScriptInjection) {
      return {
        allowed: false,
        reason: 'Script injection is disabled by policy',
        requiresConfirmation: false,
        restrictions: ['no_script_injection'],
      };
    }

    return {
      allowed: true,
      reason: '',
      requiresConfirmation: false,
      restrictions: [],
    };
  }

  private checkConfigurationChangePolicy(context: Record<string, unknown>): PolicyCheckResult {
    if (!this.policies?.administration.allowConfigurationChanges) {
      return {
        allowed: false,
        reason: 'Configuration changes are disabled by policy',
        requiresConfirmation: false,
        restrictions: ['config_changes_disabled'],
      };
    }

    return {
      allowed: true,
      reason: '',
      requiresConfirmation: this.policies.administration.requireAdminPassword,
      restrictions: [],
    };
  }

  getPolicies(): PolicyConfig | null {
    return this.policies;
  }

  isComplianceMode(): boolean {
    return this.complianceMode;
  }

  isEnterpriseManaged(): boolean {
    return this.enterprisePolicies !== null && Object.keys(this.enterprisePolicies).length > 0;
  }
}