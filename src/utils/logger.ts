// OneKey KYC API - Logger Utility
// Centralized logging for the entire application

import { config } from '../config/environment';

export interface LogContext {
  [key: string]: any;
}

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

class ConsoleLogger implements Logger {
  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      return `${baseMessage} ${JSON.stringify(context, null, 2)}`;
    }
    
    return baseMessage;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage('error', message, context));
  }

  debug(message: string, context?: LogContext): void {
    if (config.server.nodeEnv === 'development') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
}

// Create and export logger instance
export const logger: Logger = new ConsoleLogger(); 