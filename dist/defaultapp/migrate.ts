#!/usr/bin/env node
/*
Sitepaige v1.0.0
Database migration runner
This script initializes the database and runs all migrations
*/

import fs from 'fs';
import path from 'path';
import { db_init, db_query, getDatabaseConfig } from './db';

async function runMigrations() {
  console.log('🚀 Starting database migration...');
  
  try {
    // Get database configuration
    const config = getDatabaseConfig();
    
    if (config.type !== 'sqlite') {
      console.log(`⚠️  Migration runner currently only supports SQLite. Detected: ${config.type}`);
      console.log('Please run your database migrations manually.');
      return;
    }
    
    // Display database path for SQLite
    let dbPath: string;
    if (config.connectionString) {
      dbPath = config.connectionString.startsWith('sqlite://') 
        ? config.connectionString.slice(9) 
        : config.connectionString;
      console.log(`📁 Database location: ${dbPath} (from DATABASE_URL)`);
    } else if (config.efsMountPath) {
      dbPath = path.join(config.efsMountPath, 'data', 'app.db');
      console.log(`📁 Database location: ${dbPath} (from EFS_MOUNT_PATH)`);
    } else {
      dbPath = path.join(config.sqliteDir || '.', 'app.db');
      console.log(`📁 Database location: ${dbPath} (default: ${config.sqliteDir ? 'SQLITE_DIR' : 'current directory'})`);
    }
    
    // Initialize database connection
    const client = await db_init();
    
    // Create migrations tracking table if it doesn't exist
    await db_query(client, `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get list of applied migrations
    const appliedMigrations = await db_query(client, 'SELECT filename FROM migrations');
    const appliedSet = new Set(appliedMigrations.map(m => m.filename));
    
    // Read migrations directory
    const migrationsDir = path.join(process.cwd(), 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('📂 No migrations directory found. Creating it...');
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log('✅ Migrations directory created at:', migrationsDir);
      return;
    }
    
    // Get all SQL files from migrations directory
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order
    
    if (migrationFiles.length === 0) {
      console.log('📭 No migration files found in migrations directory.');
      return;
    }
    
    // Run each migration that hasn't been applied yet
    let migrationsRun = 0;
    
    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`⏭️  Skipping already applied migration: ${file}`);
        continue;
      }
      
      console.log(`🔄 Running migration: ${file}`);
      
      try {
        // Read migration file
        const migrationPath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Split by semicolons but handle them properly
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .map(s => s + ';'); // Add semicolon back
        
        // Execute each statement
        for (const statement of statements) {
          if (statement.trim()) {
            await db_query(client, statement);
          }
        }
        
        // Record that this migration has been applied
        await db_query(client, 'INSERT INTO migrations (filename) VALUES (?)', [file]);
        
        console.log(`✅ Applied migration: ${file}`);
        migrationsRun++;
        
      } catch (error) {
        console.error(`❌ Error applying migration ${file}:`, error);
        throw error;
      }
    }
    
    if (migrationsRun === 0) {
      console.log('✨ All migrations are already up to date!');
    } else {
      console.log(`✅ Successfully applied ${migrationsRun} migration(s)`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { runMigrations };
