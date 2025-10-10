import fsp from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./utils.js";
import { Blueprint } from "../types.js";

// List of component files to copy from the components directory
const COMPONENT_FILES = [
  "admin.tsx",
  "adminmenu.tsx",
  "auth.tsx",
  "csrf-provider.tsx",
  "cta.tsx",
  "error.tsx",
  "form.tsx",
  "headerlogin.tsx",
  "IntegrationComponent.tsx",
  "loggedinmenu.tsx",
  "login.tsx",
  "logincallback.tsx",
  "map.tsx",
  "menu.tsx",
  "photogallery.tsx",
  "profile.tsx",
  "SecureContent.tsx",
  "slideshow.tsx",
  "socialbar.tsx",
  "testimonial.tsx",
  "upgrade.tsx",
  "videogallery.tsx",
  "wrapped_menu.tsx"
];

export async function writeComponents(targetDir: string, _blueprint: Blueprint): Promise<void> {
  const targetComponentsDir = path.join(targetDir, "src", "components");
  ensureDir(targetComponentsDir);

  const here = path.dirname(new URL(import.meta.url).pathname);
  
  // Determine where to find the bundled components
  const candidateComponentDirs = [
    // When running from built dist (dist/generators/components.js → dist/components)
    path.resolve(here, "../../components"),
    // When running with tsx from src (src/generators → ../../components)
    path.resolve(here, "../../../components"),
    // When running from development (cwd is repo root)
    path.resolve(process.cwd(), "components")
  ];

  // Find the components directory
  let sourceComponentsDir = "";
  for (const dir of candidateComponentDirs) {
    try {
      await fsp.access(dir);
      const stats = await fsp.stat(dir);
      if (stats.isDirectory()) {
        sourceComponentsDir = dir;
        break;
      }
    } catch {}
  }

  if (!sourceComponentsDir) {
    throw new Error("Components directory not found. Ensure components are bundled with the MCP.");
  }

  // Copy all component files
  for (const fileName of COMPONENT_FILES) {
    const sourcePath = path.join(sourceComponentsDir, fileName);
    const targetPath = path.join(targetComponentsDir, fileName);
    
    try {
      const content = await fsp.readFile(sourcePath, "utf8");
      await fsp.writeFile(targetPath, content, "utf8");
    } catch (err) {
      // Silently skip missing components
    }
  }
}


