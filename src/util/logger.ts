export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export function createLogger(prefix = "pi-sdd-stack"): Logger {
  return {
    info(message) {
      console.info(`[${prefix}] ${message}`);
    },
    warn(message) {
      console.warn(`[${prefix}] ${message}`);
    },
    error(message) {
      console.error(`[${prefix}] ${message}`);
    },
  };
}
