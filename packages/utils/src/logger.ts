function log(logger: any, serviceName: string, ...args: any) {
  const timestamp = new Date().toISOString();
  logger(`[${timestamp}] [${serviceName}]`, ...args);
}

export function logInfo(serviceName: string, ...args: any) {
  log(console.info, serviceName, ...args);
}

export function logError(serviceName: string, ...args: any) {
  log(console.error, serviceName, ...args);
}

export function logDebug(serviceName: string, ...args: any) {
  log(console.debug, serviceName, ...args);
}

export function logWarn(serviceName: string, ...args: any) {
  log(console.warn, serviceName, ...args);
}

export function logTrace(serviceName: string, ...args: any) {
  log(console.trace, serviceName, ...args);
}

export function initLogger(serviceName: string) {
  return {
    info: (...args: any) => logInfo(serviceName, ...args),
    error: (...args: any) => logError(serviceName, ...args),
    debug: (...args: any) => logDebug(serviceName, ...args),
    warn: (...args: any) => logWarn(serviceName, ...args),
    trace: (...args: any) => logTrace(serviceName, ...args),
  };
}