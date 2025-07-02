"use strict";
// OneKey KYC API - Logger Utility
// Centralized logging for the entire application
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const environment_1 = require("../config/environment");
class ConsoleLogger {
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const baseMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        if (context && Object.keys(context).length > 0) {
            return `${baseMessage} ${JSON.stringify(context, null, 2)}`;
        }
        return baseMessage;
    }
    info(message, context) {
        console.log(this.formatMessage('info', message, context));
    }
    warn(message, context) {
        console.warn(this.formatMessage('warn', message, context));
    }
    error(message, context) {
        console.error(this.formatMessage('error', message, context));
    }
    debug(message, context) {
        if (environment_1.config.server.nodeEnv === 'development') {
            console.debug(this.formatMessage('debug', message, context));
        }
    }
}
// Create and export logger instance
exports.logger = new ConsoleLogger();
//# sourceMappingURL=logger.js.map