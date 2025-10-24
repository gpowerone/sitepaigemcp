import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./utils.js";
import { Blueprint, Model, ModelField, Migration } from "../types.js";
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function writeModelsSql(targetDir: string, blueprint: Blueprint, databaseType: "postgres" | "sqlite" | "mysql" = "postgres"): Promise<void> {
  const migrationsDir = path.join(targetDir, "migrations");
  ensureDir(migrationsDir);
  const basePath = path.join(migrationsDir, "000_base.sql");
  if (fs.existsSync(basePath)) return; // Only once

  const models = blueprint.models || [];
  const lines: string[] = ["-- Base schema generated from blueprint.models" ];
  
  // Write DATABASE_SETUP.md when we write migrations
  const dbSetupPath = path.join(targetDir, "DATABASE_SETUP.md");
  if (!fs.existsSync(dbSetupPath)) {
    try {
      const dbReadmeTemplate = await fsp.readFile(path.join(__dirname, "database-readme-template.md"), "utf8");
      await fsp.writeFile(dbSetupPath, dbReadmeTemplate, "utf8");
    } catch (err) {
      console.error("Warning: Could not write DATABASE_SETUP.md:", err);
    }
  }
  
  // Database-specific type mappings
  const typeMap: Record<string, Record<string, string>> = {
    sqlite: {
      'UUID': 'TEXT',
      'TINYINT': 'INTEGER',
      'SMALLINT': 'INTEGER',
      'BIGINT': 'INTEGER',
      'INT128': 'TEXT',
      'VARCHAR': 'TEXT',
      'TEXT': 'TEXT',
      'BINARY': 'BLOB',
      'DATE': 'TEXT',
      'TIME': 'TEXT',
      'DATETIME': 'TEXT',
      'DOUBLE': 'REAL',
      'FLOAT': 'REAL',
      'BOOLEAN': 'INTEGER'
    },
    postgres: {
      'UUID': 'UUID',
      'TINYINT': 'SMALLINT',
      'SMALLINT': 'SMALLINT',
      'BIGINT': 'BIGINT',
      'INT128': 'NUMERIC(39,0)',
      'VARCHAR': 'VARCHAR',
      'TEXT': 'TEXT',
      'BINARY': 'BYTEA',
      'DATE': 'DATE',
      'TIME': 'TIME',
      'DATETIME': 'TIMESTAMP',
      'DOUBLE': 'DOUBLE PRECISION',
      'FLOAT': 'REAL',
      'BOOLEAN': 'BOOLEAN'
    },
    mysql: {
      'UUID': 'VARCHAR(36)',
      'TINYINT': 'TINYINT',
      'SMALLINT': 'SMALLINT',
      'BIGINT': 'BIGINT',
      'INT128': 'DECIMAL(39,0)',
      'VARCHAR': 'VARCHAR',
      'TEXT': 'TEXT',
      'BINARY': 'BLOB',
      'DATE': 'DATE',
      'TIME': 'TIME',
      'DATETIME': 'DATETIME',
      'DOUBLE': 'DOUBLE',
      'FLOAT': 'FLOAT',
      'BOOLEAN': 'BOOLEAN'
    }
  };
  
  const dbTypeMap = typeMap[databaseType] || typeMap.sqlite;
  const quoteChar = databaseType === 'mysql' ? '`' : '"';
  
  for (const model of models) {
    const tableName = (model.name || model.id || "table").toLowerCase();
    lines.push(`\n-- Model: ${tableName}`);
    const fieldDefs: string[] = [];
    const fields = model.fields || [];

    for (const f of fields) {
      const name = (f.name || "col").toLowerCase();
      const dt = f.datatype.toUpperCase() || "TEXT";
      const size = f.datatypesize || "";
      const required = f.required.toLowerCase() === "true" ? " NOT NULL" : "";
      const pk = (f.key === "primary") ? " PRIMARY KEY" : "";
      
      let mappedType = dbTypeMap[dt] || dt;
      // Handle VARCHAR with size
      if (dt === 'VARCHAR' && size) {
        mappedType = `VARCHAR(${size})`;
      }
      
      fieldDefs.push(`  ${quoteChar}${name}${quoteChar} ${mappedType}${required}${pk}`);
    }

    if (model.data_is_user_specific.toLowerCase() === "true") {
      const userIdType = databaseType === 'mysql' ? 'VARCHAR(36)' : (databaseType === 'postgres' ? 'UUID' : 'TEXT');
      fieldDefs.push(`  ${quoteChar}userid${quoteChar} ${userIdType} NOT NULL`);
      fieldDefs.push(`  FOREIGN KEY (${quoteChar}userid${quoteChar}) REFERENCES ${quoteChar}users${quoteChar} (${quoteChar}userid${quoteChar})`);
    }

    const createSql = `CREATE TABLE IF NOT EXISTS ${quoteChar}${tableName}${quoteChar} (\n${fieldDefs.join(",\n")}\n);`;
    lines.push(createSql);
  }
  lines.push("");
  await fsp.writeFile(basePath, lines.join("\n"), "utf8");
}

export function generateSQLFromMigrations(migrations: Migration[], databaseType: "postgres" | "sqlite" | "mysql" = "postgres"): string[] {
  // Database-specific type mappings
  const typeMap: Record<string, Record<string, string>> = {
    sqlite: {
      'UUID': 'TEXT',
      'TINYINT': 'INTEGER',
      'SMALLINT': 'INTEGER',
      'BIGINT': 'INTEGER',
      'INT128': 'TEXT',
      'VARCHAR': 'TEXT',
      'TEXT': 'TEXT',
      'BINARY': 'BLOB',
      'DATE': 'TEXT',
      'TIME': 'TEXT',
      'DATETIME': 'TEXT',
      'DOUBLE': 'REAL',
      'FLOAT': 'REAL',
      'BOOLEAN': 'INTEGER'
    },
    postgres: {
      'UUID': 'UUID',
      'TINYINT': 'SMALLINT',
      'SMALLINT': 'SMALLINT',
      'BIGINT': 'BIGINT',
      'INT128': 'NUMERIC(39,0)',
      'VARCHAR': 'VARCHAR',
      'TEXT': 'TEXT',
      'BINARY': 'BYTEA',
      'DATE': 'DATE',
      'TIME': 'TIME',
      'DATETIME': 'TIMESTAMP',
      'DOUBLE': 'DOUBLE PRECISION',
      'FLOAT': 'REAL',
      'BOOLEAN': 'BOOLEAN'
    },
    mysql: {
      'UUID': 'VARCHAR(36)',
      'TINYINT': 'TINYINT',
      'SMALLINT': 'SMALLINT',
      'BIGINT': 'BIGINT',
      'INT128': 'DECIMAL(39,0)',
      'VARCHAR': 'VARCHAR',
      'TEXT': 'TEXT',
      'BINARY': 'BLOB',
      'DATE': 'DATE',
      'TIME': 'TIME',
      'DATETIME': 'DATETIME',
      'DOUBLE': 'DOUBLE',
      'FLOAT': 'FLOAT',
      'BOOLEAN': 'BOOLEAN'
    }
  };
  
  const dbTypeMap = typeMap[databaseType] || typeMap.sqlite;
  const quoteChar = databaseType === 'mysql' ? '`' : '"';
  
  const sql: string[] = [];
  for (const m of migrations) {
    const action = m.action;
    const modelName = (m.modelName || m.modelId || "").toLowerCase();
    if (action === "create") {
      const modelChange = m.changes.find((c) => c.type === "model" && c.operation === "add");
      const model = (modelChange?.newValue ?? { name: modelName }) as Model;
      const fieldAdds = m.changes.filter((c) => c.type === "field" && c.operation === "add");
      const fieldDefs: string[] = fieldAdds.map((c) => {
        const f = c.newValue as ModelField;
        const dt = f.datatype?.toUpperCase() || "TEXT";
        const size = f.datatypesize || "";
        
        let mappedType = dbTypeMap[dt] || dt;
        // Handle VARCHAR with size
        if (dt === 'VARCHAR' && size) {
          mappedType = `VARCHAR(${size})`;
        }
        
        const required = f.required.toLowerCase() === "true" ? " NOT NULL" : "";
        const pk = (f.key === "primary") ? " PRIMARY KEY" : "";
        return `  ${quoteChar}${f.name.toLowerCase()}${quoteChar} ${mappedType}${required}${pk}`;
      });
      sql.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}${(model.name || modelName).toLowerCase()}${quoteChar} (\n${fieldDefs.join(",\n")}\n);`);
      continue;
    }
    if (action === "delete") {
      sql.push(`DROP TABLE IF EXISTS ${quoteChar}${modelName}${quoteChar};`);
      continue;
    }
    if (action === "update") {
      for (const c of m.changes) {
        if (c.type !== "field") continue;
        if (c.operation === "add") {
          const f = c.newValue as ModelField;
          const dt = f.datatype?.toUpperCase() || "TEXT";
          const size = f.datatypesize || "";
          
          let mappedType = dbTypeMap[dt] || dt;
          // Handle VARCHAR with size
          if (dt === 'VARCHAR' && size) {
            mappedType = `VARCHAR(${size})`;
          }
          
          const required = f.required.toLowerCase() === "true" ? " NOT NULL" : "";
          
          // SQLite doesn't support ALTER COLUMN syntax, needs special handling
          if (databaseType === 'sqlite') {
            sql.push(`ALTER TABLE ${quoteChar}${modelName}${quoteChar} ADD COLUMN ${quoteChar}${f.name.toLowerCase()}${quoteChar} ${mappedType}${required};`);
          } else {
            sql.push(`ALTER TABLE ${quoteChar}${modelName}${quoteChar} ADD COLUMN ${quoteChar}${f.name.toLowerCase()}${quoteChar} ${mappedType}${required};`);
          }
        } else if (c.operation === "remove" && c.field) {
          // SQLite doesn't support DROP COLUMN before version 3.35.0
          if (databaseType === 'sqlite') {
            sql.push(`-- WARNING: SQLite doesn't support DROP COLUMN. Manual migration required for: ${quoteChar}${modelName}${quoteChar}.${quoteChar}${c.field.toLowerCase()}${quoteChar}`);
          } else {
            sql.push(`ALTER TABLE ${quoteChar}${modelName}${quoteChar} DROP COLUMN ${quoteChar}${c.field.toLowerCase()}${quoteChar};`);
          }
        } else if (c.operation === "modify") {
          const f = c.newValue as ModelField;
          const dt = f.datatype?.toUpperCase() || "TEXT";
          const size = f.datatypesize || "";
          
          let mappedType = dbTypeMap[dt] || dt;
          // Handle VARCHAR with size
          if (dt === 'VARCHAR' && size) {
            mappedType = `VARCHAR(${size})`;
          }
          
          // SQLite doesn't support ALTER COLUMN TYPE
          if (databaseType === 'sqlite') {
            sql.push(`-- WARNING: SQLite doesn't support ALTER COLUMN TYPE. Manual migration required for: ${quoteChar}${modelName}${quoteChar}.${quoteChar}${(f.name || c.field || "col").toLowerCase()}${quoteChar}`);
          } else if (databaseType === 'mysql') {
            // MySQL uses MODIFY syntax
            sql.push(`ALTER TABLE ${quoteChar}${modelName}${quoteChar} MODIFY COLUMN ${quoteChar}${(f.name || c.field || "col").toLowerCase()}${quoteChar} ${mappedType};`);
          } else {
            // PostgreSQL uses ALTER COLUMN TYPE
            sql.push(`ALTER TABLE ${quoteChar}${modelName}${quoteChar} ALTER COLUMN ${quoteChar}${(f.name || c.field || "col").toLowerCase()}${quoteChar} TYPE ${mappedType};`);
          }
        }
      }
    }
  }
  return sql;
}

export async function writeIncrementalMigrations(targetDir: string, blueprint: Blueprint, databaseType: "sqlite" | "postgres" | "mysql" = "sqlite"): Promise<void> {
  const migrations = blueprint.migrations || [];
  if (!migrations.length) return;
  const migrationsDir = path.join(targetDir, "migrations");
  ensureDir(migrationsDir);
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const file = path.join(migrationsDir, `migration-${timestamp}.sql`);
  const statements = generateSQLFromMigrations(migrations, databaseType);
  const content = [
    "-- Auto-generated migration file",
    `-- Generated at: ${new Date().toISOString()}`,
    "",
    ...statements
  ].join("\n");
  await fsp.writeFile(file, content, "utf8");
}


