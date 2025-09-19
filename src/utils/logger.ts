import type { LogLevel, LoggerConfig, Logger } from '../../types/logger';

const levels: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

let config: Required<LoggerConfig> = {
  level: "info",
  enabled: true,
  output: console,
};

export function init({ level = "info", enabled = true, output = console }: LoggerConfig = {}): void {
  config.level = level;
  config.enabled = enabled;
  config.output = output || console;
}

function shouldLog(level: LogLevel): boolean {
  return config.enabled && levels[level] <= levels[config.level];
}

function sendToBackground(level: LogLevel, args: unknown[]): void {
  try {
    if (!globalThis.chrome?.runtime?.id) {
      const outputMethod = config.output[level as keyof Console];
      if (typeof outputMethod === 'function') {
        (outputMethod as (...args: unknown[]) => void)(...args);
      } else {
        config.output.log(...args);
      }
      return;
    }

    const message = args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    chrome.runtime
      .sendMessage({ type: 'log', level, message })
      .catch((error: Error) => {
        if (error.message.includes('Receiving end does not exist')) {
          const outputMethod = config.output[level as keyof Console];
          if (typeof outputMethod === 'function') {
            (outputMethod as (...args: unknown[]) => void)(...args);
          } else {
            config.output.log(...args);
          }
        } else {
          console.error('Failed to send log to background:', error.message);
        }
      });
  } catch (e) {
    console.error('Failed to send log:', e);
  }
}

export function error(...args: unknown[]): void {
  if (shouldLog('error')) {
    config.output.error(...args);
    sendToBackground('error', args);
  }
}

export function warn(...args: unknown[]): void {
  if (shouldLog('warn')) {
    config.output.warn(...args);
    sendToBackground('warn', args);
  }
}

export function log(...args: unknown[]): void {
  if (shouldLog('info')) {
    config.output.log(...args);
    sendToBackground('info', args);
  }
}

export function debug(...args: unknown[]): void {
  if (shouldLog('debug')) {
    const debugMethod = config.output.debug;
    if (typeof debugMethod === 'function') {
      debugMethod(...args);
    } else {
      config.output.log(...args);
    }
    sendToBackground('debug', args);
  }
}

const logger: Logger = {
  init,
  log,
  warn,
  error,
  debug,
};

export default logger;