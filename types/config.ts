export interface ExtensionConfig {
  extensionEnabled?: boolean;
  enableContentManipulation?: boolean;
  enableUrlMonitoring?: boolean;
  showNotifications?: boolean;
  enableValidPageBadge?: boolean;
  enablePageBlocking?: boolean;
  enableCippReporting?: boolean;
  cippServerUrl?: string;
  cippTenantId?: string;
  customRulesUrl?: string;
  updateInterval?: number;
  enableDebugLogging?: boolean;
  enableDeveloperConsoleLogging?: boolean;
  customBranding?: BrandingConfig;
}

export interface BrandingConfig {
  companyName?: string;
  productName?: string;
  version?: string;
  description?: string;
  primaryColor?: string;
  logoUrl?: string;
  branding?: BrandingTheme;
  assets?: BrandingAssets;
  customization?: BrandingCustomization;
  features?: BrandingFeatures;
  customText?: BrandingCustomText;
  socialMedia?: BrandingSocialMedia;
  whiteLabel?: BrandingWhiteLabel;
  licensing?: BrandingLicensing;
  deployment?: BrandingDeployment;
  analytics?: BrandingAnalytics;
  updates?: BrandingUpdates;
  metadata?: BrandingMetadata;
}

export interface BrandingTheme {
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
}

export interface BrandingAssets {
  logoUrl?: string;
  iconUrl?: string;
  faviconUrl?: string;
  bannerUrl?: string;
  screenshotUrls?: string[];
}

export interface BrandingCustomization {
  showCompanyBranding?: boolean;
  allowUserCustomization?: boolean;
  enableWhiteLabeling?: boolean;
  customCssEnabled?: boolean;
  customIconsEnabled?: boolean;
}

export interface BrandingFeatures {
  welcomeMessage?: string;
  tagline?: string;
  securityBadgeText?: string;
  blockedPageTitle?: string;
  blockedPageMessage?: string;
}

export interface BrandingCustomText {
  extensionDescription?: string;
  securityFeatures?: string[];
  enterpriseFeatures?: string[];
}

export interface BrandingSocialMedia {
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  github?: string;
}

export interface BrandingWhiteLabel {
  enabled?: boolean;
  allowCustomColors?: boolean;
  allowCustomLogos?: boolean;
  allowCustomText?: boolean;
  allowCustomIcons?: boolean;
  allowCustomCss?: boolean;
  preserveAttribution?: boolean;
  customizableElements?: string[];
}

export interface BrandingLicensing {
  licenseKey?: string;
  licensedTo?: string;
  licenseType?: string;
  licenseExpiry?: string | null;
  maxUsers?: number | null;
  features?: string[];
}

export interface BrandingDeployment {
  supportedPlatforms?: string[];
  minimumVersion?: string;
  manifestVersion?: number;
  deploymentMethods?: string[];
}

export interface BrandingAnalytics {
  enabled?: boolean;
  trackingId?: string;
  events?: string[];
  anonymizeData?: boolean;
  respectDoNotTrack?: boolean;
}

export interface BrandingUpdates {
  autoUpdateEnabled?: boolean;
  updateChannel?: string;
  updateCheckInterval?: number;
}

export interface BrandingMetadata {
  created?: string;
  modified?: string;
  author?: string;
  maintainer?: string;
  schema_version?: string;
}

export interface EnterpriseConfig extends ExtensionConfig {
  customBranding?: BrandingConfig;
}

export interface PopupStats {
  blockedThreats: number;
  scannedPages: number;
  securityEvents: number;
}

export interface ActivityItem {
  id: string;
  type: 'threat' | 'scan' | 'event';
  timestamp: string;
  message: string;
  url?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}