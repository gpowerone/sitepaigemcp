import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./utils.js";

export async function writeNextConfig(targetDir: string): Promise<void> {
  const content = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    return [
      { source: '/files/:path*', destination: '/api/files/:path*' }
    ];
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
  output: 'standalone',
  productionBrowserSourceMaps: false,
};

export default nextConfig;
`;
  await fsp.writeFile(path.join(targetDir, "next.config.ts"), content, "utf8");
}

export async function writeBaseAppSkeleton(targetDir: string): Promise<void> {
  const appDir = path.join(targetDir, "src", "app");
  const publicDir = path.join(targetDir, "public");
  ensureDir(appDir);
  ensureDir(publicDir);

  // Tailwind + PostCSS configs
  const tailwindConfigPath = path.join(targetDir, "tailwind.config.js");
  if (!fs.existsSync(tailwindConfigPath)) {
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/views/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
    await fsp.writeFile(tailwindConfigPath, tailwindConfig, "utf8");
  }

  const postcssConfigPath = path.join(targetDir, "postcss.config.js");
  if (!fs.existsSync(postcssConfigPath)) {
    const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
    await fsp.writeFile(postcssConfigPath, postcssConfig, "utf8");
  }

  // Note: globals.css and layout.tsx are now provided by the defaultapp folder
  // so we don't create them here anymore
}


export async function writePackageJson(targetDir: string, projectName?: string, databaseType: "sqlite" | "postgres" | "mysql" = "sqlite"): Promise<void> {
  const pkgPath = path.join(targetDir, "package.json");
  let pkg: any = {};

  if (fs.existsSync(pkgPath)) {
    try {
      const existing = await fsp.readFile(pkgPath, "utf8");
      pkg = JSON.parse(existing);
    } catch {
      pkg = {};
    }
  }

  const safeName = (pkg.name ?? projectName ?? "sitepaige-app")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .slice(0, 64);

  pkg.name = safeName || "sitepaige-app";
  pkg.private = true;

  pkg.scripts = {
    ...(pkg.scripts ?? {}),
    dev: pkg.scripts?.dev ?? "npx tsx src/app/migrate.ts && next dev",
    build: pkg.scripts?.build ?? "next build",
    start: pkg.scripts?.start ?? "npx tsx src/app/migrate.ts && next start",
    migrate: pkg.scripts?.migrate ?? "npx tsx src/app/migrate.ts"
  };

  pkg.dependencies = {
    ...(pkg.dependencies ?? {}),
    next: pkg.dependencies?.next ?? "latest",
    react: pkg.dependencies?.react ?? "latest",
    "react-dom": pkg.dependencies?.["react-dom"] ?? "latest",
    "mime-types": pkg.dependencies?.["mime-types"] ?? "^3.0.0"
  };
  
  // Add database-specific dependencies
  switch (databaseType) {
    case "postgres":
      pkg.dependencies.pg = pkg.dependencies?.pg ?? "^8.11.3";
      break;
    case "mysql":
      pkg.dependencies.mysql2 = pkg.dependencies?.mysql2 ?? "^3.6.5";
      break;
    case "sqlite":
    default:
      pkg.dependencies["better-sqlite3"] = pkg.dependencies?.["better-sqlite3"] ?? "^9.2.2";
      break;
  }

  pkg.devDependencies = {
    ...(pkg.devDependencies ?? {}),
    typescript: pkg.devDependencies?.typescript ?? "latest",
    "@types/node": pkg.devDependencies?.["@types/node"] ?? "latest",
    "@types/react": pkg.devDependencies?.["@types/react"] ?? "latest",
    "@types/react-dom": pkg.devDependencies?.["@types/react-dom"] ?? "latest",
    "@types/mime-types": pkg.devDependencies?.["@types/mime-types"] ?? "^2.1.4",
    tailwindcss: pkg.devDependencies?.tailwindcss ?? "^3.4.1",
    postcss: pkg.devDependencies?.postcss ?? "latest",
    autoprefixer: pkg.devDependencies?.autoprefixer ?? "latest"
  };

  await fsp.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

