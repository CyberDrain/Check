export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LoggerConfig {
  level?: LogLevel;
  enabled?: boolean;
  output?: Console;
}

export interface Logger {
  init(config?: LoggerConfig): void;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface LogMessage {
  type: 'log';
  level: LogLevel;
  message: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  source?: string;
}