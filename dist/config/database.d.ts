import { Pool, PoolClient, QueryResult } from 'pg';
export declare const initializeDatabase: () => Promise<void>;
export declare const closeDatabase: () => Promise<void>;
export declare const getDatabase: () => Pool;
export declare const checkDatabaseHealth: () => Promise<{
    status: string;
    details: {
        connected: boolean;
        totalConnections: number;
        idleConnections: number;
        waitingConnections: number;
        serverVersion?: string;
        uptime?: string;
        supabase?: {
            status: string;
            publicClient: boolean;
            serviceClient: boolean;
            url?: string;
        };
    };
}>;
export declare const query: (text: string, params?: any[]) => Promise<QueryResult>;
export declare const transaction: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
//# sourceMappingURL=database.d.ts.map