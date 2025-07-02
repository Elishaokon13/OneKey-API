"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const config = {
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    database: {
        url: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || 'postgresql://localhost:5432/onekey_db',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME || 'onekey_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
    },
    supabase: {
        url: process.env.SUPABASE_URL || '',
        anonKey: process.env.SUPABASE_ANON_KEY || '',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    },
    kycProviders: {
        smileIdentity: {
            apiKey: process.env.SMILE_IDENTITY_API_KEY || '',
            partnerId: process.env.SMILE_IDENTITY_PARTNER_ID || '',
        },
        onfido: {
            apiKey: process.env.ONFIDO_API_KEY || '',
        },
        trulioo: {
            apiKey: process.env.TRULIOO_API_KEY || '',
        },
    },
    blockchain: {
        privyAppId: process.env.PRIVY_APP_ID || '',
        privyAppSecret: process.env.PRIVY_APP_SECRET || '',
        easSchemaId: process.env.EAS_SCHEMA_ID || '',
        easAttestationUrl: process.env.EAS_ATTESTATION_URL || 'https://base-sepolia.easscan.org',
    },
    storage: {
        filecoinApiKey: process.env.FILECOIN_API_KEY || '',
        arweaveWalletPath: process.env.ARWEAVE_WALLET_PATH || './arweave-wallet.json',
        litProtocolNetwork: process.env.LIT_PROTOCOL_NETWORK || 'cayenne',
    },
    security: {
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-in-production',
        encryptionIv: process.env.ENCRYPTION_IV || 'dev-encryption-iv-change-in-production',
    },
};
exports.default = config;
//# sourceMappingURL=environment.js.map