import { Request, Response, NextFunction } from 'express';
export declare class ApiError extends Error {
    statusCode: number;
    errorCode: string;
    isOperational: boolean;
    constructor(message: string, statusCode?: number, errorCode?: string, isOperational?: boolean);
}
export declare class ValidationError extends ApiError {
    constructor(message: string, field?: string);
}
export declare class AuthenticationError extends ApiError {
    constructor(message?: string);
}
export declare class AuthorizationError extends ApiError {
    constructor(message?: string);
}
export declare class KycError extends ApiError {
    constructor(message: string, provider?: string);
}
export declare class AttestationError extends ApiError {
    constructor(message: string);
}
export declare class StorageError extends ApiError {
    constructor(message: string, provider?: string);
}
export declare const requestId: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const errorHandler: (error: Error, req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response) => void;
//# sourceMappingURL=errorHandler.d.ts.map