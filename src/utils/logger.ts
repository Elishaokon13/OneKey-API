// OneKey KYC API - Logger Utility
// Centralized logging for the entire application

import { config } from '../config/environment';

export type LogContext = Record<string, any>;

export const logger = {
  info: (message: string, context?: LogContext) => {
    console.log(message, context || '');
  },
  error: (message: string, context?: LogContext) => {
    console.error(message, context || '');
  },
  warn: (message: string, context?: LogContext) => {
    console.warn(message, context || '');
  },
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(message, context || '');
    }
  }
}; 