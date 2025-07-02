export interface LogContext {
    [key: string]: any;
}
export interface Logger {
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map