import fs from "node:fs";
export function ensureDir(p) {
    if (!fs.existsSync(p))
        fs.mkdirSync(p, { recursive: true });
}
export function safeSlug(input) {
    const raw = (input ?? "").toString();
    let s = raw.toLowerCase().replace(/[^a-z0-9]/gi, "_");
    s = s.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    if (!s)
        s = "page";
    if (/^[0-9]/.test(s))
        s = `p_${s}`;
    return s;
}
// Track view ID to filename mapping to ensure consistency
const viewIdToFileName = new Map();
export function viewFileBaseName(view) {
    // If we've already generated a filename for this view ID, return it
    if (view.id && viewIdToFileName.has(view.id)) {
        return viewIdToFileName.get(view.id);
    }
    const name = view.name || view.id || "view";
    let baseName = safeSlug(name);
    // Check if this base filename already exists for a different view
    const existingViewId = Array.from(viewIdToFileName.entries())
        .find(([_, filename]) => filename === baseName)?.[0];
    if (existingViewId && existingViewId !== view.id) {
        // This filename is taken by another view, make it unique
        // Only add type suffix if the type word isn't already in the name
        const typeSlug = view.type ? safeSlug(view.type) : '';
        const nameSlug = safeSlug(name);
        // Avoid redundant suffixes like "logo_logo" or "header_menu_menu"
        if (typeSlug && !nameSlug.includes(typeSlug)) {
            baseName = `${baseName}_${typeSlug}`;
        }
        // If still not unique or type was already in name, add ID suffix
        const stillExists = Array.from(viewIdToFileName.values()).includes(baseName);
        if (stillExists && view.id) {
            const idSuffix = view.id.slice(-6).replace(/[^a-zA-Z0-9]/g, '');
            baseName = `${baseName}_${idSuffix}`;
        }
    }
    // Store the mapping
    if (view.id) {
        viewIdToFileName.set(view.id, baseName);
    }
    return baseName;
}
// Clear the filename tracking when starting a new generation
export function clearGeneratedFileNames() {
    viewIdToFileName.clear();
}
//# sourceMappingURL=utils.js.map