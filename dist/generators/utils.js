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
// Track generated file names to detect duplicates
const generatedFileNames = new Map();
export function viewFileBaseName(view) {
    const name = view.name || view.id || "view";
    let baseName = safeSlug(name);
    // Check if this filename has been used before
    const count = generatedFileNames.get(baseName) || 0;
    if (count > 0) {
        // Add view type and/or ID suffix to make it unique
        const typeSuffix = view.type ? `_${safeSlug(view.type)}` : '';
        const idSuffix = view.id ? `_${view.id.slice(-6).replace(/[^a-zA-Z0-9]/g, '')}` : '';
        baseName = `${baseName}${typeSuffix}${idSuffix}`;
    }
    // Track this filename
    generatedFileNames.set(baseName, count + 1);
    return baseName;
}
// Clear the filename tracking when starting a new generation
export function clearGeneratedFileNames() {
    generatedFileNames.clear();
}
//# sourceMappingURL=utils.js.map