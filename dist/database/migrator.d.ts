export declare const runMigrations: () => Promise<void>;
export declare const getMigrationStatus: () => Promise<{
    appliedMigrations: string[];
    pendingMigrations: string[];
    totalMigrations: number;
}>;
export declare const createMigration: (name: string) => string;
export declare const rollbackMigration: (version: string) => Promise<void>;
export declare const resetDatabase: () => Promise<void>;
//# sourceMappingURL=migrator.d.ts.map