export interface Config {
  extensionEnabled: boolean;
  enableContentManipulation: boolean;
  enableUrlMonitoring: boolean;
  showNotifications: boolean;
  enableValidPageBadge: boolean;
  customRulesUrl: string;
  updateInterval: number;
  enableDebugLogging: boolean;
  enableDeveloperConsoleLogging: boolean;
  enterpriseMode?: boolean;
  organizationName?: string;
}

export interface BrandingConfig {
  companyName: string;
  productName: string;
  logoUrl?: string;
  supportUrl?: string;
  privacyPolicyUrl?: string;
  primaryColor?: string;
  supportEmail?: string;
  branding?: {
    primaryColor?: string;
    primaryHover?: string;
    primaryLight?: string;
    primaryDark?: string;
    secondaryColor?: string;
    secondaryHover?: string;
    secondaryLight?: string;
    secondaryDark?: string;
    accentColor?: string;
    successColor?: string;
    warningColor?: string;
    errorColor?: string;
    textPrimary?: string;
    textSecondary?: string;
    textMuted?: string;
    textInverse?: string;
    bgPrimary?: string;
    bgSecondary?: string;
    bgSurface?: string;
    border?: string;
    borderHover?: string;
  };
}

export interface SecurityEvent {
  timestamp: string;
  event: {
    type: string;
    url?: string;
    action?: string;
    threatLevel?: string;
    description?: string;
  };
}

export interface ThreatInfo {
  type: string;
  description: string;
}

export interface AnalysisResult {
  threats: ThreatInfo[];
  isBlocked: boolean;
  isSuspicious: boolean;
  protectionEnabled: boolean;
  verdict: string;
}

export interface Statistics {
  blockedThreats: number;
  scannedPages: number;
  securityEvents: number;
}

export interface PopupElements {
  brandingLogo: HTMLImageElement;
  brandingTitle: HTMLElement;
  statusIndicator: HTMLElement;
  statusDot: HTMLElement;
  statusText: HTMLElement;
  openSettings: HTMLButtonElement;
  pageInfoSection: HTMLElement;
  currentUrl: HTMLElement;
  securityStatus: HTMLElement;
  securityBadge: HTMLElement;
  threatSummary: HTMLElement;
  threatList: HTMLElement;
  blockedNotice: HTMLElement;
  blockedUrl: HTMLElement;
  blockedThreats: HTMLElement;
  scannedPages: HTMLElement;
  securityEvents: HTMLElement;
  enterpriseSection: HTMLElement;
  managedBy: HTMLElement;
  complianceBadge: HTMLElement;
  activityList: HTMLElement;
  supportLink: HTMLAnchorElement;
  privacyLink: HTMLAnchorElement;
  aboutLink: HTMLAnchorElement;
  companyBranding: HTMLElement;
  companyName: HTMLElement;
  loadingOverlay: HTMLElement;
  notificationToast: HTMLElement;
  notificationText: HTMLElement;
  notificationClose: HTMLElement;
}

export interface OptionsElements {
  menuItems: NodeListOf<HTMLElement>;
  sections: NodeListOf<HTMLElement>;
  pageTitle: HTMLElement;
  policyBadge: HTMLElement;
  sidebar: HTMLElement;
  mobileMenuToggle: HTMLElement;
  mobileTitleText: HTMLElement;
  mobileSubtitleText: HTMLElement;
  saveSettings: HTMLButtonElement;
  darkModeToggle: HTMLButtonElement;
  extensionEnabled: HTMLInputElement;
  enableContentManipulation: HTMLInputElement;
  enableUrlMonitoring: HTMLInputElement;
  showNotifications: HTMLInputElement;
  enableValidPageBadge: HTMLInputElement;
  customRulesUrl: HTMLInputElement;
  updateInterval: HTMLInputElement;
  refreshDetectionRules: HTMLButtonElement;
  configDisplay: HTMLElement;
  toggleConfigView: HTMLButtonElement;
  enableDebugLogging: HTMLInputElement;
  enableDeveloperConsoleLogging: HTMLInputElement;
  simulateEnterpriseMode: HTMLInputElement;
  logFilter: HTMLSelectElement;
  refreshLogs: HTMLButtonElement;
  clearLogs: HTMLButtonElement;
  exportLogs: HTMLButtonElement;
  logsList: HTMLElement;
  companyName: HTMLInputElement;
  productName: HTMLInputElement;
  supportEmail: HTMLInputElement;
  primaryColor: HTMLInputElement;
  logoUrl: HTMLInputElement;
  brandingPreview: HTMLElement;
  previewLogo: HTMLImageElement;
  previewTitle: HTMLElement;
  previewButton: HTMLButtonElement;
  extensionVersion: HTMLElement;
  rulesVersion: HTMLElement;
  lastUpdated: HTMLElement;
  modalOverlay: HTMLElement;
  modalTitle: HTMLElement;
  modalMessage: HTMLElement;
  modalCancel: HTMLButtonElement;
  modalConfirm: HTMLButtonElement;
  toastContainer: HTMLElement;
}

export interface MessageResponse {
  success: boolean;
  config?: Config;
  branding?: BrandingConfig;
  analysis?: AnalysisResult;
  statistics?: Statistics;
  [key: string]: unknown;
}


export interface PageInfo {
  title?: string;
  [key: string]: unknown;
}