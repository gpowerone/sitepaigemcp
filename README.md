# SitePaige MCP Installation Guide

Quickly transform your ideas into web applications with Sitepaige. Every generated site comes fully equipped with:

- **Next.js application** built with TypeScript 
- **Production-ready database architecture** (SQLite, PostgreSQL, or MySQL) - no setup headaches
- **Seamless authentication system** powered by OAuth - your users can sign in with one click
- **Responsive UI** with intelligent prompts that guide you to complete your frontend vision
- **RESTful API endpoints** with complete input/output schemas and step-by-step implementation guidance
- **Comprehensive [ARCHITECTURE.md](EXAMPLE_ARCHITECTURE.md) documentation** that maps out your entire codebase for your coding agent to finish the site - no guesswork required

## Prerequisites

- Node.js version 18.17 or higher
- npm or yarn package manager
- An MCP-compatible client (e.g., Claude Desktop, Cline, or other MCP clients)
- SitePaige API key from https://sitepaige.com

## Installation Methods

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

Once configured, the SitePaige MCP server provides two main tools:

### 1. Generate Site

Generate a web application from natural language prompts:

```
First: "Use sitepaige to generate a modern e-commerce website for selling handmade jewelry with product catalog, shopping cart, and checkout"

Second: Build out all routes and views from the prompts provided in the code
```

The tool will:
- Return immediately with a job ID
- Generate the site asynchronously (typically takes 3-5 minutes)
- Automatically write files when generation is complete

### 2. Check Status

Monitor the progress of site generation using the project ID returned from `generate_site`.
If a job has been completed but the files are not written, then this function will write the files to disk. 
If you are stalled out, use 'check the status of sitepaige' to get the latest status

## Cost

- First project is free
- Additional projects cost 50 credits each. You can purchase credits via https://sitepaige.com

## Troubleshooting

### Common Issues

1. **"Insufficient credits" error**
   - Sign up for a SitePaige API key at https://sitepaige.com
   - Add the API key to your environment configuration

2. **API "401 Unauthorized Error" Error**
   - Verify your API key is correctly set in the environment
   - Ensure the API key is active and not expired
   - Try regenerating a new API key if the current one is not working

3. **"Permission denied" when writing files**
   - Ensure the target directory is within `SITEPAIGE_ALLOWED_ROOTS`
   - Check that the directory exists and you have write permissions


## License

MIT License - see LICENSE file for details
