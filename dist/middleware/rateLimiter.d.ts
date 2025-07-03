export declare const generalLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const kycLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const attestationLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const applyAttestationRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const encryptionOperationsLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const keyManagementLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const fileEncryptionLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const rateLimiter: {
    general: import("express-rate-limit").RateLimitRequestHandler;
    auth: import("express-rate-limit").RateLimitRequestHandler;
    kyc: import("express-rate-limit").RateLimitRequestHandler;
    attestation: import("express-rate-limit").RateLimitRequestHandler;
    attestationOperations: import("express-rate-limit").RateLimitRequestHandler;
    encryptionOperations: import("express-rate-limit").RateLimitRequestHandler;
    keyManagement: import("express-rate-limit").RateLimitRequestHandler;
    fileEncryption: import("express-rate-limit").RateLimitRequestHandler;
};
//# sourceMappingURL=rateLimiter.d.ts.map