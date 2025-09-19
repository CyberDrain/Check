import { Config, BrandingConfig, OptionsElements, SecurityEvent } from './types/common';

class CheckOptions {
  private config: Config | null = null;
  private brandingConfig: BrandingConfig | null = null;
  private originalConfig: Config | null = null;
  private hasUnsavedChanges: boolean = false;
  private currentSection: string = "general";
  private configViewMode: string = "formatted";
  private currentConfigData: any = null;
  private isEnterpriseManaged: boolean = false;
  private simulateEnterpriseMode: boolean = false;
  private managedPolicies: any = null;
  private elements: Partial<OptionsElements> = {};

  constructor() {
    this.bindElements();
    this.setupEventListeners();
    this.initialize();
  }

  private bindElements(): void {
    this.elements.menuItems = document.querySelectorAll(".menu-item");
    this.elements.sections = document.querySelectorAll(".settings-section");
    this.elements.pageTitle = document.getElementById("pageTitle") as HTMLElement;
    this.elements.policyBadge = document.getElementById("policyBadge") as HTMLElement;
    this.elements.sidebar = document.querySelector(".sidebar") as HTMLElement;
    this.elements.mobileMenuToggle = document.getElementById("mobileMenuToggle") as HTMLElement;
    this.elements.mobileTitleText = document.getElementById("mobileTitleText") as HTMLElement;
    this.elements.mobileSubtitleText = document.getElementById("mobileSubtitleText") as HTMLElement;
    this.elements.saveSettings = document.getElementById("saveSettings") as HTMLButtonElement;
    this.elements.darkModeToggle = document.getElementById("darkModeToggle") as HTMLButtonElement;
    this.elements.extensionEnabled = document.getElementById("extensionEnabled") as HTMLInputElement;
    this.elements.enableContentManipulation = document.getElementById("enableContentManipulation") as HTMLInputElement;
    this.elements.enableUrlMonitoring = document.getElementById("enableUrlMonitoring") as HTMLInputElement;
    this.elements.showNotifications = document.getElementById("showNotifications") as HTMLInputElement;
    this.elements.enableValidPageBadge = document.getElementById("enableValidPageBadge") as HTMLInputElement;
    this.elements.customRulesUrl = document.getElementById("customRulesUrl") as HTMLInputElement;
    this.elements.updateInterval = document.getElementById("updateInterval") as HTMLInputElement;
    this.elements.refreshDetectionRules = document.getElementById("refreshDetectionRules") as HTMLButtonElement;
    this.elements.configDisplay = document.getElementById("configDisplay") as HTMLElement;
    this.elements.toggleConfigView = document.getElementById("toggleConfigView") as HTMLButtonElement;
    this.elements.enableDebugLogging = document.getElementById("enableDebugLogging") as HTMLInputElement;
    this.elements.enableDeveloperConsoleLogging = document.getElementById("enableDeveloperConsoleLogging") as HTMLInputElement;
    this.elements.simulateEnterpriseMode = document.getElementById("simulateEnterpriseMode") as HTMLInputElement;
    this.elements.logFilter = document.getElementById("logFilter") as HTMLSelectElement;
    this.elements.refreshLogs = document.getElementById("refreshLogs") as HTMLButtonElement;
    this.elements.clearLogs = document.getElementById("clearLogs") as HTMLButtonElement;
    this.elements.exportLogs = document.getElementById("exportLogs") as HTMLButtonElement;
    this.elements.logsList = document.getElementById("logsList") as HTMLElement;
    this.elements.companyName = document.getElementById("companyName") as HTMLInputElement;
    this.elements.productName = document.getElementById("productName") as HTMLInputElement;
    this.elements.supportEmail = document.getElementById("supportEmail") as HTMLInputElement;
    this.elements.primaryColor = document.getElementById("primaryColor") as HTMLInputElement;
    this.elements.logoUrl = document.getElementById("logoUrl") as HTMLInputElement;
    this.elements.brandingPreview = document.getElementById("brandingPreview") as HTMLElement;
    this.elements.previewLogo = document.getElementById("previewLogo") as HTMLImageElement;
    this.elements.previewTitle = document.getElementById("previewTitle") as HTMLElement;
    this.elements.previewButton = document.getElementById("previewButton") as HTMLButtonElement;
    this.elements.extensionVersion = document.getElementById("extensionVersion") as HTMLElement;
    this.elements.rulesVersion = document.getElementById("rulesVersion") as HTMLElement;
    this.elements.lastUpdated = document.getElementById("lastUpdated") as HTMLElement;
    this.elements.modalOverlay = document.getElementById("modalOverlay") as HTMLElement;
    this.elements.modalTitle = document.getElementById("modalTitle") as HTMLElement;
    this.elements.modalMessage = document.getElementById("modalMessage") as HTMLElement;
    this.elements.modalCancel = document.getElementById("modalCancel") as HTMLButtonElement;
    this.elements.modalConfirm = document.getElementById("modalConfirm") as HTMLButtonElement;
    this.elements.toastContainer = document.getElementById("toastContainer") as HTMLElement;
  }

  private setupEventListeners(): void {
    this.elements.menuItems?.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const section = item.dataset.section || "general";
        this.switchSection(section);
        if (this.elements.sidebar?.classList.contains("mobile-open")) {
          this.toggleMobileMenu();
        }
      });
    });

    this.elements.saveSettings?.addEventListener("click", () => this.saveSettings());
    this.elements.darkModeToggle?.addEventListener("click", () => this.toggleDarkMode());
    this.elements.mobileMenuToggle?.addEventListener("click", () => this.toggleMobileMenu());
    this.elements.logFilter?.addEventListener("change", () => this.loadLogs());
    this.elements.refreshLogs?.addEventListener("click", () => this.refreshLogs());
    this.elements.clearLogs?.addEventListener("click", () => this.clearLogs());
    this.elements.exportLogs?.addEventListener("click", () => this.exportLogs());
    this.elements.toggleConfigView?.addEventListener("click", () => this.toggleConfigView());
    this.elements.simulateEnterpriseMode?.addEventListener("change", () => this.toggleSimulateEnterpriseMode());
    this.elements.refreshDetectionRules?.addEventListener("click", () => this.refreshDetectionRules());

    const brandingInputs = [
      this.elements.companyName,
      this.elements.productName,
      this.elements.primaryColor,
      this.elements.logoUrl,
    ];

    brandingInputs.forEach((input) => {
      if (input) {
        input.addEventListener("input", () => this.updateBrandingPreview());
      }
    });

    this.elements.modalCancel?.addEventListener("click", () => this.hideModal());
    this.elements.modalOverlay?.addEventListener("click", (e) => {
      if (e.target === this.elements.modalOverlay) {
        this.hideModal();
      }
    });

    this.setupChangeTracking();

    document.addEventListener("click", (e) => {
      if (
        this.elements.sidebar?.classList.contains("mobile-open") &&
        !this.elements.sidebar.contains(e.target as Node) &&
        !this.elements.mobileMenuToggle?.contains(e.target as Node)
      ) {
        this.toggleMobileMenu();
      }
    });

    window.addEventListener("hashchange", () => this.handleHashChange());

    window.addEventListener("beforeunload", (e) => {
      if (this.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    });
  }

  private setupChangeTracking(): void {
    const inputs = document.querySelectorAll("input, select, textarea");
    inputs.forEach((input) => {
      const element = input as HTMLInputElement;
      if (element.type === "button" || element.type === "submit") return;

      element.addEventListener("change", () => {
        this.markUnsavedChanges();
      });
    });
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadConfiguration();
      await this.loadBrandingConfiguration();
      await this.loadSimulateEnterpriseMode();
      await this.loadPolicyInfo();
      await this.initializeDarkMode();
      this.applyBranding();
      this.populateFormFields();
      await this.loadLogs();
      this.handleHashChange();
      this.updateBrandingPreview();
      this.showToast("Settings loaded successfully", "success");
    } catch (error) {
      console.error("Failed to initialize options page:", error);
      this.showToast("Failed to load some settings - using defaults where possible", "warning");
    }
  }

  private async ensureServiceWorkerAlive(maxAttempts = 3, initialDelay = 100): Promise<boolean> {
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

        if (response && (response as any).success) {
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

  private async sendMessageWithRetry(message: any, maxAttempts = 3, initialDelay = 5000): Promise<any> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await new Promise((resolve, reject) => {
          try {
            chrome.runtime.sendMessage(message, (response) => {
              if (chrome.runtime.lastError) {
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
        if (attempt === maxAttempts) {
          return null;
        }

        await new Promise((resolve) => setTimeout(resolve, initialDelay));
      }
    }
    return null;
  }

  private async loadConfiguration(): Promise<void> {
    const response = await this.sendMessageWithRetry({ type: "GET_CONFIG" });

    if (response && response.success) {
      this.config = response.config;
      this.originalConfig = JSON.parse(JSON.stringify(response.config));
    } else {
      this.config = {
        extensionEnabled: true,
        enableContentManipulation: true,
        enableUrlMonitoring: true,
        showNotifications: true,
        enableValidPageBadge: false,
        customRulesUrl: "https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/rules/detection-rules.json",
        updateInterval: 24,
        enableDebugLogging: false,
        enableDeveloperConsoleLogging: false,
      };
      this.originalConfig = JSON.parse(JSON.stringify(this.config));

      setTimeout(() => {
        this.loadConfiguration();
      }, 5000);
    }
  }

  private async waitForRuntimeReady(maxAttempts = 5, initialDelay = 100): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (chrome.runtime && chrome.runtime.id) {
          const testUrl = chrome.runtime.getURL("config/branding.json");
          if (
            testUrl &&
            testUrl.startsWith("chrome-extension://") &&
            !testUrl.includes("undefined")
          ) {
            return true;
          }
        }
      } catch (error) {
        console.warn(`Runtime readiness check attempt ${attempt} failed:`, error);
      }

      if (attempt < maxAttempts) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error("Chrome runtime not ready after maximum attempts");
  }

  private async loadBrandingConfiguration(): Promise<void> {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_BRANDING_CONFIG" }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Failed to get branding from background:", chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });

      if (response && (response as any).success && (response as any).branding) {
        this.brandingConfig = (response as any).branding;
        console.log("Options: Loaded branding from background script:", this.brandingConfig);
        return;
      }

      console.warn("Options: Using fallback branding configuration");
      this.brandingConfig = {
        companyName: "CyberDrain",
        productName: "Check",
        primaryColor: "#F77F00",
        logoUrl: "images/icon48.png",
      };
    } catch (error) {
      console.error("Error loading branding configuration:", error);
      this.brandingConfig = {
        companyName: "CyberDrain",
        productName: "Check",
        primaryColor: "#F77F00",
        logoUrl: "images/icon48.png",
      };
    }
  }

  private async loadSimulateEnterpriseMode(): Promise<void> {
    try {
      const manifestData = chrome.runtime.getManifest();
      const isDev = !("update_url" in manifestData);

      if (!isDev) {
        this.simulateEnterpriseMode = false;
        if (this.elements.simulateEnterpriseMode) {
          const labelElement = this.elements.simulateEnterpriseMode.closest(".setting-label") as HTMLElement;
          if (labelElement) {
            labelElement.style.display = "none";
            console.log("Simulate Enterprise Mode toggle hidden (production build)");
          }
        }
        return;
      }

      if (this.elements.simulateEnterpriseMode) {
        const labelElement = this.elements.simulateEnterpriseMode.closest(".setting-label") as HTMLElement;
        if (labelElement) {
          labelElement.style.display = "";
        }
      }

      const result = await chrome.storage.local.get(["simulateEnterpriseMode"]);
      this.simulateEnterpriseMode = result.simulateEnterpriseMode || false;

      console.log("Simulate Enterprise Mode loaded:", this.simulateEnterpriseMode);
    } catch (error) {
      console.error("Error loading simulate enterprise mode:", error);
      this.simulateEnterpriseMode = false;

      if (this.elements.simulateEnterpriseMode) {
        const labelElement = this.elements.simulateEnterpriseMode.closest(".setting-label") as HTMLElement;
        if (labelElement) {
          labelElement.style.display = "none";
        }
      }
    }
  }

  private async loadPolicyInfo(): Promise<void> {
    try {
      this.isEnterpriseManaged = false;
      this.managedPolicies = null;

      if (this.simulateEnterpriseMode) {
        this.isEnterpriseManaged = true;
        this.managedPolicies = {
          customRulesUrl: "https://enterprise.example.com/rules.json",
          updateInterval: 12,
          enableDebugLogging: false,
        };
        console.log("Simulating enterprise management with policies:", this.managedPolicies);
      }

      this.updatePolicyBadge();
      this.applyPolicyRestrictions();
    } catch (error) {
      console.error("Error loading policy info:", error);
    }
  }

  private updatePolicyBadge(): void {
    if (this.elements.policyBadge) {
      if (this.isEnterpriseManaged) {
        this.elements.policyBadge.style.display = "block";
        this.elements.policyBadge.textContent = this.simulateEnterpriseMode 
          ? "Simulated Enterprise Management" 
          : "Enterprise Managed";
      } else {
        this.elements.policyBadge.style.display = "none";
      }
    }
  }

  private applyPolicyRestrictions(): void {
    if (!this.isEnterpriseManaged || !this.managedPolicies) return;

    const managedFields = Object.keys(this.managedPolicies);
    managedFields.forEach((field) => {
      const element = document.getElementById(field) as HTMLInputElement;
      if (element) {
        element.disabled = true;
        element.title = "This setting is managed by your organization";
        const label = element.closest(".setting-label");
        if (label) {
          label.classList.add("managed");
        }
      }
    });
  }

  private applyBranding(): void {
    const sidebarTitle = document.getElementById("sidebarTitle");
    if (sidebarTitle) {
      sidebarTitle.textContent = this.brandingConfig?.productName || "Check";
    }

    const mobileLogoText = document.getElementById("mobileLogoText");
    if (mobileLogoText) {
      mobileLogoText.textContent = this.brandingConfig?.productName || "Check";
    }

    const setLogoSrc = (logoElement: HTMLImageElement | null, fallbackSrc: string) => {
      if (!logoElement || !this.brandingConfig?.logoUrl) {
        if (logoElement) {
          logoElement.src = fallbackSrc;
        }
        return;
      }

      console.log("Setting logo:", this.brandingConfig.logoUrl);

      const logoSrc = this.brandingConfig.logoUrl.startsWith("http")
        ? this.brandingConfig.logoUrl
        : chrome.runtime.getURL(this.brandingConfig.logoUrl);

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

    const sidebarLogo = document.getElementById("sidebarLogo") as HTMLImageElement;
    setLogoSrc(sidebarLogo, chrome.runtime.getURL("images/icon48.png"));

    const mobileLogo = document.getElementById("mobileLogo") as HTMLImageElement;
    setLogoSrc(mobileLogo, chrome.runtime.getURL("images/icon48.png"));

    if (this.brandingConfig?.primaryColor) {
      this.applyPrimaryColorToOptionsPage(this.brandingConfig.primaryColor);
    }
  }

  private applyPrimaryColorToOptionsPage(color: string): void {
    const style = document.createElement("style");
    style.id = "branding-primary-color";
    style.textContent = `
      :root {
        --primary-color: ${color} !important;
        --primary-hover: ${color}dd !important;
      }
    `;
    document.head.appendChild(style);
  }

  private populateFormFields(): void {
    const enablePageBlocking = document.getElementById("enablePageBlocking") as HTMLInputElement;
    const enableCippReporting = document.getElementById("enableCippReporting") as HTMLInputElement;
    const cippServerUrl = document.getElementById("cippServerUrl") as HTMLInputElement;
    const cippTenantId = document.getElementById("cippTenantId") as HTMLInputElement;

    if (enablePageBlocking) {
      enablePageBlocking.checked = (this.config as any)?.enablePageBlocking !== false;
    }
    if (enableCippReporting) {
      enableCippReporting.checked = (this.config as any)?.enableCippReporting || false;
    }
    if (cippServerUrl) {
      cippServerUrl.value = (this.config as any)?.cippServerUrl || "";
    }
    if (cippTenantId) {
      cippTenantId.value = (this.config as any)?.cippTenantId || "";
    }

    if (this.elements.showNotifications) {
      this.elements.showNotifications.checked = this.config?.showNotifications || false;
    }
    if (this.elements.enableValidPageBadge) {
      this.elements.enableValidPageBadge.checked = this.config?.enableValidPageBadge || false;
    }

    if (this.elements.customRulesUrl) {
      this.elements.customRulesUrl.value = (this.config as any)?.detectionRules?.customRulesUrl || this.config?.customRulesUrl || "";
    }

    let updateIntervalHours = 24;
    if (this.config?.updateInterval) {
      updateIntervalHours = this.config.updateInterval;
    } else if ((this.config as any)?.detectionRules?.updateInterval) {
      const interval = (this.config as any).detectionRules.updateInterval;
      updateIntervalHours = interval > 1000 ? Math.round(interval / 3600000) : interval;
    }

    if (this.elements.updateInterval) {
      this.elements.updateInterval.value = updateIntervalHours.toString();
      setTimeout(() => {
        if (this.elements.updateInterval && this.elements.updateInterval.value !== updateIntervalHours.toString()) {
          this.elements.updateInterval.value = updateIntervalHours.toString();
        }
      }, 100);
    }

    if (this.elements.enableDebugLogging) {
      this.elements.enableDebugLogging.checked = this.config?.enableDebugLogging || false;
    }
    if (this.elements.enableDeveloperConsoleLogging) {
      this.elements.enableDeveloperConsoleLogging.checked = this.config?.enableDeveloperConsoleLogging || false;
    }

    if (this.elements.simulateEnterpriseMode) {
      this.elements.simulateEnterpriseMode.checked = this.simulateEnterpriseMode;
    }

    if (this.elements.companyName) {
      this.elements.companyName.value = this.brandingConfig?.companyName || "";
    }
    if (this.elements.productName) {
      this.elements.productName.value = this.brandingConfig?.productName || "";
    }
    if (this.elements.supportEmail) {
      this.elements.supportEmail.value = this.brandingConfig?.supportEmail || "";
    }
    if (this.elements.primaryColor) {
      this.elements.primaryColor.value = this.brandingConfig?.primaryColor || "#F77F00";
    }
    if (this.elements.logoUrl) {
      this.elements.logoUrl.value = this.brandingConfig?.logoUrl || "";
    }
  }

  private switchSection(sectionName: string): void {
    this.elements.menuItems?.forEach((item) => {
      item.classList.toggle("active", item.dataset.section === sectionName);
    });

    this.elements.sections?.forEach((section) => {
      section.classList.toggle("active", section.id === `${sectionName}-section`);
    });

    const sectionInfo: { [key: string]: { title: string; subtitle: string } } = {
      general: {
        title: "General Settings",
        subtitle: "Configure basic phishing protection behavior and detection features",
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
        subtitle: "Enterprise-grade protection against Microsoft 365 phishing attacks",
      },
    };

    const info = sectionInfo[sectionName] || { title: "Settings", subtitle: "" };
    if (this.elements.pageTitle) {
      this.elements.pageTitle.textContent = info.title;
    }

    const pageSubtitle = document.getElementById("pageSubtitle");
    if (pageSubtitle) {
      pageSubtitle.textContent = info.subtitle;
    }

    if (this.elements.mobileTitleText) {
      this.elements.mobileTitleText.textContent = info.title;
    }
    if (this.elements.mobileSubtitleText) {
      this.elements.mobileSubtitleText.textContent = info.subtitle;
    }

    this.currentSection = sectionName;
    window.location.hash = sectionName;

    if (sectionName === "logs") {
      this.loadLogs();
    } else if (sectionName === "detection") {
      this.loadConfigDisplay();
    } else if (sectionName === "about") {
      this.loadAboutSection();
    }
  }

  private handleHashChange(): void {
    const hash = window.location.hash.slice(1);
    if (hash && document.getElementById(`${hash}-section`)) {
      this.switchSection(hash);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      const newConfig = this.gatherFormData();
      const newBranding = this.gatherBrandingData();

      const validation = this.validateConfiguration(newConfig);
      if (!validation.valid) {
        this.showToast(validation.message || "Invalid configuration", "error");
        return;
      }

      const response = await this.sendMessageWithRetry({
        type: "UPDATE_CONFIG",
        config: newConfig,
      });

      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ brandingConfig: newBranding }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(undefined);
            }
          });
        });

        this.brandingConfig = newBranding;
        console.log("Branding config saved:", newBranding);

        try {
          const brandingResponse = await this.sendMessageWithRetry({
            type: "UPDATE_BRANDING",
          });

          if (brandingResponse && brandingResponse.success) {
            console.log("Background script updated with new branding");
          } else {
            console.warn("Failed to notify background script of branding update");
          }
        } catch (brandingNotifyError) {
          console.error("Failed to notify background script:", brandingNotifyError);
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

  private gatherFormData(): Config {
    const enablePageBlocking = document.getElementById("enablePageBlocking") as HTMLInputElement;
    const enableCippReporting = document.getElementById("enableCippReporting") as HTMLInputElement;
    const cippServerUrl = document.getElementById("cippServerUrl") as HTMLInputElement;
    const cippTenantId = document.getElementById("cippTenantId") as HTMLInputElement;

    const formData: any = {
      enablePageBlocking: enablePageBlocking?.checked !== false,
      enableCippReporting: enableCippReporting?.checked || false,
      cippServerUrl: cippServerUrl?.value || "",
      cippTenantId: cippTenantId?.value || "",
      showNotifications: this.elements.showNotifications?.checked || false,
      enableValidPageBadge: this.elements.enableValidPageBadge?.checked || false,
      customRulesUrl: this.elements.customRulesUrl?.value || "",
      updateInterval: parseInt(this.elements.updateInterval?.value || "24"),
      enableDebugLogging: this.elements.enableDebugLogging?.checked || false,
      enableDeveloperConsoleLogging: this.elements.enableDeveloperConsoleLogging?.checked || false,
    };

    if (this.managedPolicies && Object.keys(this.managedPolicies).length > 0) {
      const filteredData: any = {};
      const managedSettingsList = Object.keys(this.managedPolicies);

      if (this.managedPolicies.customBranding) {
        managedSettingsList.push(...Object.keys(this.managedPolicies.customBranding));
      }

      Object.keys(formData).forEach((key) => {
        if (!managedSettingsList.includes(key)) {
          filteredData[key] = formData[key];
        } else {
          console.log(`⚠️ Skipping managed setting: ${key}`);
        }
      });

      console.log("💾 Saving only non-managed settings:", Object.keys(filteredData));
      return filteredData;
    }

    return formData;
  }

  private validateConfiguration(config: any): { valid: boolean; message?: string } {
    if (config.updateInterval < 1 || config.updateInterval > 168) {
      return {
        valid: false,
        message: "Update interval must be between 1-168 hours",
      };
    }

    if (config.customRulesUrl && !this.isValidUrl(config.customRulesUrl)) {
      return { valid: false, message: "Custom rules URL is not valid" };
    }

    return { valid: true };
  }

  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  private gatherBrandingData(): BrandingConfig {
    return {
      companyName: this.elements.companyName?.value || "",
      productName: this.elements.productName?.value || "",
      supportEmail: this.elements.supportEmail?.value || "",
      primaryColor: this.elements.primaryColor?.value || "",
      logoUrl: this.elements.logoUrl?.value || "",
    };
  }

  private async loadConfigDisplay(): Promise<void> {
    try {
      if (!this.elements.configDisplay) return;

      this.elements.configDisplay.innerHTML = '<div class="config-loading">Loading configuration...</div>';

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

  private toggleConfigView(): void {
    if (!this.currentConfigData) return;

    this.configViewMode = this.configViewMode === "formatted" ? "raw" : "formatted";

    if (this.elements.toggleConfigView) {
      if (this.configViewMode === "raw") {
        this.elements.toggleConfigView.innerHTML =
          '<span class="material-icons">view_list</span> Show Formatted';
      } else {
        this.elements.toggleConfigView.innerHTML =
          '<span class="material-icons">code</span> Show Raw JSON';
      }
    }

    this.updateConfigDisplay();
  }

  private updateConfigDisplay(): void {
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

  private displayConfigInCard(config: any): void {
    if (!this.elements.configDisplay) return;

    const sections: string[] = [];

    sections.push(`
      <div class="config-section">
        <div class="config-section-title">Basic Information</div>
        <div class="config-item"><strong>Version:</strong> <span class="config-value">${config.version || "Unknown"}</span></div>
        <div class="config-item"><strong>Last Updated:</strong> <span class="config-value">${config.lastUpdated || "Unknown"}</span></div>
        <div class="config-item"><strong>Description:</strong> ${config.description || "No description"}</div>
      </div>
    `);

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

    this.elements.configDisplay.innerHTML = sections.join("");
  }

  private toggleMobileMenu(): void {
    if (this.elements.sidebar) {
      const isOpen = this.elements.sidebar.classList.contains("mobile-open");
      this.elements.sidebar.classList.toggle("mobile-open", !isOpen);

      if (this.elements.mobileMenuToggle) {
        this.elements.mobileMenuToggle.setAttribute("aria-expanded", (!isOpen).toString());
      }
    }
  }

  private async toggleSimulateEnterpriseMode(): Promise<void> {
    this.simulateEnterpriseMode = this.elements.simulateEnterpriseMode?.checked || false;

    await chrome.storage.local.set({
      simulateEnterpriseMode: this.simulateEnterpriseMode,
    });

    console.log("Simulate Enterprise Mode:", this.simulateEnterpriseMode);

    await this.loadPolicyInfo();
    this.populateFormFields();

    const mode = this.simulateEnterpriseMode ? "enabled" : "disabled";
    this.showToast(
      `Enterprise simulation mode ${mode}. Page will reflect policy restrictions.`,
      "info"
    );
  }

  private async loadLogs(): Promise<void> {
    try {
      const safe = async (promise: Promise<any>) => {
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

      const allLogs = [
        ...securityEvents.map((event: SecurityEvent) => {
          let category = "security";

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
        ...accessLogs.map((event: any) => ({ ...event, category: "access" })),
        ...debugLogs.map((log: any) => ({ ...log, category: "debug" })),
      ].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      this.displayLogs(allLogs);
    } catch (error) {
      console.error("Failed to load logs:", error);
      this.showToast("Failed to load logs", "error");
    }
  }

  private displayLogs(logs: any[]): void {
    if (!this.elements.logsList) return;
    
    this.elements.logsList.innerHTML = "";

    if (logs.length === 0) {
      const item = document.createElement("div");
      item.className = "log-entry";
      item.innerHTML =
        '<div class="log-column" style="grid-column: 1 / -1; text-align: center; color: #9ca3af;">No logs available</div>';
      this.elements.logsList.appendChild(item);
      return;
    }

    const filteredLogs = this.filterLogsForDisplay(logs);

    filteredLogs.slice(0, 100).forEach((log: any, index: number) => {
      const item = document.createElement("div");
      item.className = "log-entry";
      item.dataset.logIndex = index.toString();

      const mainRow = document.createElement("div");
      mainRow.className = "log-entry-main";

      const timestamp = document.createElement("div");
      timestamp.className = "log-column timestamp";
      timestamp.textContent = new Date(log.timestamp).toLocaleString();

      const eventType = document.createElement("div");
      eventType.className = `log-column event-type ${log.category}`;
      const eventTypeText = this.getEventTypeDisplay(log);
      eventType.textContent = eventTypeText;

      this.applyEventTypeColor(eventType, log);

      const url = document.createElement("div");
      url.className = "log-column url";
      url.textContent = this.getUrlDisplay(log);

      const threatLevel = document.createElement("div");
      threatLevel.className = "log-column threat-level";
      const threatLevelText = this.getThreatLevelDisplay(log);
      threatLevel.textContent = threatLevelText;

      this.applyThreatLevelColor(threatLevel, threatLevelText, log);

      const action = document.createElement("div");
      action.className = "log-column action";
      action.textContent = this.getActionDisplay(log);

      const details = document.createElement("div");
      details.className = "log-column details";
      details.textContent = this.formatLogMessage(log);

      const expandIcon = document.createElement("div");
      expandIcon.className = "log-expand-icon";
      expandIcon.innerHTML = "▶";

      mainRow.appendChild(timestamp);
      mainRow.appendChild(eventType);
      mainRow.appendChild(url);
      mainRow.appendChild(threatLevel);
      mainRow.appendChild(action);
      mainRow.appendChild(details);
      mainRow.appendChild(expandIcon);

      const detailsSection = document.createElement("div");
      detailsSection.className = "log-entry-details";
      detailsSection.innerHTML = this.createLogDetailsHTML(log);

      item.appendChild(mainRow);
      item.appendChild(detailsSection);

      mainRow.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleLogEntry(item);
      });

      this.elements.logsList!.appendChild(item);
    });
  }

  private filterLogsForDisplay(logs: any[]): any[] {
    return logs;
  }

  private getEventTypeDisplay(log: any): string {
    return log.event?.type || log.level || "Unknown";
  }

  private applyEventTypeColor(element: HTMLElement, log: any): void {
    if (log.category === "security") {
      element.style.color = "var(--error-color, #dc2626)";
    } else if (log.category === "legitimate") {
      element.style.color = "var(--success-color, #16a34a)";
    }
  }

  private getUrlDisplay(log: any): string {
    return log.event?.url || log.url || "-";
  }

  private getThreatLevelDisplay(log: any): string {
    return log.event?.threatLevel || log.threatLevel || "-";
  }

  private applyThreatLevelColor(element: HTMLElement, threatLevel: string, log: any): void {
    if (threatLevel === "high" || threatLevel === "critical") {
      element.style.color = "var(--error-color, #dc2626)";
    } else if (threatLevel === "medium") {
      element.style.color = "var(--warning-color, #f59e0b)";
    }
  }

  private getActionDisplay(log: any): string {
    return log.event?.action || log.action || "None";
  }

  private formatLogMessage(log: any): string {
    return log.message || log.event?.description || "No description";
  }

  private toggleLogEntry(item: HTMLElement): void {
    const isExpanded = item.classList.contains("expanded");

    document.querySelectorAll(".log-entry.expanded").forEach((entry) => {
      if (entry !== item) {
        entry.classList.remove("expanded");
      }
    });

    item.classList.toggle("expanded", !isExpanded);
  }

  private createLogDetailsHTML(log: any): string {
    let html = "";
    const isMobile = this.isMobileDevice();

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

    html += `</div></div>`;
    return html;
  }

  private isMobileDevice(): boolean {
    return window.innerWidth <= 768;
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private refreshLogs(): void {
    this.loadLogs();
    this.showToast("Logs refreshed", "success");
  }

  private async clearLogs(): Promise<void> {
    if (confirm("Are you sure you want to clear all logs? This cannot be undone.")) {
      try {
        await chrome.storage.local.remove(["securityEvents", "accessLogs", "debugLogs"]);
        this.showToast("All logs cleared", "success");
        this.loadLogs();
      } catch (error) {
        console.error("Failed to clear logs:", error);
        this.showToast("Failed to clear logs", "error");
      }
    }
  }

  private exportLogs(): void {
    this.showToast("Export functionality not implemented", "info");
  }

  private async refreshDetectionRules(): Promise<void> {
    try {
      this.showToast("Refreshing detection rules...", "info");
      const response = await this.sendMessageWithRetry({
        type: "REFRESH_DETECTION_RULES",
      });

      if (response && response.success) {
        this.showToast("Detection rules refreshed successfully", "success");
        await this.loadConfigDisplay();
      } else {
        this.showToast("Failed to refresh detection rules", "error");
      }
    } catch (error) {
      console.error("Failed to refresh detection rules:", error);
      this.showToast("Failed to refresh detection rules", "error");
    }
  }

  private updateBrandingPreview(): void {
    if (this.elements.previewTitle && this.elements.productName) {
      this.elements.previewTitle.textContent = this.elements.productName.value || "Check";
    }

    if (this.elements.previewButton && this.elements.primaryColor) {
      this.elements.previewButton.style.backgroundColor = this.elements.primaryColor.value || "#F77F00";
    }

    if (this.elements.previewLogo && this.elements.logoUrl) {
      const logoUrl = this.elements.logoUrl.value;
      if (logoUrl) {
        this.elements.previewLogo.src = logoUrl.startsWith("http") 
          ? logoUrl 
          : chrome.runtime.getURL(logoUrl);
      }
    }
  }

  private loadAboutSection(): void {
    if (this.elements.extensionVersion) {
      this.elements.extensionVersion.textContent = chrome.runtime.getManifest().version;
    }

    if (this.elements.rulesVersion) {
      this.elements.rulesVersion.textContent = "Loading...";
    }

    if (this.elements.lastUpdated) {
      this.elements.lastUpdated.textContent = new Date().toLocaleDateString();
    }
  }

  private async toggleDarkMode(): Promise<void> {
    const html = document.documentElement;
    const isDark = html.classList.contains("dark-theme");

    if (isDark) {
      html.classList.remove("dark-theme");
      html.classList.add("light-theme");
      await chrome.storage.local.set({ themeMode: "light" });
    } else {
      html.classList.add("dark-theme");
      html.classList.remove("light-theme");
      await chrome.storage.local.set({ themeMode: "dark" });
    }
  }

  private async initializeDarkMode(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(["themeMode"]);
      const stored = result.themeMode;

      let isDarkMode: boolean;

      if (stored === "dark") {
        isDarkMode = true;
      } else if (stored === "light") {
        isDarkMode = false;
      } else {
        isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      this.applyTheme(isDarkMode);
    } catch (error) {
      console.error("Failed to initialize dark mode:", error);
    }
  }

  private applyTheme(isDarkMode: boolean): void {
    const html = document.documentElement;

    if (isDarkMode) {
      html.classList.add("dark-theme");
      html.classList.remove("light-theme");
    } else {
      html.classList.remove("dark-theme");
      html.classList.add("light-theme");
    }
  }

  private markUnsavedChanges(): void {
    this.hasUnsavedChanges = true;
    this.updateSaveButton();
  }

  private updateSaveButton(): void {
    if (this.elements.saveSettings) {
      this.elements.saveSettings.disabled = !this.hasUnsavedChanges;
      this.elements.saveSettings.textContent = this.hasUnsavedChanges 
        ? "Save Changes" 
        : "No Changes";
    }
  }

  private showModal(title: string, message: string, onConfirm?: () => void): void {
    if (this.elements.modalTitle) this.elements.modalTitle.textContent = title;
    if (this.elements.modalMessage) this.elements.modalMessage.textContent = message;
    if (this.elements.modalOverlay) this.elements.modalOverlay.style.display = "flex";

    if (onConfirm && this.elements.modalConfirm) {
      this.elements.modalConfirm.onclick = () => {
        onConfirm();
        this.hideModal();
      };
    }
  }

  private hideModal(): void {
    if (this.elements.modalOverlay) this.elements.modalOverlay.style.display = "none";
  }

  private showToast(message: string, type: string): void {
    if (!this.elements.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 100);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new CheckOptions();
});