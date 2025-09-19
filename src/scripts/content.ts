// Type definitions inline to avoid module syntax in content script
interface DetectionRules {
  m365_detection_requirements?: {
    primary_elements: Array<{ id: string; pattern: string; weight: number }>;
    secondary_elements: Array<{ id: string; pattern: string; weight: number }>;
    detection_thresholds: {
      minimum_primary_elements: number;
      minimum_total_weight: number;
      minimum_elements_overall: number;
    };
  };
  trusted_login_patterns?: string[];
  microsoft_domain_patterns?: string[];
}

interface DetectionResult {
  isPhishing: boolean;
  confidence: number;
  detectedElements: string[];
  totalWeight: number;
  primaryElementsCount: number;
  secondaryElementsCount: number;
  reasons: string[];
  appliedRules: string[];
  timestamp: string;
  url: string;
  severity?: string;
}

if ((window as any).checkExtensionLoaded) {
  console.warn('[M365-Protection] Content script already loaded, skipping re-execution');
} else {
  (window as any).checkExtensionLoaded = true;

  // Global state
  let protectionActive = false;
  let detectionRules: DetectionRules | null = null;
  let trustedLoginPatterns: string[] = [];
  let microsoftDomainPatterns: string[] = [];
  let domObserver: MutationObserver | null = null;
  let lastScanTime = 0;
  let scanCount = 0;
  let lastDetectionResult: DetectionResult | null = null;
  let developerConsoleLoggingEnabled = false;
  let showingBanner = false;
  const MAX_SCANS = 5;
  const SCAN_COOLDOWN = 1200;

  /**
   * Check if a URL matches any pattern in the given pattern array
   */
  function matchesAnyPattern(url: string, patterns: string[]): boolean {
    if (!patterns || patterns.length === 0) return false;

    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern);
        if (regex.test(url)) {
          logger.debug(`URL "${url}" matches pattern: ${pattern}`);
          return true;
        }
      } catch (error) {
        logger.warn(`Invalid regex pattern: ${pattern}`, error);
      }
    }
    return false;
  }

  /**
   * Check if current URL is from a trusted Microsoft login domain
   */
  function isTrustedLoginDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const origin = urlObj.origin;
      return matchesAnyPattern(origin, trustedLoginPatterns);
    } catch (error) {
      logger.warn('Invalid URL for trusted login domain check:', url);
      return false;
    }
  }

  /**
   * Check if current URL is from a Microsoft domain (but not necessarily login)
   */
  function isMicrosoftDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const origin = urlObj.origin;
      return matchesAnyPattern(origin, microsoftDomainPatterns);
    } catch (error) {
      logger.warn('Invalid URL for Microsoft domain check:', url);
      return false;
    }
  }

  // Conditional logger that respects developer console logging setting
  const logger = {
    log: (...args: unknown[]) => {
      if (developerConsoleLoggingEnabled) {
        console.log('[M365-Protection]', ...args);
      }
    },
    warn: (...args: unknown[]) => {
      // Always show warnings regardless of developer setting
      console.warn('[M365-Protection]', ...args);
    },
    error: (...args: unknown[]) => {
      // Always show errors regardless of developer setting
      console.error('[M365-Protection]', ...args);
    },
    debug: (...args: unknown[]) => {
      if (developerConsoleLoggingEnabled) {
        console.debug('[M365-Protection]', ...args);
      }
    },
  };

  /**
   * Load developer console logging setting from configuration
   */
  async function loadDeveloperConsoleLoggingSetting(): Promise<void> {
    try {
      const config = await new Promise<{ config?: any }>((resolve) => {
        chrome.storage.local.get(['config'], (result) => {
          resolve(result as { config?: any });
        });
      });

      developerConsoleLoggingEnabled =
        config.config?.enableDeveloperConsoleLogging === true;
    } catch (error) {
      // If there's an error loading settings, default to false
      developerConsoleLoggingEnabled = false;
      console.error(
        '[M365-Protection] Error loading developer console logging setting:',
        error
      );
    }
  }

  /**
   * Load detection rules from the rule file
   */
  async function loadDetectionRules(): Promise<DetectionRules> {
    try {
      // Try to get rules from background script first (which handles caching)
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'get_detection_rules',
        });

        if (response?.success && response.rules) {
          logger.log('Loaded detection rules from background script cache');

          const rules = response.rules;
          if (rules.trusted_login_patterns && Array.isArray(rules.trusted_login_patterns)) {
            trustedLoginPatterns = rules.trusted_login_patterns;
            logger.debug(
              `Set up ${trustedLoginPatterns.length} trusted login patterns from cache`
            );
          }
          if (rules.microsoft_domain_patterns && Array.isArray(rules.microsoft_domain_patterns)) {
            microsoftDomainPatterns = rules.microsoft_domain_patterns;
            logger.debug(
              `Set up ${microsoftDomainPatterns.length} Microsoft domain patterns from cache`
            );
          }

          return rules;
        }
      } catch (error) {
        logger.warn(
          'Failed to get rules from background script:',
          error instanceof Error ? error.message : String(error)
        );
      }

      // Fallback to direct loading
      const response = await fetch(
        chrome.runtime.getURL('rules/detection-rules.json'),
        {
          cache: 'no-cache',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rules = await response.json() as DetectionRules;

      // Set up trusted login patterns and Microsoft domain patterns from rules
      if (rules.trusted_login_patterns && Array.isArray(rules.trusted_login_patterns)) {
        trustedLoginPatterns = rules.trusted_login_patterns.slice();
        logger.debug(
          `Set up ${trustedLoginPatterns.length} trusted login patterns from direct load`
        );
      }
      if (rules.microsoft_domain_patterns && Array.isArray(rules.microsoft_domain_patterns)) {
        microsoftDomainPatterns = rules.microsoft_domain_patterns.slice();
        logger.debug(
          `Set up ${microsoftDomainPatterns.length} Microsoft domain patterns from direct load`
        );
      }

      logger.log('Loaded detection rules directly');
      return rules;
    } catch (error) {
      logger.error(
        'CRITICAL: Failed to load detection rules:',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Analyze page for phishing indicators
   */
  function analyzePageForPhishing(): DetectionResult {
    const currentUrl = window.location.href;
    const pageSource = document.documentElement.outerHTML;
    
    const result: DetectionResult = {
      isPhishing: false,
      confidence: 0,
      detectedElements: [],
      totalWeight: 0,
      primaryElementsCount: 0,
      secondaryElementsCount: 0,
      reasons: [],
      appliedRules: [],
      timestamp: new Date().toISOString(),
      url: currentUrl,
    };

    if (!detectionRules?.m365_detection_requirements) {
      result.reasons.push('No detection rules available');
      return result;
    }

    const requirements = detectionRules.m365_detection_requirements;
    let totalWeight = 0;
    let primaryCount = 0;
    let secondaryCount = 0;

    // Check primary elements
    for (const element of requirements.primary_elements) {
      if (element.pattern && new RegExp(element.pattern, 'i').test(pageSource)) {
        result.detectedElements.push(element.id);
        totalWeight += element.weight;
        primaryCount++;
        result.appliedRules.push(element.id);
      }
    }

    // Check secondary elements
    for (const element of requirements.secondary_elements) {
      if (element.pattern && new RegExp(element.pattern, 'i').test(pageSource)) {
        result.detectedElements.push(element.id);
        totalWeight += element.weight;
        secondaryCount++;
        result.appliedRules.push(element.id);
      }
    }

    result.totalWeight = totalWeight;
    result.primaryElementsCount = primaryCount;
    result.secondaryElementsCount = secondaryCount;

    const thresholds = requirements.detection_thresholds;
    
    // Determine if this is a phishing attempt
    if (primaryCount >= thresholds.minimum_primary_elements &&
        totalWeight >= thresholds.minimum_total_weight &&
        result.detectedElements.length >= thresholds.minimum_elements_overall) {
      
      // This looks like a Microsoft login page, but check if it's on a trusted domain
      if (!isTrustedLoginDomain(currentUrl)) {
        result.isPhishing = true;
        result.confidence = Math.min(totalWeight / thresholds.minimum_total_weight, 1);
        result.reasons.push('Microsoft 365 login page detected on untrusted domain');
        result.severity = result.confidence > 0.8 ? 'high' : 'medium';
      } else {
        result.reasons.push('Microsoft 365 login page on trusted domain');
      }
    } else {
      result.reasons.push('Insufficient indicators for Microsoft 365 login page');
    }

    return result;
  }

  /**
   * Block the current page
   */
  function blockCurrentPage(detectionResult: DetectionResult): void {
    const blockUrl = chrome.runtime.getURL('blocked.html');
    const details = encodeURIComponent(JSON.stringify({
      url: window.location.href,
      reason: 'Potential Microsoft 365 phishing attempt detected',
      detectedElements: detectionResult.detectedElements,
      confidence: detectionResult.confidence,
      timestamp: detectionResult.timestamp,
    }));
    
    window.location.href = `${blockUrl}?details=${details}`;
  }

  /**
   * Main protection logic
   */
  async function runProtection(): Promise<void> {
    try {
      const currentUrl = window.location.href;
      
      // Skip if already showing banner or if this is our blocked page
      if (showingBanner || currentUrl.includes('blocked.html')) {
        return;
      }

      // Rate limiting
      const now = Date.now();
      if (now - lastScanTime < SCAN_COOLDOWN || scanCount >= MAX_SCANS) {
        return;
      }

      lastScanTime = now;
      scanCount++;

      // Load developer console logging setting
      await loadDeveloperConsoleLoggingSetting();

      // Load detection rules if not already loaded
      if (!detectionRules) {
        detectionRules = await loadDetectionRules();
      }

      // Skip if on trusted domain
      if (isTrustedLoginDomain(currentUrl)) {
        logger.debug('Skipping scan - trusted login domain');
        return;
      }

      // Analyze page for phishing
      const detectionResult = analyzePageForPhishing();
      lastDetectionResult = detectionResult;

      if (detectionResult.isPhishing) {
        logger.warn('Phishing attempt detected!', detectionResult);
        
        // Block the page
        blockCurrentPage(detectionResult);
      } else {
        logger.debug('No phishing detected', detectionResult);
      }

    } catch (error) {
      logger.error(
        'Error in protection logic:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Initialize protection when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runProtection);
  } else {
    runProtection();
  }

  // Set up DOM observer for dynamic content changes
  if (typeof MutationObserver !== 'undefined') {
    domObserver = new MutationObserver(() => {
      if (!showingBanner) {
        runProtection();
      }
    });

    domObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Make test functions available globally for debugging
  (window as any).testDetectionPatterns = function() {
    console.log('🔍 MANUAL DETECTION TESTING');
    if (lastDetectionResult) {
      console.log('Last detection result:', lastDetectionResult);
    } else {
      console.log('No detection results available. Run protection first.');
    }
    return lastDetectionResult;
  };
}