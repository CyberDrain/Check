import logger from '../utils/logger';
import type { ExtensionConfig, BrandingConfig, EnterpriseConfig } from '../../types/config';

export class ConfigManager {
  private config: ExtensionConfig | null = null;
  private brandingConfig: BrandingConfig | null = null;
  private enterpriseConfig: EnterpriseConfig | null = null;

  async loadConfig(): Promise<ExtensionConfig> {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async <T>(promise: Promise<T>): Promise<T | Record<string, never>> => {
        try {
          return await promise;
        } catch {
          return {};
        }
      };

      // Load enterprise configuration from managed storage (GPO/Intune)
      this.enterpriseConfig = await this.loadEnterpriseConfig();

      // Load local configuration with safe wrapper
      const localConfig = await safe(chrome.storage.local.get(['config']));

      // Load branding configuration
      this.brandingConfig = await this.loadBrandingConfig();

      // Merge configurations with enterprise taking precedence
      this.config = this.mergeConfigurations(
        (localConfig as { config?: ExtensionConfig }).config,
        this.enterpriseConfig,
        this.brandingConfig
      );

      logger.log('Check: Configuration loaded successfully');
      return this.config;
    } catch (error) {
      logger.error('Check: Failed to load configuration:', error);
      throw error;
    }
  }

  async loadEnterpriseConfig(): Promise<EnterpriseConfig> {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async <T>(promise: Promise<T>): Promise<T | Record<string, never>> => {
        try {
          return await promise;
        } catch {
          return {};
        }
      };

      // Check if we're in development mode for mock policies
      const isDevelopment = this.isDevelopmentMode();

      // Check if enterprise simulation mode is enabled (dev only)
      let simulateEnterpriseMode = false;
      if (isDevelopment) {
        const simulateMode = await safe(
          chrome.storage.local.get(['simulateEnterpriseMode'])
        );
        simulateEnterpriseMode = (simulateMode as { simulateEnterpriseMode?: boolean }).simulateEnterpriseMode || false;
      }

      if (isDevelopment && simulateEnterpriseMode) {
        // Return mock enterprise configuration for development/testing
        logger.log(
          'Check: Using mock enterprise configuration (simulate mode enabled)'
        );
        return {
          // Extension configuration
          showNotifications: true,
          enableValidPageBadge: true,
          enablePageBlocking: true,
          enableCippReporting: false,
          cippServerUrl: '',
          cippTenantId: '',
          customRulesUrl:
            'https://raw.githubusercontent.com/CyberDrain/ProjectX/refs/heads/main/rules/detection-rules.json',
          updateInterval: 24,
          enableDebugLogging: false,

          // Custom branding (matches managed_schema.json structure)
          customBranding: {
            companyName: 'CyberDrain',
            productName: 'Check Enterprise',
            primaryColor: '#F77F00',
            logoUrl: 'https://cyberdrain.com/images/favicon_hu_20e77b0e20e363e.png',
          },
        };
      }

      // Attempt to load from managed storage (deployed via GPO/Intune)
      const managedConfig = await safe(chrome.storage.managed.get());

      if (managedConfig && Object.keys(managedConfig).length > 0) {
        logger.log('Check: Enterprise configuration found');
        return managedConfig as EnterpriseConfig;
      }

      return {};
    } catch (error) {
      logger.log('Check: No enterprise configuration available');
      return {};
    }
  }

  isDevelopmentMode(): boolean {
    // Check if we're in development mode
    try {
      // Check if we're running in an extension context and in development
      const manifestData = chrome.runtime.getManifest();
      const isDev = !('update_url' in manifestData); // No update_url means unpacked extension
      return isDev;
    } catch {
      return false;
    }
  }

  async loadBrandingConfig(): Promise<BrandingConfig> {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async <T>(promise: Promise<T>): Promise<T | null> => {
        try {
          return await promise;
        } catch {
          return null;
        }
      };

      // First, try to load user-configured branding from storage
      const userBranding = await safe(
        chrome.storage.local.get(['brandingConfig'])
      );

      if (userBranding && (userBranding as { brandingConfig?: BrandingConfig }).brandingConfig) {
        logger.log('Check: Using user-configured branding from storage');
        return (userBranding as { brandingConfig: BrandingConfig }).brandingConfig;
      }

      // Fallback: Load branding configuration from config file with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          chrome.runtime.getURL('config/branding.json'),
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const brandingConfig = await response.json();
        logger.log('Check: Using branding from config file');
        return brandingConfig as BrandingConfig;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      logger.log('Check: Using default branding configuration');
      return this.getDefaultBrandingConfig();
    }
  }

  mergeConfigurations(
    localConfig?: ExtensionConfig,
    enterpriseConfig?: EnterpriseConfig,
    brandingConfig?: BrandingConfig
  ): ExtensionConfig {
    const defaultConfig = this.getDefaultConfig();

    // Handle enterprise custom branding separately
    let finalBrandingConfig = brandingConfig;
    if (enterpriseConfig?.customBranding) {
      // Enterprise custom branding takes precedence over file-based branding
      finalBrandingConfig = {
        ...brandingConfig,
        ...enterpriseConfig.customBranding,
      };
    }

    // Merge in order of precedence: enterprise > local > branding > default
    const merged: ExtensionConfig = {
      ...defaultConfig,
      ...finalBrandingConfig,
      ...localConfig,
      ...enterpriseConfig,
    };

    // Remove customBranding from the top level since it's been merged into branding
    if ('customBranding' in merged) {
      delete (merged as { customBranding?: unknown }).customBranding;
    }

    return merged;
  }

  getDefaultConfig(): ExtensionConfig {
    return {
      // Extension settings
      extensionEnabled: true,
      
      // Security settings
      enableContentManipulation: true,
      enableUrlMonitoring: true,

      // UI settings
      showNotifications: true,
      enableValidPageBadge: true,
      enablePageBlocking: true,

      // Debug settings
      enableDebugLogging: false,

      // Custom rules
      customRulesUrl: '',
      updateInterval: 24, // hours

      // CIPP integration
      enableCippReporting: false,
      cippServerUrl: '',
      cippTenantId: '',
    };
  }

  getDefaultBrandingConfig(): BrandingConfig {
    return {
      // Company branding
      companyName: 'Check',
      productName: 'Check',
      version: '1.0.0',

      // Visual branding
      primaryColor: '#2563eb',
      logoUrl: 'images/logo.png',
    };
  }

  async setDefaultConfig(): Promise<void> {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async <T>(promise: Promise<T>): Promise<T | undefined> => {
        try {
          return await promise;
        } catch {
          return undefined;
        }
      };

      const defaultConfig = this.getDefaultConfig();
      await safe(chrome.storage.local.set({ config: defaultConfig }));
      this.config = defaultConfig;
    } catch (error) {
      logger.error('Check: Failed to set default config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  async updateConfig(updates: Partial<ExtensionConfig>): Promise<ExtensionConfig> {
    try {
      // Safe wrapper for chrome.* operations
      const safe = async <T>(promise: Promise<T>): Promise<T | undefined> => {
        try {
          return await promise;
        } catch {
          return undefined;
        }
      };

      const currentConfig = await this.getConfig();
      const updatedConfig = { ...currentConfig, ...updates };

      await safe(chrome.storage.local.set({ config: updatedConfig }));
      this.config = updatedConfig;

      // Notify other components of configuration change with safe wrapper
      try {
        chrome.runtime.sendMessage(
          {
            type: 'CONFIG_UPDATED',
            config: updatedConfig,
          },
          () => {
            if (chrome.runtime.lastError) {
              // Silently handle errors
            }
          }
        );
      } catch {
        // Silently handle errors
      }

      return updatedConfig;
    } catch (error) {
      logger.error('Check: Failed to update configuration:', error);
      throw error;
    }
  }

  async getConfig(): Promise<ExtensionConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config!;
  }

  async getBrandingConfig(): Promise<BrandingConfig> {
    if (!this.brandingConfig) {
      this.brandingConfig = await this.loadBrandingConfig();
    }
    return this.brandingConfig;
  }

  getEnterpriseConfig(): EnterpriseConfig | null {
    return this.enterpriseConfig;
  }

  isEnterpriseManaged(): boolean {
    return this.enterpriseConfig !== null && Object.keys(this.enterpriseConfig).length > 0;
  }
}