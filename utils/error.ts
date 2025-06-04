import { config, getApiUrl } from './config';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export type ErrorContext = {
  userId?: string;
  roomId?: string;
  action?: string;
  [key: string]: any;
};

export type ErrorLog = {
  timestamp: string;
  severity: ErrorSeverity;
  message: string;
  error?: Error;
  context?: ErrorContext;
  stack?: string;
};

class ErrorHandler {
  private static instance: ErrorHandler;
  private logs: ErrorLog[] = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private formatError(error: Error | string): string {
    if (error instanceof Error) {
      return error.message;
    }
    return error;
  }

  private getStack(error: Error | string): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }
    return undefined;
  }

  private logToConsole(log: ErrorLog) {
    const timestamp = new Date().toISOString();
    const severity = log.severity.toUpperCase();
    const context = log.context ? `\nContext: ${JSON.stringify(log.context, null, 2)}` : '';
    const stack = log.stack ? `\nStack: ${log.stack}` : '';

    console.log(`[${timestamp}] ${severity}: ${log.message}${context}${stack}`);
  }

  private async logToServer(log: ErrorLog) {
    if (config.environment === 'development') {
      return;
    }

    try {
      const response = await fetch(`${getApiUrl()}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
      });

      if (!response.ok) {
        console.error('Failed to send error log to server:', await response.text());
      }
    } catch (error) {
      console.error('Failed to send error log to server:', error);
    }
  }

  log(
    severity: ErrorSeverity,
    message: string,
    error?: Error | string,
    context?: ErrorContext
  ) {
    const log: ErrorLog = {
      timestamp: new Date().toISOString(),
      severity,
      message,
      error: error instanceof Error ? error : undefined,
      context,
      stack: error ? this.getStack(error) : undefined,
    };

    this.logs.push(log);
    this.logToConsole(log);
    this.logToServer(log);

    if (severity === 'critical') {
      // In a real application, you might want to:
      // 1. Send notifications to administrators
      // 2. Trigger incident response procedures
      // 3. Attempt to recover from the error
      console.error('Critical error occurred:', log);
    }
  }

  info(message: string, context?: ErrorContext) {
    this.log('info', message, undefined, context);
  }

  warning(message: string, error?: Error | string, context?: ErrorContext) {
    this.log('warning', message, error, context);
  }

  error(message: string, error?: Error | string, context?: ErrorContext) {
    this.log('error', message, error, context);
  }

  critical(message: string, error?: Error | string, context?: ErrorContext) {
    this.log('critical', message, error, context);
  }

  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }
}

export const errorHandler = ErrorHandler.getInstance();

export function handleError(
  error: Error | string,
  context?: ErrorContext
): void {
  const message = error instanceof Error ? error.message : error;
  errorHandler.error(message, error, context);
}

export function handleCriticalError(
  error: Error | string,
  context?: ErrorContext
): void {
  const message = error instanceof Error ? error.message : error;
  errorHandler.critical(message, error, context);
}

export function logInfo(message: string, context?: ErrorContext): void {
  errorHandler.info(message, context);
}

export function logWarning(
  message: string,
  error?: Error | string,
  context?: ErrorContext
): void {
  errorHandler.warning(message, error, context);
}

export const handleConnectionError = (error: Error) => {
  console.error('Connection Error:', error);
  // Add any connection-specific error handling here
};

export const handleMediaError = (error: Error) => {
  console.error('Media Error:', error);
  // Add any media-specific error handling here
};

export function handleActionError(error: any, context: any) {
  console.error(`Error in ${context.action}:`, error);
  
  // Log to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Add your monitoring service here (e.g., Sentry)
    // Sentry.captureException(error, {
    //   extra: context
    // });
  }
  
  // Handle specific error types
  if (error.code === 'ECONNREFUSED') {
    // Handle connection errors
  } else if (error.code === 'PGRST116') {
    // Handle Supabase not found errors
  }
  
  throw error;
} 