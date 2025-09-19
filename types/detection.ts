export interface DetectionRules {
  version: string;
  lastUpdated: string;
  description: string;
  trusted_login_patterns: string[];
  microsoft_domain_patterns: string[];
  exclusion_system: ExclusionSystem;
  legitimate_discussion_domains: string[];
  m365_detection_requirements: M365DetectionRequirements;
  blocking_rules: BlockingRule[];
  rogue_apps_detection?: RogueAppsDetection;
}

export interface ExclusionSystem {
  description: string;
  domain_patterns: string[];
  context_indicators: ContextIndicators;
}

export interface ContextIndicators {
  description: string;
  legitimate_contexts: string[];
  legitimate_sso_patterns: string[];
  suspicious_contexts: string[];
}

export interface M365DetectionRequirements {
  description: string;
  primary_elements: DetectionElement[];
  secondary_elements: DetectionElement[];
  detection_thresholds: DetectionThresholds;
  legacy_minimum_required: number;
  legacy_all_must_be_present: boolean;
}

export interface DetectionElement {
  id: string;
  type: 'source_content' | 'css_pattern' | 'form_action_validation';
  pattern?: string;
  patterns?: string[];
  description: string;
  weight: number;
  category: 'primary' | 'secondary';
}

export interface DetectionThresholds {
  minimum_primary_elements: number;
  minimum_total_weight: number;
  minimum_elements_overall: number;
  minimum_secondary_only_weight: number;
  minimum_secondary_only_elements: number;
}

export interface BlockingRule {
  id: string;
  type: 'form_action_validation' | 'url_validation' | 'content_validation';
  description: string;
  condition: BlockingCondition;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  action?: 'warn' | 'block' | 'log';
}

export interface BlockingCondition {
  form_selector?: string;
  action_must_not_contain?: string;
  has_password_field?: boolean;
  url_patterns?: string[];
  content_patterns?: string[];
  minimum_matches?: number;
}

export interface RogueAppsDetection {
  enabled: boolean;
  source_url: string;
  cache_duration: number;
  update_interval: number;
  detection_action: 'warn' | 'block' | 'log';
  severity: 'low' | 'medium' | 'high' | 'critical';
  auto_update: boolean;
  fallback_on_error: boolean;
}

export interface RogueApp {
  appId: string;
  displayName: string;
  publisherName?: string;
  description?: string;
  reason?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  source?: string;
  dateAdded?: string;
  lastUpdated?: string;
}

export interface DetectionResult {
  isPhishing: boolean;
  confidence: number;
  detectedElements: string[];
  totalWeight: number;
  primaryElementsCount: number;
  secondaryElementsCount: number;
  reasons: string[];
  appliedRules: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  url: string;
}