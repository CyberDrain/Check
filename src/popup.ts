import { Config, BrandingConfig, PopupElements, Statistics, AnalysisResult, ThreatInfo, SecurityEvent, MessageResponse, PageInfo } from './types/common';

class CheckPopup {
  private currentTab: chrome.tabs.Tab | null = null;
  private config: Config | null = null;
  private brandingConfig: BrandingConfig | null = null;
  private stats: Statistics = {
    blockedThreats: 0,
    scannedPages: 0,
    securityEvents: 0,
  };
  private activityItems: SecurityEvent[] = [];
  private isLoading: boolean = false;
  private isBlockedRoute: boolean = false;
  private elements: Partial<PopupElements> = {};

  constructor() {
    this.bindElements();
    this.setupEventListeners();
    this.initialize();
  }

  private bindElements(): void {
    this.elements.brandingLogo = document.getElementById("brandingLogo") as HTMLImageElement;
    this.elements.brandingTitle = document.getElementById("brandingTitle") as HTMLElement;
    this.elements.statusIndicator = document.getElementById("statusIndicator") as HTMLElement;
    this.elements.statusDot = document.getElementById("statusDot") as HTMLElement;
    this.elements.statusText = document.getElementById("statusText") as HTMLElement;
    this.elements.openSettings = document.getElementById("openSettings") as HTMLButtonElement;
    this.elements.pageInfoSection = document.getElementById("pageInfoSection") as HTMLElement;
    this.elements.currentUrl = document.getElementById("currentUrl") as HTMLElement;
    this.elements.securityStatus = document.getElementById("securityStatus") as HTMLElement;
    this.elements.securityBadge = document.getElementById("securityBadge") as HTMLElement;
    this.elements.threatSummary = document.getElementById("threatSummary") as HTMLElement;
    this.elements.threatList = document.getElementById("threatList") as HTMLElement;
    this.elements.blockedNotice = document.getElementById("blockedNotice") as HTMLElement;
    this.elements.blockedUrl = document.getElementById("blockedUrl") as HTMLElement;
    this.elements.blockedThreats = document.getElementById("blockedThreats") as HTMLElement;
    this.elements.scannedPages = document.getElementById("scannedPages") as HTMLElement;
    this.elements.securityEvents = document.getElementById("securityEvents") as HTMLElement;
    this.elements.enterpriseSection = document.getElementById("enterpriseSection") as HTMLElement;
    this.elements.managedBy = document.getElementById("managedBy") as HTMLElement;
    this.elements.complianceBadge = document.getElementById("complianceBadge") as HTMLElement;
    this.elements.activityList = document.getElementById("activityList") as HTMLElement;
    this.elements.supportLink = document.getElementById("supportLink") as HTMLAnchorElement;
    this.elements.privacyLink = document.getElementById("privacyLink") as HTMLAnchorElement;
    this.elements.aboutLink = document.getElementById("aboutLink") as HTMLAnchorElement;
    this.elements.companyBranding = document.getElementById("companyBranding") as HTMLElement;
    this.elements.companyName = document.getElementById("companyName") as HTMLElement;
    this.elements.loadingOverlay = document.getElementById("loadingOverlay") as HTMLElement;
    this.elements.notificationToast = document.getElementById("notificationToast") as HTMLElement;
    this.elements.notificationText = document.getElementById("notificationText") as HTMLElement;
    this.elements.notificationClose = document.getElementById("notificationClose") as HTMLElement;
  }

  private setupEventListeners(): void {
    this.elements.openSettings?.addEventListener("click", () => this.openSettings());
    this.elements.supportLink?.addEventListener("click", (e) => this.handleFooterLink(e, "support"));
    this.elements.privacyLink?.addEventListener("click", (e) => this.handleFooterLink(e, "privacy"));
    this.elements.aboutLink?.addEventListener("click", (e) => this.handleFooterLink(e, "about"));
    this.elements.notificationClose?.addEventListener("click", () => this.hideNotification());
  }

  private async initialize(): Promise<void> {
    try {
      this.showLoading("Initializing...");
      console.log("Check: Initializing popup...");
      const backgroundReady = await this.waitForBackgroundScript();
      console.log("Check: Background script ready:", backgroundReady);
      if (!backgroundReady) {
        console.warn("Check: Background script not available, using fallback mode");
        console.log("Check: Using fallback configuration");
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
        console.log("Still loading");
        this.brandingConfig = { companyName: "Check", productName: "Check" };
        this.applyBranding();
        console.log("Applying default branding");
        await this.initializeTheme();
        this.showNotification("Extension running in limited mode", "warning");
        this.hideLoading();
        return;
      }

      this.currentTab = await this.getCurrentTab();
      this.isBlockedRoute = this.currentTab?.url?.includes("blocked.html") || false;

      if (this.isBlockedRoute) {
        this.handleBlockedRoute();
      }

      await this.loadConfiguration();
      await this.loadBrandingConfiguration();
      this.applyBranding();
      await this.initializeTheme();
      await this.loadStatistics();
      await this.loadCurrentPageInfo();
      await this.checkEnterpriseMode();
      this.hideLoading();
    } catch (error) {
      console.error("Check: Failed to initialize popup:", error);
      this.showNotification("Failed to initialize extension", "error");
      this.hideLoading();
    }
  }

  private async getCurrentTab(): Promise<chrome.tabs.Tab | null> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0] || null;
    } catch (error) {
      console.error("Check: Failed to get current tab:", error);
      return null;
    }
  }

  private async loadConfiguration(): Promise<void> {
    return new Promise((resolve) => {
      const attemptConnection = (retryCount = 0) => {
        try {
          chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (response: MessageResponse) => {
            if (chrome.runtime.lastError) {
              console.warn("Check: Background script connection failed:", chrome.runtime.lastError.message);
              if (retryCount < 3) {
                console.log(`Retrying configuration load in 5 seconds... (attempt ${retryCount + 1}/3)`);
                setTimeout(() => attemptConnection(retryCount + 1), 5000);
                return;
              } else {
                console.warn("Check: Using default configuration after all retries failed");
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
                resolve();
                return;
              }
            }

            if (response && response.success) {
              this.config = response.config!;
            } else {
              this.config = this.getDefaultConfig();
            }
            resolve();
          });
        } catch (error) {
          console.error("Check: Error sending message:", error);
          if (retryCount < 3) {
            console.log(`Retrying configuration load in 5 seconds... (attempt ${retryCount + 1}/3)`);
            setTimeout(() => attemptConnection(retryCount + 1), 5000);
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
            resolve();
          }
        }
      };
      attemptConnection();
    });
  }

  private getDefaultConfig(): Config {
    return {
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
  }

  private async loadBrandingConfiguration(): Promise<void> {
    try {
      const response = await new Promise<MessageResponse | null>((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_BRANDING_CONFIG" }, (response: MessageResponse) => {
          if (chrome.runtime.lastError) {
            console.warn("Failed to get branding from background:", chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });

      if (response && response.success && response.branding) {
        this.brandingConfig = response.branding;
        console.log("Popup: Loaded branding from background script:", this.brandingConfig);
        return;
      }

      console.warn("Popup: Using fallback branding configuration");
      this.brandingConfig = {
        companyName: "CyberDrain",
        productName: "Check",
        logoUrl: "images/icon32.png",
        supportUrl: "https://support.cyberdrain.com",
        privacyPolicyUrl: "https://cyberdrain.com/privacy",
        primaryColor: "#F77F00",
      };
    } catch (error) {
      console.error("Error loading branding configuration:", error);
      this.brandingConfig = {
        companyName: "CyberDrain",
        productName: "Check",
        logoUrl: "images/icon32.png",
        supportUrl: "https://support.cyberdrain.com",
        privacyPolicyUrl: "https://cyberdrain.com/privacy",
        primaryColor: "#F77F00",
      };
    }
  }

  private applyBranding(): void {
    if (!this.brandingConfig) return;
    console.log("Applying branding:", this.brandingConfig);

    if (this.elements.brandingTitle) {
      this.elements.brandingTitle.textContent = this.brandingConfig.productName || "Check";
    }

    if (this.brandingConfig.logoUrl && this.elements.brandingLogo) {
      console.log("Setting custom logo:", this.brandingConfig.logoUrl);
      const logoSrc = this.brandingConfig.logoUrl.startsWith("http") ? this.brandingConfig.logoUrl : chrome.runtime.getURL(this.brandingConfig.logoUrl);
      const testImg = new Image();
      testImg.onload = () => {
        console.log("Custom logo loaded successfully");
        this.elements.brandingLogo!.src = logoSrc;
      };
      testImg.onerror = () => {
        console.warn("Failed to load custom logo, using default");
        this.elements.brandingLogo!.src = chrome.runtime.getURL("images/icon32.png");
      };
      testImg.src = logoSrc;
    } else if (this.elements.brandingLogo) {
      console.log("No custom logo, using default");
      this.elements.brandingLogo.src = chrome.runtime.getURL("images/icon32.png");
    }

    if (this.elements.companyName) {
      this.elements.companyName.textContent = this.brandingConfig.companyName || "CyberDrain";
    }

    if (this.brandingConfig.supportUrl && this.elements.supportLink) {
      this.elements.supportLink.href = this.brandingConfig.supportUrl;
    }
    if (this.brandingConfig.privacyPolicyUrl && this.elements.privacyLink) {
      this.elements.privacyLink.href = this.brandingConfig.privacyPolicyUrl;
    }

    if (this.brandingConfig.primaryColor) {
      console.log("Applying primary color:", this.brandingConfig.primaryColor);
      const style = document.createElement("style");
      style.id = "custom-branding-css";
      style.textContent = `
        :root {
          --theme-primary: ${this.brandingConfig.primaryColor} !important;
          --theme-primary-hover: ${this.brandingConfig.primaryColor}dd !important;
        }
        .action-btn.primary {
          background-color: ${this.brandingConfig.primaryColor} !important;
        }
        .action-btn.primary:hover {
          background-color: ${this.brandingConfig.primaryColor}dd !important;
        }
      `;
      document.head.appendChild(style);
    }

    this.applyThemeColors();
  }

  private applyThemeColors(): void {
    if (!this.brandingConfig || !this.brandingConfig.branding) return;

    const branding = this.brandingConfig.branding;
    const root = document.documentElement;

    if (branding.primaryColor) root.style.setProperty("--theme-primary", branding.primaryColor);
    if (branding.primaryHover) root.style.setProperty("--theme-primary-hover", branding.primaryHover);
    if (branding.primaryLight) root.style.setProperty("--theme-primary-light", branding.primaryLight);
    if (branding.primaryDark) root.style.setProperty("--theme-primary-dark", branding.primaryDark);
    if (branding.secondaryColor) root.style.setProperty("--theme-secondary", branding.secondaryColor);
    if (branding.secondaryHover) root.style.setProperty("--theme-secondary-hover", branding.secondaryHover);
    if (branding.secondaryLight) root.style.setProperty("--theme-secondary-light", branding.secondaryLight);
    if (branding.secondaryDark) root.style.setProperty("--theme-secondary-dark", branding.secondaryDark);
    if (branding.accentColor) root.style.setProperty("--theme-accent", branding.accentColor);
    if (branding.successColor) root.style.setProperty("--theme-success", branding.successColor);
    if (branding.warningColor) root.style.setProperty("--theme-warning", branding.warningColor);
    if (branding.errorColor) root.style.setProperty("--theme-error", branding.errorColor);
    if (branding.textPrimary) root.style.setProperty("--theme-text-primary", branding.textPrimary);
    if (branding.textSecondary) root.style.setProperty("--theme-text-secondary", branding.textSecondary);
    if (branding.textMuted) root.style.setProperty("--theme-text-muted", branding.textMuted);
    if (branding.textInverse) root.style.setProperty("--theme-text-inverse", branding.textInverse);
    if (branding.bgPrimary) root.style.setProperty("--theme-bg-primary", branding.bgPrimary);
    if (branding.bgSecondary) root.style.setProperty("--theme-bg-secondary", branding.bgSecondary);
    if (branding.bgSurface) root.style.setProperty("--theme-bg-surface", branding.bgSurface);
    if (branding.border) root.style.setProperty("--theme-border", branding.border);
    if (branding.borderHover) root.style.setProperty("--theme-border-hover", branding.borderHover);
  }

  private async loadStatistics(): Promise<void> {
    try {
      try {
        const response = await this.sendMessage({ type: "GET_STATISTICS" });
        if (response && response.success && response.statistics) {
          this.stats = {
            blockedThreats: response.statistics.blockedThreats || 0,
            scannedPages: response.statistics.scannedPages || 0,
            securityEvents: response.statistics.securityEvents || 0,
          };

          if (this.elements.blockedThreats) this.elements.blockedThreats.textContent = this.stats.blockedThreats.toLocaleString();
          if (this.elements.scannedPages) this.elements.scannedPages.textContent = this.stats.scannedPages.toLocaleString();
          if (this.elements.securityEvents) this.elements.securityEvents.textContent = this.stats.securityEvents.toLocaleString();

          console.log("Statistics loaded from background script:", this.stats);
          return;
        }
      } catch (backgroundError) {
        console.warn("Failed to get statistics from background script:", backgroundError);
      }

      console.log("Using fallback statistics calculation");

      const safe = async (promise: Promise<any>) => {
        try {
          return await promise;
        } catch (_) {
          return {};
        }
      };

      const result = await safe(chrome.storage.local.get(["securityEvents", "accessLogs"]));
      const securityEvents = result?.securityEvents || [];
      const accessLogs = result?.accessLogs || [];

      let blockedThreats = 0;
      let scannedPages = 0;
      let securityEventsCount = securityEvents.length;

      securityEvents.forEach((entry: SecurityEvent) => {
        const event = entry.event;
        if (!event) return;

        if (
          event.type === "threat_blocked" ||
          event.type === "threat_detected" ||
          event.type === "content_threat_detected" ||
          (event.action && event.action.includes("blocked")) ||
          (event.threatLevel && ["high", "critical"].includes(event.threatLevel))
        ) {
          blockedThreats++;
        }
      });

      accessLogs.forEach((entry: SecurityEvent) => {
        const event = entry.event;
        if (event && event.type === "page_scanned") {
          scannedPages++;
        }
      });

      securityEvents.forEach((entry: SecurityEvent) => {
        const event = entry.event;
        if (event && event.type === "legitimate_access") {
          scannedPages++;
        }
      });

      this.stats = {
        blockedThreats: blockedThreats,
        scannedPages: scannedPages,
        securityEvents: securityEventsCount,
      };

      if (this.elements.blockedThreats) this.elements.blockedThreats.textContent = this.stats.blockedThreats.toLocaleString();
      if (this.elements.scannedPages) this.elements.scannedPages.textContent = this.stats.scannedPages.toLocaleString();
      if (this.elements.securityEvents) this.elements.securityEvents.textContent = this.stats.securityEvents.toLocaleString();

      console.log("Statistics calculated from fallback method:", this.stats);
    } catch (error) {
      console.error("Failed to load statistics:", error);
      if (this.elements.blockedThreats) this.elements.blockedThreats.textContent = "0";
      if (this.elements.scannedPages) this.elements.scannedPages.textContent = "0";
      if (this.elements.securityEvents) this.elements.securityEvents.textContent = "0";
    }
  }

  private handleBlockedRoute(): void {
    if (this.elements.pageInfoSection) {
      this.elements.pageInfoSection.style.display = "none";
    }

    try {
      if (this.currentTab?.url) {
        const urlParam = new URL(this.currentTab.url).searchParams.get("url");
        if (urlParam) {
          const originalUrl = decodeURIComponent(urlParam);
          const defanged = originalUrl.replace(/\./g, "[.]");
          if (this.elements.blockedUrl) this.elements.blockedUrl.textContent = defanged;
          if (this.elements.blockedNotice) this.elements.blockedNotice.style.display = "block";
        }
      }
    } catch (error) {
      console.warn("Check: Failed to parse blocked URL:", error);
    }
  }

  private async loadCurrentPageInfo(): Promise<void> {
    if (this.isBlockedRoute) {
      return;
    }

    if (!this.currentTab || !this.currentTab.url) {
      if (this.elements.currentUrl) this.elements.currentUrl.textContent = "No active tab";
      return;
    }

    try {
      const url = new URL(this.currentTab.url);
      if (this.elements.currentUrl) this.elements.currentUrl.textContent = url.hostname + url.pathname;

      this.showSecurityBadge("analyzing", "Analyzing...");

      try {
        const response = await this.sendMessage({
          type: "URL_ANALYSIS_REQUEST",
          url: this.currentTab.url,
        });

        if (response && response.success && response.analysis) {
          this.updateSecurityStatus(response.analysis);
        } else {
          this.showSecurityBadge("neutral", "Analysis unavailable");
        }
      } catch (error) {
        console.warn("Check: Failed to get URL analysis after retries:", error);
        this.showSecurityBadge("neutral", "Analysis unavailable");
      }

      try {
        chrome.tabs.sendMessage(this.currentTab.id!, { type: "GET_PAGE_INFO" }, (response: MessageResponse) => {
          if (chrome.runtime.lastError) {
            return;
          } else if (response && response.success) {
            console.log("Page info processing:", response.info);
            this.updatePageInfo(response.info as PageInfo);
          }
        });
      } catch (error) {
      }
    } catch (error) {
      console.error("Failed to load page info:", error);
      if (this.elements.currentUrl) this.elements.currentUrl.textContent = "Invalid URL";
      this.showSecurityBadge("neutral", "No Analysis Available");
    }
  }

  private updateSecurityStatus(analysis: AnalysisResult): void {
    const hasThreats = analysis.threats && analysis.threats.length > 0;
    const isBlocked = analysis.isBlocked;
    const isSuspicious = analysis.isSuspicious !== undefined ? analysis.isSuspicious : hasThreats;
    const isProtectionEnabled = analysis.protectionEnabled !== false;

    if (isBlocked) {
      this.showSecurityBadge("danger", "Blocked");
      this.showThreats(analysis.threats);
    } else if (isSuspicious) {
      this.showSecurityBadge("warning", "Suspicious");
      this.showThreats(analysis.threats);
    } else if (analysis.verdict === "trusted" || analysis.verdict === "trusted-extra") {
      this.showSecurityBadge("safe", "Trusted Login Domain");
      this.hideThreats();
    } else if (analysis.verdict === "ms-login-unknown") {
      this.showSecurityBadge("warning", "MS Login - Unknown Domain");
      this.hideThreats();
    } else if (analysis.verdict === "not-evaluated") {
      this.showSecurityBadge("neutral", "Not Microsoft Login");
      this.hideThreats();
    } else {
      this.showSecurityBadge("neutral", "No Action Required");
      this.hideThreats();
    }

    this.updateProtectionStatus(isProtectionEnabled);
  }

  private updateProtectionStatus(isEnabled: boolean): void {
    let protectionStatus = document.getElementById("protectionStatus");
    if (!protectionStatus) {
      protectionStatus = document.createElement("div");
      protectionStatus.id = "protectionStatus";
      protectionStatus.className = "protection-status";
      const securityStatusDiv = document.getElementById("securityStatus");
      if (securityStatusDiv && securityStatusDiv.parentNode) {
        securityStatusDiv.parentNode.insertBefore(protectionStatus, securityStatusDiv.nextSibling);
      }
    }

    if (!isEnabled) {
      protectionStatus.innerHTML = '<span class="protection-badge disabled">⚠️ Protection Disabled</span>';
      protectionStatus.style.display = "block";
    } else {
      protectionStatus.style.display = "none";
    }
  }

  private showSecurityBadge(type: string, text: string): void {
    if (this.elements.securityBadge) {
      this.elements.securityBadge.textContent = text;
      this.elements.securityBadge.className = `security-badge ${type}`;
    }
  }

  private showThreats(threats: ThreatInfo[]): void {
    if (threats && threats.length > 0) {
      if (this.elements.threatSummary) this.elements.threatSummary.style.display = "block";
      if (this.elements.threatList) {
        this.elements.threatList.innerHTML = "";
        threats.forEach((threat) => {
          const li = document.createElement("li");
          const displayName = this.getThreatDisplayName(threat.type);
          li.textContent = `${displayName}: ${threat.description}`;
          this.elements.threatList!.appendChild(li);
        });
      }
    } else {
      this.hideThreats();
    }
  }

  private getThreatDisplayName(threatType: string): string {
    const threatDisplayNames: { [key: string]: string } = {
      phishing_page: "Phishing Page",
      fake_login: "Fake Login Page",
      credential_harvesting: "Credential Harvesting",
      microsoft_impersonation: "Microsoft Impersonation",
      o365_phishing: "Office 365 Phishing",
      login_spoofing: "Login Page Spoofing",
      malicious_script: "Malicious Script",
      suspicious_redirect: "Suspicious Redirect",
      unsafe_download: "Unsafe Download",
      malware_detected: "Malware Detected",
      suspicious_form: "Suspicious Form",
      typosquatting: "Typosquatting Domain",
      suspicious_domain: "Suspicious Domain",
      homograph_attack: "Homograph Attack",
      punycode_abuse: "Punycode Abuse",
      suspicious_keywords: "Suspicious Keywords",
      social_engineering: "Social Engineering",
      urgency_tactics: "Urgency Tactics",
      trust_indicators: "Fake Trust Indicators",
      dom_manipulation: "DOM Manipulation",
      script_injection: "Script Injection",
      form_tampering: "Form Tampering",
      content_injection: "Content Injection",
      unusual_behavior: "Unusual Behavior",
      rapid_redirects: "Rapid Redirects",
      clipboard_access: "Clipboard Access",
      content_threat_detected: "Content Threat",
      threat_detected: "Security Threat",
      suspicious_activity: "Suspicious Activity",
      policy_violation: "Policy Violation",
    };

    return threatDisplayNames[threatType] || threatType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private hideThreats(): void {
    if (this.elements.threatSummary) this.elements.threatSummary.style.display = "none";
  }

  private updatePageInfo(pageInfo: PageInfo): void {
    console.log("Page info received:", pageInfo);
  }

  private addActivityItem(event: SecurityEvent): void {
    const item = document.createElement("div");
    item.className = "activity-item";

    const icon = document.createElement("div");
    icon.className = `activity-icon material-icons ${this.getActivityIconType(event.event.type)}`;
    icon.textContent = this.getActivityIcon(event.event.type);

    const text = document.createElement("span");
    text.className = "activity-text";
    text.textContent = this.getActivityText(event.event);

    const time = document.createElement("span");
    time.className = "activity-time";
    time.textContent = this.formatTime(new Date(event.timestamp));

    item.appendChild(icon);
    item.appendChild(text);
    item.appendChild(time);

    if (this.elements.activityList) {
      this.elements.activityList.appendChild(item);
    }
  }

  private getActivityIconType(eventType: string): string {
    if (eventType.includes("block") || eventType.includes("threat")) return "blocked";
    if (eventType.includes("warning") || eventType.includes("suspicious")) return "warned";
    return "scanned";
  }

  private getActivityIcon(eventType: string): string {
    if (eventType.includes("block")) return "security";
    if (eventType.includes("warning")) return "warning";
    if (eventType.includes("scan")) return "search";
    return "description";
  }

  private getActivityText(event: { type: string; url?: string; [key: string]: unknown }): string {
    switch (event.type) {
      case "url_access":
        return `Scanned ${new URL(event.url!).hostname}`;
      case "content_threat_detected":
        return `Content threat detected on ${new URL(event.url!).hostname}`;
      case "threat_detected":
        return `Security threat detected on ${new URL(event.url!).hostname}`;
      case "phishing_page":
        return `Phishing page blocked on ${new URL(event.url!).hostname}`;
      case "fake_login":
        return `Fake login page blocked on ${new URL(event.url!).hostname}`;
      case "malicious_script":
        return `Malicious script blocked on ${new URL(event.url!).hostname}`;
      case "suspicious_redirect":
        return `Suspicious redirect blocked on ${new URL(event.url!).hostname}`;
      case "form_submission":
        return "Form submission monitored";
      case "script_injection":
        return "Security script injected";
      case "page_scanned":
        return "Page scanned for threats";
      case "blocked_page_viewed":
        return "Attempted to view blocked content";
      case "threat_blocked":
        return "Security threat blocked";
      case "legitimate_access":
        return "Legitimate page accessed";
      default:
        return this.getEventDisplayName(event.type);
    }
  }

  private getEventDisplayName(eventType: string): string {
    const eventDisplayNames: { [key: string]: string } = {
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
      phishing_page: "Phishing Page Blocked",
      fake_login: "Fake Login Blocked",
      credential_harvesting: "Credential Harvesting Blocked",
      microsoft_impersonation: "Microsoft Impersonation Blocked",
      malicious_script: "Malicious Script Blocked",
      suspicious_redirect: "Suspicious Redirect Blocked",
      typosquatting: "Typosquatting Domain Blocked",
      social_engineering: "Social Engineering Blocked",
    };

    return eventDisplayNames[eventType] || eventType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  }

  private async checkEnterpriseMode(): Promise<void> {
    if (this.config?.enterpriseMode) {
      if (this.elements.enterpriseSection) this.elements.enterpriseSection.style.display = "block";

      if (this.config.organizationName && this.elements.managedBy) {
        this.elements.managedBy.textContent = this.config.organizationName;
      }

      const isCompliant = this.checkCompliance();
      this.updateComplianceStatus(isCompliant);
    }
  }

  private checkCompliance(): boolean {
    return true;
  }

  private updateComplianceStatus(isCompliant: boolean): void {
    if (this.elements.complianceBadge) {
      this.elements.complianceBadge.textContent = isCompliant ? "Compliant" : "Non-Compliant";
      this.elements.complianceBadge.className = isCompliant ? "compliance-badge" : "compliance-badge non-compliant";
    }
  }

  private openSettings(): void {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html") }, () => {
        if (chrome.runtime.lastError) {
          console.error("Check: Failed to open settings:", chrome.runtime.lastError.message);
        } else {
          window.close();
        }
      });
    } catch (error) {
      console.error("Check: Failed to open settings:", error);
    }
  }

  private handleFooterLink(event: Event, linkType: string): void {
    event.preventDefault();

    let url = "";
    switch (linkType) {
      case "support":
        url = this.brandingConfig?.supportUrl || "";
        break;
      case "privacy":
        url = this.brandingConfig?.privacyPolicyUrl || "";
        break;
      case "about":
        url = chrome.runtime.getURL("options/options.html#about");
        break;
    }

    if (url) {
      try {
        chrome.tabs.create({ url }, () => {
          if (chrome.runtime.lastError) {
            console.error("Check: Failed to open link:", chrome.runtime.lastError.message);
          } else {
            window.close();
          }
        });
      } catch (error) {
        console.error("Check: Failed to open link:", error);
      }
    }
  }

  private async checkBackgroundScript(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 2000);

      try {
        chrome.runtime.sendMessage({ type: "ping" }, (response: MessageResponse) => {
          clearTimeout(timeout);
          const isAvailable = !chrome.runtime.lastError && response && response.success;
          if (chrome.runtime.lastError) {
            console.warn("Check: Background script ping failed:", chrome.runtime.lastError.message);
          }
          resolve(isAvailable);
        });
      } catch (error) {
        clearTimeout(timeout);
        console.warn("Check: Failed to ping background script:", error);
        resolve(false);
      }
    });
  }

  private async waitForBackgroundScript(maxAttempts = 5): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      const isAvailable = await this.checkBackgroundScript();
      if (isAvailable) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return false;
  }

  private async sendMessage(message: any, retryCount = 0): Promise<MessageResponse> {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response: MessageResponse) => {
          if (chrome.runtime.lastError) {
            console.warn("Check: Background script connection failed:", chrome.runtime.lastError.message);

            if (retryCount < 3) {
              setTimeout(() => {
                this.sendMessage(message, retryCount + 1).then(resolve).catch(reject);
              }, 500 * (retryCount + 1));
              return;
            } else {
              reject(new Error(`Connection failed after ${retryCount + 1} attempts: ${chrome.runtime.lastError.message}`));
              return;
            }
          }

          resolve(response);
        });
      } catch (error) {
        if (retryCount < 3) {
          setTimeout(() => {
            this.sendMessage(message, retryCount + 1).then(resolve).catch(reject);
          }, 500 * (retryCount + 1));
        } else {
          reject(error);
        }
      }
    });
  }

  private showLoading(text = "Loading..."): void {
    this.isLoading = true;
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = "flex";
      const loadingText = this.elements.loadingOverlay.querySelector(".loading-text") as HTMLElement;
      if (loadingText) loadingText.textContent = text;
    }
  }

  private hideLoading(): void {
    this.isLoading = false;
    if (this.elements.loadingOverlay) this.elements.loadingOverlay.style.display = "none";
  }

  private showNotification(text: string, type = "info"): void {
    if (this.elements.notificationText) this.elements.notificationText.textContent = text;
    if (this.elements.notificationToast) {
      this.elements.notificationToast.className = `notification-toast ${type}`;
      this.elements.notificationToast.style.display = "flex";
    }

    setTimeout(() => {
      this.hideNotification();
    }, 3000);
  }

  private hideNotification(): void {
    if (this.elements.notificationToast) this.elements.notificationToast.style.display = "none";
  }

  private async initializeTheme(): Promise<void> {
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

      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.themeMode) {
          const newTheme = changes.themeMode.newValue;
          if (newTheme === "dark") {
            this.applyTheme(true);
          } else if (newTheme === "light") {
            this.applyTheme(false);
          } else {
            const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            this.applyTheme(systemDark);
          }
        }
      });
    } catch (error) {
      console.error("Check: Failed to initialize theme:", error);
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.applyTheme(systemDark);
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
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    new CheckPopup();
  }, 100);
});