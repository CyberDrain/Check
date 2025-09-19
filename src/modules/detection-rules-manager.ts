import logger from '../utils/logger';
import type { DetectionRules } from '../../types/detection';
import type { ExtensionConfig } from '../../types/config';

interface CachedRules {
  rules: DetectionRules;
  lastUpdate: number;
  source: string;
}

/**
 * Detection Rules Manager for Check
 * Handles remote fetching, caching, and management of detection rules
 */
export class DetectionRulesManager {
  private cachedRules: DetectionRules | null = null;
  private lastUpdate: number = 0;
  private updateInterval: number = 24 * 60 * 60 * 1000; // Default: 24 hours
  private readonly cacheKey = 'detection_rules_cache';
  private readonly fallbackUrl: string;
  private remoteUrl: string;
  private config: ExtensionConfig | null = null;
  private initialized = false;

  constructor() {
    this.fallbackUrl = chrome.runtime.getURL('rules/detection-rules.json');
    this.remoteUrl = 
      'https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/rules/detection-rules.json';
  }

  async initialize(): Promise<void> {
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
            'Failed to update detection rules in background:',
            error instanceof Error ? error.message : String(error)
          );
        });
      }

      this.initialized = true;
      logger.log('DetectionRulesManager initialized successfully');
    } catch (error) {
      logger.error(
        'Failed to initialize DetectionRulesManager:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async loadConfiguration(): Promise<void> {
    try {
      // Load from chrome storage to get user configuration
      const result = await chrome.storage.local.get(['config']);
      this.config = (result as { config?: ExtensionConfig }).config || {};

      // Set remote URL from configuration or use default
      if (this.config.customRulesUrl) {
        this.remoteUrl = this.config.customRulesUrl;
      }

      // Set update interval from configuration
      if (this.config.updateInterval) {
        this.updateInterval = this.config.updateInterval * 60 * 60 * 1000; // Convert hours to milliseconds
      }

      logger.log('DetectionRulesManager configuration loaded:', {
        remoteUrl: this.remoteUrl,
        updateInterval: this.updateInterval,
      });
    } catch (error) {
      logger.warn(
        'Failed to load configuration, using defaults:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async loadFromCache(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get([this.cacheKey]);
      const cached = (result as { [key: string]: CachedRules })[this.cacheKey];

      if (cached?.rules && cached.lastUpdate) {
        // Check if cache is still valid
        const now = Date.now();
        const cacheAge = now - cached.lastUpdate;

        if (cacheAge < this.updateInterval) {
          this.cachedRules = cached.rules;
          this.lastUpdate = cached.lastUpdate;
          logger.log('Detection rules loaded from cache');
          return true;
        } else {
          logger.log('Cached detection rules expired, will fetch new ones');
        }
      }

      return false;
    } catch (error) {
      logger.warn(
        'Failed to load detection rules from cache:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  async saveToCache(rules: DetectionRules): Promise<void> {
    try {
      const cacheData: CachedRules = {
        rules,
        lastUpdate: Date.now(),
        source: this.remoteUrl,
      };

      await chrome.storage.local.set({ [this.cacheKey]: cacheData });
      this.cachedRules = rules;
      this.lastUpdate = cacheData.lastUpdate;

      logger.log('Detection rules saved to cache');
    } catch (error) {
      logger.warn(
        'Failed to save detection rules to cache:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async fetchDetectionRules(): Promise<DetectionRules> {
    // Try to fetch from remote URL first
    if (this.remoteUrl && this.remoteUrl !== this.fallbackUrl) {
      try {
        logger.log('Fetching detection rules from remote URL:', this.remoteUrl);

        const response = await fetch(this.remoteUrl, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const rules = await response.json() as DetectionRules;
        logger.log('Successfully fetched detection rules from remote URL');

        // Save to cache
        await this.saveToCache(rules);
        return rules;
      } catch (error) {
        logger.warn(
          'Failed to fetch rules from remote URL:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Fallback to local rules
    try {
      logger.log('Falling back to local detection rules');
      const response = await fetch(this.fallbackUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rules = await response.json() as DetectionRules;
      logger.log('Successfully loaded local detection rules');

      // Save to cache as fallback
      await this.saveToCache(rules);
      return rules;
    } catch (error) {
      logger.error(
        'Failed to load local detection rules:',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  async updateDetectionRules(): Promise<DetectionRules> {
    try {
      const rules = await this.fetchDetectionRules();

      // Notify other parts of the extension that rules have been updated
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime
          .sendMessage({
            type: 'detection_rules_updated',
            timestamp: Date.now(),
          })
          .catch(() => {
            // Ignore errors if no listeners
          });
      }

      logger.log('Detection rules updated successfully');
      return rules;
    } catch (error) {
      logger.error(
        'Failed to update detection rules:',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  async getDetectionRules(): Promise<DetectionRules> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.cachedRules) {
      return this.cachedRules;
    }

    // If no cached rules, fetch them
    return this.fetchDetectionRules();
  }

  getCachedRules(): DetectionRules | null {
    return this.cachedRules;
  }

  getLastUpdateTime(): number {
    return this.lastUpdate;
  }

  isUpdateDue(): boolean {
    const now = Date.now();
    return (now - this.lastUpdate) > this.updateInterval;
  }

  async forceUpdate(): Promise<DetectionRules> {
    return this.updateDetectionRules();
  }
}