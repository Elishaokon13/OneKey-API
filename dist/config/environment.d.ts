interface Config {
    server: {
        port: number;
        nodeEnv: string;
    };
    jwt: {
        secret: string;
        refreshSecret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    database: {
        url: string;
        host: string;
        port: number;
        name: string;
        user: string;
        password: string;
    };
    supabase: {
        url: string;
        anonKey: string;
        serviceKey: string;
    };
    kycProviders: {
        smileIdentity: {
            apiKey: string;
            partnerId: string;
        };
        onfido: {
            apiKey: string;
        };
        trulioo: {
            apiKey: string;
        };
    };
    blockchain: {
        privyAppId: string;
        privyAppSecret: string;
        easSchemaId: string;
        easAttestationUrl: string;
    };
    storage: {
        filecoinApiKey: string;
        arweaveWalletPath: string;
        litProtocolNetwork: string;
    };
    security: {
        corsOrigin: string;
        rateLimitWindowMs: number;
        rateLimitMaxRequests: number;
        encryptionKey: string;
        encryptionIv: string;
    };
}
declare const config: Config;
export default config;
//# sourceMappingURL=environment.d.ts.map