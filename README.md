# SitePaige MCP Installation Guide

Quickly transform your ideas into web applications with Sitepaige. Generate sites in two steps:

## Step 1: Frontend Generation (FREE for first project, then 12 credits)
- **Next.js application** built with TypeScript 
- **Responsive UI** with intelligent prompts that guide you to complete your frontend vision
- **Seamless authentication system** powered by OAuth - your users can sign in with one click
- **All frontend components, pages, and views** ready to use

## Step 2: Backend Completion (FREE)
- **Production-ready database architecture** (PostgreSQL, SQLlite, or MySQL) - no setup headaches
- **RESTful API endpoints** with complete input/output schemas and step-by-step implementation guidance
- **Comprehensive [ARCHITECTURE.md](EXAMPLE_ARCHITECTURE.md) documentation** that maps out your entire codebase for your coding agent to finish the site - no guesswork required
- **SQL models and migrations** ready for production

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
- Generate the frontend asynchronously (typically takes 2-3 minutes)
- Automatically write frontend files when generation is complete
- **Cost**: FREE for your first project, then 12 credits

**Note**: This generates only the frontend (pages, components, views, styles). To add backend functionality, use `complete_backend`. Frontend will
require further generation after backend is completed

### 2. Complete Backend (Optional)

Add backend functionality to your generated site:

```
"Complete the backend for the project using the project ID from generate_site"
```

The tool will:
- Add database models and SQL migrations
- Generate API routes with full implementation
- Create comprehensive ARCHITECTURE.md documentation
- Preserve all frontend files (no overwrites)

### 3. Check Status

Monitor the progress of site generation using the job ID or project ID.
If a job has been completed but the files are not written, this function will write the files to disk. 
If you are stalled out, use 'check the status of sitepaige' to get the latest status

## Example Workflow

Here's a typical workflow for generating a complete site:

1. **Generate the frontend**:
   ```
   "Use sitepaige to create a task management app with user authentication in /Users/me/projects/taskapp"
   ```
   This returns a project ID (e.g., `proj_abc123`) and starts frontend generation.

2. **Check status** (optional):
   ```
   "Check the status of the sitepaige generation"
   ```
   
3. **Complete the backend** (after frontend is done):
   ```
   "Complete the backend for project proj_abc123"
   ```
   This adds database models, API routes, and full documentation.

4. **Start developing**:
   - Frontend is ready immediately after step 1
   - Full backend functionality available after step 3
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


## License

MIT License - see LICENSE file for details
