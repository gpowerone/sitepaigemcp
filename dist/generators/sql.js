import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./utils.js";
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Sanitizes a table name by converting to lowercase and replacing spaces with underscores
 * @param name The raw table name
 * @returns The sanitized table name
 */
function sanitizeTableName(name) {
    return name.toLowerCase().replace(/\s+/g, '_');
}
export async function writeModelsSql(targetDir, blueprint, databaseType = "postgres") {
    const migrationsDir = path.join(targetDir, "migrations");
    ensureDir(migrationsDir);
    const basePath = path.join(migrationsDir, "000_base.sql");
    if (fs.existsSync(basePath))
        return; // Only once
    const models = blueprint.models || [];
    const lines = ["-- Base schema generated from blueprint.models"];
    // Write DATABASE_SETUP.md when we write migrations
    const dbSetupPath = path.join(targetDir, "DATABASE_SETUP.md");
    if (!fs.existsSync(dbSetupPath)) {
        try {
            const dbReadmeTemplate = await fsp.readFile(path.join(__dirname, "database-readme-template.md"), "utf8");
            await fsp.writeFile(dbSetupPath, dbReadmeTemplate, "utf8");
        }
        catch (err) {
            console.error("Warning: Could not write DATABASE_SETUP.md:", err);
        }
    }
    // Database-specific type mappings
    const typeMap = {
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
    // Add auth tables at the beginning
    lines.push("\n-- Authentication and session management tables");
    // Migrations table
    lines.push(`\n-- Migrations tracking table`);
    if (databaseType === 'sqlite') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}migrations${quoteChar} (`, `  ${quoteChar}id${quoteChar} INTEGER PRIMARY KEY AUTOINCREMENT,`, `  ${quoteChar}filename${quoteChar} TEXT UNIQUE NOT NULL,`, `  ${quoteChar}executed_at${quoteChar} TEXT DEFAULT CURRENT_TIMESTAMP`, `);`);
    }
    else if (databaseType === 'postgres') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}migrations${quoteChar} (`, `  ${quoteChar}id${quoteChar} SERIAL PRIMARY KEY,`, `  ${quoteChar}filename${quoteChar} VARCHAR(255) UNIQUE NOT NULL,`, `  ${quoteChar}executed_at${quoteChar} TIMESTAMP DEFAULT NOW()`, `);`);
    }
    else if (databaseType === 'mysql') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}migrations${quoteChar} (`, `  ${quoteChar}id${quoteChar} INT AUTO_INCREMENT PRIMARY KEY,`, `  ${quoteChar}filename${quoteChar} VARCHAR(255) UNIQUE NOT NULL,`, `  ${quoteChar}executed_at${quoteChar} TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, `);`);
    }
    // Users table
    lines.push(`\n-- Users table (required for authentication)`);
    if (databaseType === 'sqlite') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}users${quoteChar} (`, `  ${quoteChar}userid${quoteChar} TEXT PRIMARY KEY,`, `  ${quoteChar}oauthid${quoteChar} TEXT NOT NULL UNIQUE,`, `  ${quoteChar}source${quoteChar} TEXT NOT NULL CHECK(${quoteChar}source${quoteChar} IN ('google', 'facebook', 'apple', 'github', 'userpass')),`, `  ${quoteChar}username${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}email${quoteChar} TEXT,`, `  ${quoteChar}avatarurl${quoteChar} TEXT,`, `  ${quoteChar}userlevel${quoteChar} INTEGER NOT NULL DEFAULT 1 CHECK(${quoteChar}userlevel${quoteChar} IN (0, 1, 2)),`, `  ${quoteChar}usertier${quoteChar} INTEGER NOT NULL DEFAULT 0,`, `  ${quoteChar}lastlogindate${quoteChar} TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}createddate${quoteChar} TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}isactive${quoteChar} INTEGER NOT NULL DEFAULT 1`, `);`);
    }
    else if (databaseType === 'postgres') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}users${quoteChar} (`, `  ${quoteChar}userid${quoteChar} UUID PRIMARY KEY,`, `  ${quoteChar}oauthid${quoteChar} TEXT NOT NULL UNIQUE,`, `  ${quoteChar}source${quoteChar} TEXT NOT NULL CHECK(${quoteChar}source${quoteChar} IN ('google', 'facebook', 'apple', 'github', 'userpass')),`, `  ${quoteChar}username${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}email${quoteChar} TEXT,`, `  ${quoteChar}avatarurl${quoteChar} TEXT,`, `  ${quoteChar}userlevel${quoteChar} INTEGER NOT NULL DEFAULT 1 CHECK(${quoteChar}userlevel${quoteChar} IN (0, 1, 2)),`, `  ${quoteChar}usertier${quoteChar} INTEGER NOT NULL DEFAULT 0,`, `  ${quoteChar}lastlogindate${quoteChar} TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}createddate${quoteChar} TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}isactive${quoteChar} INTEGER NOT NULL DEFAULT 1`, `);`);
    }
    else if (databaseType === 'mysql') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}users${quoteChar} (`, `  ${quoteChar}userid${quoteChar} VARCHAR(36) PRIMARY KEY,`, `  ${quoteChar}oauthid${quoteChar} VARCHAR(255) NOT NULL UNIQUE,`, `  ${quoteChar}source${quoteChar} VARCHAR(20) NOT NULL CHECK(${quoteChar}source${quoteChar} IN ('google', 'facebook', 'apple', 'github', 'userpass')),`, `  ${quoteChar}username${quoteChar} VARCHAR(255) NOT NULL,`, `  ${quoteChar}email${quoteChar} VARCHAR(255),`, `  ${quoteChar}avatarurl${quoteChar} TEXT,`, `  ${quoteChar}userlevel${quoteChar} INT NOT NULL DEFAULT 1 CHECK(${quoteChar}userlevel${quoteChar} IN (0, 1, 2)),`, `  ${quoteChar}usertier${quoteChar} INT NOT NULL DEFAULT 0,`, `  ${quoteChar}lastlogindate${quoteChar} TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}createddate${quoteChar} TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}isactive${quoteChar} TINYINT NOT NULL DEFAULT 1`, `);`);
    }
    // Indexes for Users table
    lines.push(`\n-- Indexes for Users table`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_users_oauthid ON ${quoteChar}users${quoteChar}(${quoteChar}oauthid${quoteChar});`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_users_email ON ${quoteChar}users${quoteChar}(${quoteChar}email${quoteChar});`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_users_usertier ON ${quoteChar}users${quoteChar}(${quoteChar}usertier${quoteChar});`);
    // UserSession table
    lines.push(`\n-- UserSession table`);
    if (databaseType === 'sqlite') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}usersession${quoteChar} (`, `  ${quoteChar}id${quoteChar} TEXT PRIMARY KEY,`, `  ${quoteChar}sessiontoken${quoteChar} TEXT NOT NULL UNIQUE,`, `  ${quoteChar}userid${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}expirationdate${quoteChar} TEXT NOT NULL,`, `  FOREIGN KEY (${quoteChar}userid${quoteChar}) REFERENCES ${quoteChar}users${quoteChar}(${quoteChar}userid${quoteChar}) ON DELETE CASCADE`, `);`);
    }
    else if (databaseType === 'postgres') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}usersession${quoteChar} (`, `  ${quoteChar}id${quoteChar} UUID PRIMARY KEY,`, `  ${quoteChar}sessiontoken${quoteChar} TEXT NOT NULL UNIQUE,`, `  ${quoteChar}userid${quoteChar} UUID NOT NULL,`, `  ${quoteChar}expirationdate${quoteChar} TEXT NOT NULL,`, `  FOREIGN KEY (${quoteChar}userid${quoteChar}) REFERENCES ${quoteChar}users${quoteChar}(${quoteChar}userid${quoteChar}) ON DELETE CASCADE`, `);`);
    }
    else if (databaseType === 'mysql') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}usersession${quoteChar} (`, `  ${quoteChar}id${quoteChar} VARCHAR(36) PRIMARY KEY,`, `  ${quoteChar}sessiontoken${quoteChar} VARCHAR(255) NOT NULL UNIQUE,`, `  ${quoteChar}userid${quoteChar} VARCHAR(36) NOT NULL,`, `  ${quoteChar}expirationdate${quoteChar} VARCHAR(255) NOT NULL,`, `  FOREIGN KEY (${quoteChar}userid${quoteChar}) REFERENCES ${quoteChar}users${quoteChar}(${quoteChar}userid${quoteChar}) ON DELETE CASCADE`, `);`);
    }
    // Indexes for UserSession table
    lines.push(`\n-- Indexes for UserSession table`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_session_token ON ${quoteChar}usersession${quoteChar}(${quoteChar}sessiontoken${quoteChar});`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_session_user ON ${quoteChar}usersession${quoteChar}(${quoteChar}userid${quoteChar});`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_session_expiry ON ${quoteChar}usersession${quoteChar}(${quoteChar}expirationdate${quoteChar});`);
    // OAuthTokens table
    lines.push(`\n-- OAuthTokens table`);
    if (databaseType === 'sqlite') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}oauthtokens${quoteChar} (`, `  ${quoteChar}id${quoteChar} TEXT PRIMARY KEY,`, `  ${quoteChar}userid${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}provider${quoteChar} TEXT NOT NULL CHECK(${quoteChar}provider${quoteChar} IN ('google', 'facebook', 'apple', 'github', 'userpass')),`, `  ${quoteChar}accesstoken${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}refreshtoken${quoteChar} TEXT,`, `  ${quoteChar}expiresat${quoteChar} TEXT,`, `  ${quoteChar}createdat${quoteChar} TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}updatedat${quoteChar} TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  FOREIGN KEY (${quoteChar}userid${quoteChar}) REFERENCES ${quoteChar}users${quoteChar}(${quoteChar}userid${quoteChar}) ON DELETE CASCADE`, `);`);
    }
    else if (databaseType === 'postgres') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}oauthtokens${quoteChar} (`, `  ${quoteChar}id${quoteChar} UUID PRIMARY KEY,`, `  ${quoteChar}userid${quoteChar} UUID NOT NULL,`, `  ${quoteChar}provider${quoteChar} TEXT NOT NULL CHECK(${quoteChar}provider${quoteChar} IN ('google', 'facebook', 'apple', 'github', 'userpass')),`, `  ${quoteChar}accesstoken${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}refreshtoken${quoteChar} TEXT,`, `  ${quoteChar}expiresat${quoteChar} TEXT,`, `  ${quoteChar}createdat${quoteChar} TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}updatedat${quoteChar} TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  FOREIGN KEY (${quoteChar}userid${quoteChar}) REFERENCES ${quoteChar}users${quoteChar}(${quoteChar}userid${quoteChar}) ON DELETE CASCADE`, `);`);
    }
    else if (databaseType === 'mysql') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}oauthtokens${quoteChar} (`, `  ${quoteChar}id${quoteChar} VARCHAR(36) PRIMARY KEY,`, `  ${quoteChar}userid${quoteChar} VARCHAR(36) NOT NULL,`, `  ${quoteChar}provider${quoteChar} VARCHAR(20) NOT NULL CHECK(${quoteChar}provider${quoteChar} IN ('google', 'facebook', 'apple', 'github', 'userpass')),`, `  ${quoteChar}accesstoken${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}refreshtoken${quoteChar} TEXT,`, `  ${quoteChar}expiresat${quoteChar} VARCHAR(255),`, `  ${quoteChar}createdat${quoteChar} TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}updatedat${quoteChar} TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  FOREIGN KEY (${quoteChar}userid${quoteChar}) REFERENCES ${quoteChar}users${quoteChar}(${quoteChar}userid${quoteChar}) ON DELETE CASCADE`, `);`);
    }
    // Indexes for OAuthTokens table
    lines.push(`\n-- Indexes for OAuthTokens table`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_oauth_user ON ${quoteChar}oauthtokens${quoteChar}(${quoteChar}userid${quoteChar});`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_oauth_provider ON ${quoteChar}oauthtokens${quoteChar}(${quoteChar}userid${quoteChar}, ${quoteChar}provider${quoteChar});`);
    for (const model of models) {
        const tableName = sanitizeTableName(model.name || model.id || "table");
        lines.push(`\n-- Model: ${tableName}`);
        const fieldDefs = [];
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
    // Add PasswordAuth table for username/password authentication
    lines.push(`\n-- PasswordAuth table for username/password authentication`);
    const passwordAuthTable = [];
    if (databaseType === 'sqlite') {
        passwordAuthTable.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}passwordauth${quoteChar} (`, `  ${quoteChar}id${quoteChar} TEXT PRIMARY KEY,`, `  ${quoteChar}email${quoteChar} TEXT NOT NULL UNIQUE,`, `  ${quoteChar}passwordhash${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}salt${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}verificationtoken${quoteChar} TEXT,`, `  ${quoteChar}verificationtokenexpires${quoteChar} TEXT,`, `  ${quoteChar}emailverified${quoteChar} INTEGER DEFAULT 0,`, `  ${quoteChar}resettoken${quoteChar} TEXT,`, `  ${quoteChar}resettokenexpires${quoteChar} TEXT,`, `  ${quoteChar}createdat${quoteChar} TEXT DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}updatedat${quoteChar} TEXT DEFAULT CURRENT_TIMESTAMP`, `);`);
    }
    else if (databaseType === 'postgres') {
        passwordAuthTable.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}passwordauth${quoteChar} (`, `  ${quoteChar}id${quoteChar} UUID PRIMARY KEY,`, `  ${quoteChar}email${quoteChar} VARCHAR(255) NOT NULL UNIQUE,`, `  ${quoteChar}passwordhash${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}salt${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}verificationtoken${quoteChar} TEXT,`, `  ${quoteChar}verificationtokenexpires${quoteChar} TIMESTAMP,`, `  ${quoteChar}emailverified${quoteChar} BOOLEAN DEFAULT FALSE,`, `  ${quoteChar}resettoken${quoteChar} TEXT,`, `  ${quoteChar}resettokenexpires${quoteChar} TIMESTAMP,`, `  ${quoteChar}createdat${quoteChar} TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}updatedat${quoteChar} TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, `);`);
    }
    else if (databaseType === 'mysql') {
        passwordAuthTable.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}passwordauth${quoteChar} (`, `  ${quoteChar}id${quoteChar} VARCHAR(36) PRIMARY KEY,`, `  ${quoteChar}email${quoteChar} VARCHAR(255) NOT NULL UNIQUE,`, `  ${quoteChar}passwordhash${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}salt${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}verificationtoken${quoteChar} TEXT,`, `  ${quoteChar}verificationtokenexpires${quoteChar} DATETIME,`, `  ${quoteChar}emailverified${quoteChar} BOOLEAN DEFAULT FALSE,`, `  ${quoteChar}resettoken${quoteChar} TEXT,`, `  ${quoteChar}resettokenexpires${quoteChar} DATETIME,`, `  ${quoteChar}createdat${quoteChar} DATETIME DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}updatedat${quoteChar} DATETIME DEFAULT CURRENT_TIMESTAMP`, `);`);
    }
    lines.push(...passwordAuthTable);
    // Add indexes for PasswordAuth
    lines.push(`\n-- Indexes for PasswordAuth`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_passwordauth_email ON ${quoteChar}passwordauth${quoteChar}(${quoteChar}email${quoteChar});`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_passwordauth_verification_token ON ${quoteChar}passwordauth${quoteChar}(${quoteChar}verificationtoken${quoteChar});`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_passwordauth_reset_token ON ${quoteChar}passwordauth${quoteChar}(${quoteChar}resettoken${quoteChar});`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_passwordauth_email_verified ON ${quoteChar}passwordauth${quoteChar}(${quoteChar}emailverified${quoteChar});`);
    // Add FormSubmissions table for storing form data
    lines.push(`\n-- FormSubmissions table for storing form data`);
    if (databaseType === 'sqlite') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}form_submissions${quoteChar} (`, `  ${quoteChar}id${quoteChar} INTEGER PRIMARY KEY AUTOINCREMENT,`, `  ${quoteChar}timestamp${quoteChar} TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}form_name${quoteChar} TEXT NOT NULL,`, `  ${quoteChar}form_data${quoteChar} TEXT NOT NULL`, `);`);
    }
    else if (databaseType === 'postgres') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}form_submissions${quoteChar} (`, `  ${quoteChar}id${quoteChar} SERIAL PRIMARY KEY,`, `  ${quoteChar}timestamp${quoteChar} TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}form_name${quoteChar} VARCHAR(255) NOT NULL,`, `  ${quoteChar}form_data${quoteChar} JSONB NOT NULL`, `);`);
    }
    else if (databaseType === 'mysql') {
        lines.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}form_submissions${quoteChar} (`, `  ${quoteChar}id${quoteChar} INT AUTO_INCREMENT PRIMARY KEY,`, `  ${quoteChar}timestamp${quoteChar} TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,`, `  ${quoteChar}form_name${quoteChar} VARCHAR(255) NOT NULL,`, `  ${quoteChar}form_data${quoteChar} JSON NOT NULL`, `);`);
    }
    // Add indexes for FormSubmissions
    lines.push(`\n-- Indexes for FormSubmissions`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_form_submissions_name ON ${quoteChar}form_submissions${quoteChar}(${quoteChar}form_name${quoteChar});`);
    lines.push(`CREATE INDEX IF NOT EXISTS idx_form_submissions_timestamp ON ${quoteChar}form_submissions${quoteChar}(${quoteChar}timestamp${quoteChar});`);
    lines.push("");
    await fsp.writeFile(basePath, lines.join("\n"), "utf8");
}
export function generateSQLFromMigrations(migrations, databaseType = "postgres") {
    // Database-specific type mappings
    const typeMap = {
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
    const sql = [];
    for (const m of migrations) {
        const action = m.action;
        const modelName = sanitizeTableName(m.modelName || m.modelId || "");
        if (action === "create") {
            const modelChange = m.changes.find((c) => c.type === "model" && c.operation === "add");
            const model = (modelChange?.newValue ?? { name: modelName });
            const fieldAdds = m.changes.filter((c) => c.type === "field" && c.operation === "add");
            const fieldDefs = fieldAdds.map((c) => {
                const f = c.newValue;
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
            sql.push(`CREATE TABLE IF NOT EXISTS ${quoteChar}${sanitizeTableName(model.name || modelName)}${quoteChar} (\n${fieldDefs.join(",\n")}\n);`);
            continue;
        }
        if (action === "delete") {
            sql.push(`DROP TABLE IF EXISTS ${quoteChar}${modelName}${quoteChar};`);
            continue;
        }
        if (action === "update") {
            for (const c of m.changes) {
                if (c.type !== "field")
                    continue;
                if (c.operation === "add") {
                    const f = c.newValue;
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
                    }
                    else {
                        sql.push(`ALTER TABLE ${quoteChar}${modelName}${quoteChar} ADD COLUMN ${quoteChar}${f.name.toLowerCase()}${quoteChar} ${mappedType}${required};`);
                    }
                }
                else if (c.operation === "remove" && c.field) {
                    // SQLite doesn't support DROP COLUMN before version 3.35.0
                    if (databaseType === 'sqlite') {
                        sql.push(`-- WARNING: SQLite doesn't support DROP COLUMN. Manual migration required for: ${quoteChar}${modelName}${quoteChar}.${quoteChar}${c.field.toLowerCase()}${quoteChar}`);
                    }
                    else {
                        sql.push(`ALTER TABLE ${quoteChar}${modelName}${quoteChar} DROP COLUMN ${quoteChar}${c.field.toLowerCase()}${quoteChar};`);
                    }
                }
                else if (c.operation === "modify") {
                    const f = c.newValue;
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
                    }
                    else if (databaseType === 'mysql') {
                        // MySQL uses MODIFY syntax
                        sql.push(`ALTER TABLE ${quoteChar}${modelName}${quoteChar} MODIFY COLUMN ${quoteChar}${(f.name || c.field || "col").toLowerCase()}${quoteChar} ${mappedType};`);
                    }
                    else {
                        // PostgreSQL uses ALTER COLUMN TYPE
                        sql.push(`ALTER TABLE ${quoteChar}${modelName}${quoteChar} ALTER COLUMN ${quoteChar}${(f.name || c.field || "col").toLowerCase()}${quoteChar} TYPE ${mappedType};`);
                    }
                }
            }
        }
    }
    return sql;
}
export async function writeIncrementalMigrations(targetDir, blueprint, databaseType = "sqlite") {
    const migrations = blueprint.migrations || [];
    if (!migrations.length)
        return;
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
//# sourceMappingURL=sql.js.map