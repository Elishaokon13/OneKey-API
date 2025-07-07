import fs from 'fs';
import path from 'path';
import { knex } from '../config/database';
import { isSupabaseConfigured } from '../config/supabase';

interface Migration {
  version: string;
  filename: string;
  content: string;
}

// Get all migration files
const getMigrationFiles = (): Migration[] => {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('📁 Creating migrations directory...');
    fs.mkdirSync(migrationsDir, { recursive: true });
    return [];
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure proper order
  
  return files.map(filename => {
    const versionPart = filename.split('_')[0];
    if (!versionPart) {
      throw new Error(`Invalid migration filename format: ${filename}. Expected format: 001_description.sql`);
    }
    
    const content = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
    
    return {
      version: versionPart,
      filename,
      content
    };
  });
};

// Check if migration has been applied
const isMigrationApplied = async (version: string): Promise<boolean> => {
  try {
    // Create schema_migrations table if it doesn't exist
    await knex.schema.createTableIfNotExists('schema_migrations', table => {
      table.string('version').primary();
      table.timestamp('applied_at').defaultTo(knex.fn.now());
    });

    const result = await knex('schema_migrations')
      .where({ version })
      .first();
    return !!result;
  } catch (error) {
    // If schema_migrations table doesn't exist, no migrations have been applied
    return false;
  }
};

// Apply a single migration
const applyMigration = async (migration: Migration): Promise<void> => {
  console.log(`📄 Applying migration ${migration.version}: ${migration.filename}`);
  
  try {
    // Execute the migration SQL
    await knex.raw(migration.content);
    console.log(`✅ Migration ${migration.version} applied successfully`);
  } catch (error) {
    console.error(`❌ Failed to apply migration ${migration.version}:`, error);
    throw error;
  }
};

// Run all pending migrations
export const runMigrations = async (): Promise<void> => {
  console.log('🔄 Starting database migrations...');
  
  // Skip migrations when using Supabase (tables already exist)
  if (isSupabaseConfigured()) {
    console.log('⏭️  Skipping migrations (Supabase mode - tables already exist)');
    console.log('✅ Database schema is managed by Supabase');
    return;
  }
  
  try {
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
    } else {
      console.log(`✅ Applied ${appliedCount} new migration(s)`);
    }
    
    // Show current schema version
    const latestMigration = migrations[migrations.length - 1];
    if (latestMigration) {
      console.log(`📌 Current schema version: ${latestMigration.version}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Get migration status
export const getMigrationStatus = async (): Promise<{
  appliedMigrations: string[];
  pendingMigrations: string[];
  totalMigrations: number;
}> => {
  const migrations = getMigrationFiles();
  const appliedMigrations: string[] = [];
  const pendingMigrations: string[] = [];
  
  for (const migration of migrations) {
    const isApplied = await isMigrationApplied(migration.version);
    
    if (isApplied) {
      appliedMigrations.push(migration.version);
    } else {
      pendingMigrations.push(migration.version);
    }
  }
  
  return {
    appliedMigrations,
    pendingMigrations,
    totalMigrations: migrations.length
  };
};

// Create a new migration file template
export const createMigration = (name: string): string => {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
  const version = timestamp.substring(2, 8); // YYMMDD format
  const filename = `${version}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
  const filepath = path.join(__dirname, 'migrations', filename);
  
  const template = `-- OneKey KYC API Migration
-- Migration: ${filename}
-- Description: ${name}

-- Add your SQL statements here

-- Update migration record
INSERT INTO schema_migrations (version, applied_at) VALUES ('${version}', NOW())
ON CONFLICT (version) DO NOTHING;
`;
  
  fs.writeFileSync(filepath, template);
  console.log(`📄 Created migration file: ${filename}`);
  
  return filepath;
};

// Rollback functions (for development)
export const rollbackMigration = async (version: string): Promise<void> => {
  console.log(`⏪ Rolling back migration ${version}...`);
  
  try {
    // Remove from schema_migrations table
    await knex('schema_migrations')
      .where({ version })
      .delete();
    
    console.log(`✅ Migration ${version} rolled back (removed from tracking)`);
    console.log('⚠️  Note: This only removes the migration tracking. Manual cleanup may be required.');
    
  } catch (error) {
    console.error(`❌ Failed to rollback migration ${version}:`, error);
    throw error;
  }
};

export const resetDatabase = async (): Promise<void> => {
  console.log('🗑️  Resetting database (dropping all tables)...');
  
  try {
    // Get list of all tables
    const tables = await knex('pg_tables')
      .select('tablename')
      .where('schemaname', 'public')
      .whereNot('tablename', 'schema_migrations');
    
    // Drop all tables
    for (const { tablename } of tables) {
      await knex.raw(`DROP TABLE IF EXISTS ${tablename} CASCADE`);
      console.log(`🗑️  Dropped table: ${tablename}`);
    }
    
    // Clear migration history
    await knex('schema_migrations').delete();
    
    console.log('✅ Database reset complete');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  }
};

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
} 