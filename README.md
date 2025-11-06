# SitePaige MCP Installation Guide

Quickly transform your ideas into web applications with Sitepaige. Generate sites in two steps:

## Step 1: Frontend Generation (FREE for first project, then 12 credits)
- **Next.js application** built with TypeScript 
- **Responsive UI** with intelligent prompts that guide you to complete your frontend vision
- **Seamless authentication system** powered by OAuth - your users can sign in with one click
- **All frontend components, pages, and views** ready to use

## Step 2: Backend Completion (FREE)
- **Production-ready database architecture** (PostgreSQL, SQLite, or MySQL) - simple environment configuration
- **RESTful API endpoints** with complete input/output schemas and step-by-step implementation guidance
- **Comprehensive [ARCHITECTURE.md](EXAMPLE_ARCHITECTURE.md) documentation** that maps out your entire codebase for your coding agent to finish the site - no guesswork required
- **SQL models and migrations** ready for production
- **Environment configuration template** (`.env.example`) with all database options pre-configured

## Prerequisites

- Node.js version 18.17 or higher
- npm or yarn package manager
- An MCP-compatible client (e.g., Claude Desktop, Cline, or other MCP clients)
- SitePaige API key from https://sitepaige.com

## Installation Methods

### Install from NPM (Recommended)

The easiest way to install the SitePaige MCP server is via NPM:

```bash
# Global installation (recommended)
npm install -g sitepaige-mcp-server

# Or install locally in your project
npm install sitepaige-mcp-server
```

### Install from Source

1. Clone the repository:
```bash
git clone https://github.com/gpowerone/sitepaigemcp/sitepaigemcp.git
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### Setting up with Claude Desktop

1. Open your Claude Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Add the SitePaige MCP server to the `mcpServers` section:

#### For NPM Installation:
```json
{
  "mcpServers": {
    "sitepaige": {
      "command": "npx",
      "args": ["sitepaige-mcp-server"],
      "env": {
        "SITEPAIGE_API_KEY": "your-api-key-here",
        "SITEPAIGE_ALLOWED_ROOTS": "/Users/yourusername/Projects"
      }
    }
  }
}
```

#### For Source Installation:
```json
{
  "mcpServers": {
    "sitepaige": {
      "command": "node",
      "args": ["/absolute/path/to/sitepaige-mcp-server/dist/index.js"],
      "env": {
        "SITEPAIGE_API_KEY": "your-api-key-here",
        "SITEPAIGE_ALLOWED_ROOTS": "/Users/yourusername/Projects"
      }
    }
  }
}
```

### Setting up with Other MCP Clients

Refer to your MCP client's documentation for specific configuration steps. The key parameters are:

#### For NPM Installation:
- **Command**: `npx sitepaige-mcp-server` 
- **Type**: stdio
- **Environment Variables**: See below

#### For Source Installation:
- **Command**: `node /path/to/dist/index.js` 
- **Type**: stdio
- **Environment Variables**: See below

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SITEPAIGE_API_KEY` | No | API key for SitePaige API. |
| `SITEPAIGE_ALLOWED_ROOTS` | No | Comma-separated list of absolute paths where sites can be generated. Defaults to current working directory |
| `SITEPAIGE_DEBUG` | No | Enable debug logging. Set to `1`, `true`, `yes`, or `on` |

### Security Note

The `SITEPAIGE_ALLOWED_ROOTS` environment variable restricts where the MCP server can write files. Always set this to specific project directories to prevent unauthorized file system access.

Example with multiple allowed directories:
```
SITEPAIGE_ALLOWED_ROOTS="/Users/you/Projects,/Users/you/Sites,/tmp/sitepaige"
```

## Usage

Once configured, the SitePaige MCP server provides three main tools:

### 1. Generate Site (Frontend)

Generate the frontend of a web application from natural language prompts:

```
"Use sitepaige to generate a modern e-commerce website for selling handmade jewelry with product catalog, shopping cart, and checkout"
```

The tool will:
- Return immediately with a job ID and project ID
- Generate the complete site asynchronously (typically takes 8-10 minutes)
- Automatically write all files when generation is complete
- **Cost**: FREE for your first project, then credits based on your plan
- **Duration**: Takes approximately 8-10 minutes to complete

**Note**: This generates the complete web application including both frontend (pages, components, views, styles) and backend (models, APIs, database migrations)

### 2. Check Status

Monitor the progress of site generation using the job ID or project ID.
If a job has been completed but the files are not written, this function will write the files to disk. 
If you are stalled out, use 'check the status of sitepaige' to get the latest status

## Database Configuration

The generated sites support PostgreSQL, MySQL, and SQLite databases. Here's how to configure PostgreSQL for your generated application:

### Setting Up PostgreSQL Environment Variables

After your site is generated, you'll need to configure the database connection. The generated site includes a `.env.example` file with all available options.

1. **Copy the environment file**:
   ```bash
   cd /path/to/your/generated/site
   cp .env.example .env
   ```

2. **Configure PostgreSQL**:
   ```env
   DATABASE_TYPE=postgres
   DB_HOST=localhost      # Default: localhost
   DB_PORT=5432           # Default: 5432
   DB_USER=postgres       # Default: postgres
   DB_PASSWORD=yourpassword  # Required - no default
   DB_NAME=app            # Default: app
   ```
   
   **Important Notes**: 
   - The implementation uses only the generic `DB_*` variables
   - `DB_PASSWORD` is required and has no default value
   - Do not use `POSTGRES_*` or `DATABASE_URL` variables - they are not used by the implementation

3. **SSL Configuration**:
   - PostgreSQL: SSL is always enabled with `rejectUnauthorized: false` (accepts self-signed certificates)
   - MySQL: No SSL configuration by default

4. **Run database migrations**:
   ```bash
   npm run migrate
   ```

### Alternative Database Options

**MySQL Configuration**:
```env
DATABASE_TYPE=mysql
DB_HOST=localhost      # Default: localhost
DB_PORT=3306          # Default: 3306
DB_USER=root          # Default: root
DB_PASSWORD=yourpassword  # Required - no default
DB_NAME=app           # Default: app
```
**Note**: MySQL uses only the generic `DB_*` variables. Do not use `MYSQL_*` or `DATABASE_URL` variables.

**SQLite Configuration** (Default - No setup required):
```env
DATABASE_TYPE=sqlite
DATABASE_URL=./data/app.db
# Or use SQLITE_DIR to specify the directory:
# SQLITE_DIR=./data
# SQLite creates the database file automatically
```

### Database Setup Requirements

Before running your generated site with PostgreSQL:

1. **Install PostgreSQL** if not already installed
2. **Create a database** for your application:
   ```sql
   CREATE DATABASE your_app_name;
   ```
3. **Create a user** (optional, if not using default postgres user):
   ```sql
   CREATE USER your_username WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE your_app_name TO your_username;
   ```

## Example Workflow

Here's a typical workflow for generating a complete site:

1. **Generate the complete site**:
   ```
   "Use sitepaige to create a task management app with user authentication in /Users/me/projects/taskapp"
   ```
   This returns a job ID and project ID, and starts the complete site generation (frontend + backend).

2. **Check status** (optional):
   ```
   "Check the status of the sitepaige generation"
   ```
   
3. **Configure the database**:
   - Navigate to the generated site directory
   - Copy `.env.example` to `.env`
   - Configure your database settings (see Database Configuration section above)
   
4. **Start developing**:
   - Complete site (frontend + backend) is ready after generation completes (8-10 minutes)
   - Run `npm run migrate` to set up the database
   - Use the generated ARCHITECTURE.md as a guide

## Troubleshooting

### Common Issues

1. **"Insufficient credits" error**
   - Sign up for a SitePaige API key at https://sitepaige.com
   - Add the API key to your environment configuration
   - Purchase credits, if needed

2. **API "401 Unauthorized Error" Error**
   - Verify your API key is correctly set in the environment
   - Ensure the API key is active and not expired
   - Try regenerating a new API key if the current one is not working

3. **"Permission denied" when writing files**
   - Ensure the target directory is within `SITEPAIGE_ALLOWED_ROOTS`
   - Check that the directory exists and you have write permissions

4. **Database connection errors**
   - For PostgreSQL: Ensure the database service is running (`pg_ctl status` or `systemctl status postgresql`)
   - Verify the connection details (default PostgreSQL port is 5432)
   - Check that the database and user exist with proper permissions
   - For cloud databases, ensure SSL settings are configured correctly


## License

MIT License - see LICENSE file for details
