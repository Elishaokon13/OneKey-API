"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetDatabase = exports.rollbackMigration = exports.createMigration = exports.getMigrationStatus = exports.runMigrations = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("@/config/database");
const supabase_1 = require("@/config/supabase");
// Get all migration files
const getMigrationFiles = () => {
    const migrationsDir = path_1.default.join(__dirname, 'migrations');
    if (!fs_1.default.existsSync(migrationsDir)) {
        console.log('📁 Creating migrations directory...');
        fs_1.default.mkdirSync(migrationsDir, { recursive: true });
        return [];
    }
    const files = fs_1.default.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort to ensure proper order
    return files.map(filename => {
        const versionPart = filename.split('_')[0];
        if (!versionPart) {
            throw new Error(`Invalid migration filename format: ${filename}. Expected format: 001_description.sql`);
        }
        const content = fs_1.default.readFileSync(path_1.default.join(migrationsDir, filename), 'utf8');
        return {
            version: versionPart,
            filename,
            content
        };
    });
};
// Check if migration has been applied
const isMigrationApplied = async (version) => {
    try {
        const result = await (0, database_1.query)('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
        return result.rows.length > 0;
    }
    catch (error) {
        // If schema_migrations table doesn't exist, no migrations have been applied
        return false;
    }
};
// Apply a single migration
const applyMigration = async (migration) => {
    console.log(`📄 Applying migration ${migration.version}: ${migration.filename}`);
    try {
        // Execute the migration SQL
        await (0, database_1.query)(migration.content);
        console.log(`✅ Migration ${migration.version} applied successfully`);
    }
    catch (error) {
        console.error(`❌ Failed to apply migration ${migration.version}:`, error);
        throw error;
    }
};
// Run all pending migrations
const runMigrations = async () => {
    console.log('🔄 Starting database migrations...');
    // Skip migrations when using Supabase (tables already exist)
    if ((0, supabase_1.isSupabaseConfigured)()) {
        console.log('⏭️  Skipping migrations (Supabase mode - tables already exist)');
        console.log('✅ Database schema is managed by Supabase');
        return;
    }
    try {
        // Ensure database connection is available
        const pool = (0, database_1.getDatabase)();
        // Get all migration files
        const migrations = getMigrationFiles();
        if (migrations.length === 0) {
            console.log('📭 No migration files found');
            return;
        }
        console.log(`📊 Found ${migrations.length} migration file(s)`);
        // Process each migration
        let appliedCount = 0;
        for (const migration of migrations) {
            const isApplied = await isMigrationApplied(migration.version);
            if (isApplied) {
                console.log(`⏭️  Migration ${migration.version} already applied, skipping`);
                continue;
            }
            await applyMigration(migration);
            appliedCount++;
        }
        if (appliedCount === 0) {
            console.log('✅ All migrations are up to date');
        }
        else {
            console.log(`✅ Applied ${appliedCount} new migration(s)`);
        }
        // Show current schema version
        const latestMigration = migrations[migrations.length - 1];
        if (latestMigration) {
            console.log(`📌 Current schema version: ${latestMigration.version}`);
        }
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};
exports.runMigrations = runMigrations;
// Get migration status
const getMigrationStatus = async () => {
    const migrations = getMigrationFiles();
    const appliedMigrations = [];
    const pendingMigrations = [];
    for (const migration of migrations) {
        const isApplied = await isMigrationApplied(migration.version);
        if (isApplied) {
            appliedMigrations.push(migration.version);
        }
        else {
            pendingMigrations.push(migration.version);
        }
    }
    return {
        appliedMigrations,
        pendingMigrations,
        totalMigrations: migrations.length
    };
};
exports.getMigrationStatus = getMigrationStatus;
// Create a new migration file template
const createMigration = (name) => {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const version = timestamp.substring(2, 8); // YYMMDD format
    const filename = `${version}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filepath = path_1.default.join(__dirname, 'migrations', filename);
    const template = `-- OneKey KYC API Migration
-- Migration: ${filename}
-- Description: ${name}

-- Add your SQL statements here

-- Update migration record
INSERT INTO schema_migrations (version, applied_at) VALUES ('${version}', NOW())
ON CONFLICT (version) DO NOTHING;
`;
    fs_1.default.writeFileSync(filepath, template);
    console.log(`📄 Created migration file: ${filename}`);
    return filepath;
};
exports.createMigration = createMigration;
// Rollback functions (for development)
const rollbackMigration = async (version) => {
    console.log(`⏪ Rolling back migration ${version}...`);
    try {
        // Remove from schema_migrations table
        await (0, database_1.query)('DELETE FROM schema_migrations WHERE version = $1', [version]);
        console.log(`✅ Migration ${version} rolled back (removed from tracking)`);
        console.log('⚠️  Note: This only removes the migration tracking. Manual cleanup may be required.');
    }
    catch (error) {
        console.error(`❌ Failed to rollback migration ${version}:`, error);
        throw error;
    }
};
exports.rollbackMigration = rollbackMigration;
const resetDatabase = async () => {
    console.log('🗑️  Resetting database (dropping all tables)...');
    try {
        // Get list of all tables
        const tablesResult = await (0, database_1.query)(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename != 'schema_migrations'
    `);
        // Drop all tables
        for (const row of tablesResult.rows) {
            await (0, database_1.query)(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`);
            console.log(`🗑️  Dropped table: ${row.tablename}`);
        }
        // Clear migration history
        await (0, database_1.query)('DELETE FROM schema_migrations');
        console.log('✅ Database reset complete');
    }
    catch (error) {
        console.error('❌ Database reset failed:', error);
        throw error;
    }
};
exports.resetDatabase = resetDatabase;
//# sourceMappingURL=migrator.js.map