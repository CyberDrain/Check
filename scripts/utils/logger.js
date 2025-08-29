const levels = { error: 0, warn: 1, info: 2, debug: 3 };

let config = {
  level: "info",
  enabled: true,
  output: console,
};

export function init({ level = "info", enabled = true, output = console } = {}) {
  config.level = level;
  config.enabled = enabled;
  config.output = output || console;
}

function shouldLog(level) {
  return config.enabled && levels[level] <= levels[config.level];
}

export function error(...args) {
  if (shouldLog("error")) {
    config.output.error(...args);
  }
}

export function warn(...args) {
  if (shouldLog("warn")) {
    config.output.warn(...args);
  }
}

export function log(...args) {
  if (shouldLog("info")) {
    config.output.log(...args);
  }
}

export function debug(...args) {
  if (shouldLog("debug")) {
    if (typeof config.output.debug === "function") {
      config.output.debug(...args);
    } else {
      config.output.log(...args);
    }
  }
}

export default {
  init,
  log,
  warn,
  error,
  debug,
};
