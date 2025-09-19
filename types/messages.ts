export interface BaseMessage {
  type: string;
}

export interface GetConfigMessage extends BaseMessage {
  type: 'GET_CONFIG';
}

export interface GetDetectionRulesMessage extends BaseMessage {
  type: 'get_detection_rules';
}

export interface GetStatsMessage extends BaseMessage {
  type: 'GET_STATS';
}

export interface GetLogsMessage extends BaseMessage {
  type: 'GET_LOGS';
  filter?: string;
}

export interface ClearLogsMessage extends BaseMessage {
  type: 'CLEAR_LOGS';
}

export interface SaveConfigMessage extends BaseMessage {
  type: 'SAVE_CONFIG';
  config: Record<string, unknown>;
}

export interface RefreshDetectionRulesMessage extends BaseMessage {
  type: 'REFRESH_DETECTION_RULES';
}

export interface RuntimeLogMessage extends BaseMessage {
  type: 'log';
  level: string;
  message: string;
}

export interface PageAnalysisMessage extends BaseMessage {
  type: 'PAGE_ANALYSIS';
  url: string;
  isPhishing: boolean;
  reasons: string[];
  confidence: number;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  rules?: unknown;
  config?: unknown;
  stats?: unknown;
  logs?: unknown[];
  branding?: unknown;
  message?: string;
}

export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export interface FlagPhishyMessage extends BaseMessage {
  type: 'FLAG_PHISHY';
  reason?: string;
}

export interface FlagTrustedMessage extends BaseMessage {
  type: 'FLAG_TRUSTED_BY_REFERRER';
}

export interface CheckRogueAppMessage extends BaseMessage {
  type: 'CHECK_ROGUE_APP';
  clientId: string;
}

export interface UrlAnalysisMessage extends BaseMessage {
  type: 'URL_ANALYSIS_REQUEST';
  url: string;
}

export interface PolicyCheckMessage extends BaseMessage {
  type: 'POLICY_CHECK';
  action: string;
  context?: Record<string, unknown>;
}

export interface LogEventMessage extends BaseMessage {
  type: 'LOG_EVENT';
  event: Record<string, unknown>;
}

export interface GetBrandingConfigMessage extends BaseMessage {
  type: 'GET_BRANDING_CONFIG';
}

export interface GetPoliciesMessage extends BaseMessage {
  type: 'GET_POLICIES';
}

export interface GetStatisticsMessage extends BaseMessage {
  type: 'GET_STATISTICS';
}

export interface UpdateConfigMessage extends BaseMessage {
  type: 'UPDATE_CONFIG';
  config: Record<string, unknown>;
}

export interface ForceUpdateRulesMessage extends BaseMessage {
  type: 'force_update_detection_rules';
}

export type ExtensionMessage = 
  | GetConfigMessage 
  | GetDetectionRulesMessage 
  | GetStatsMessage 
  | GetLogsMessage 
  | ClearLogsMessage 
  | SaveConfigMessage 
  | RefreshDetectionRulesMessage 
  | RuntimeLogMessage 
  | PageAnalysisMessage
  | PingMessage
  | FlagPhishyMessage
  | FlagTrustedMessage
  | CheckRogueAppMessage
  | UrlAnalysisMessage
  | PolicyCheckMessage
  | LogEventMessage
  | GetBrandingConfigMessage
  | GetPoliciesMessage
  | GetStatisticsMessage
  | UpdateConfigMessage
  | ForceUpdateRulesMessage;
