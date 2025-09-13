import { createHash } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
export function nowIso() {
    return new Date().toISOString();
}
export function sha256HexFromBuffer(buffer) {
    const hash = createHash("sha256");
    hash.update(buffer);
    return hash.digest("hex");
}
export function ensureDirectoryExists(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}
export function isPathInside(parent, child) {
    const relative = path.relative(parent, child);
    return !!relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}
export function sanitizeTargetPath(allowedRoots, candidatePath) {
    const resolved = path.resolve(candidatePath);
    for (const root of allowedRoots) {
        const resolvedRoot = path.resolve(root);
        if (resolved === resolvedRoot || isPathInside(resolvedRoot, resolved)) {
            return resolved;
        }
    }
    throw new Error(`Target path is outside of allowed roots: ${resolved}`);
}
export function parseAllowedRootsFromEnv() {
    const raw = process.env.SITEPAIGE_ALLOWED_ROOTS;
    const defaults = [process.cwd()];
    if (!raw || !raw.trim())
        return defaults.map((p) => path.resolve(p));
    return raw
        .split(",")
        .map((p) => p.trim())
        .filter((p) => !!p)
        .map((p) => path.resolve(p));
}
export function appendFileSyncSafe(filePath, data) {
    ensureDirectoryExists(path.dirname(filePath));
    fs.appendFileSync(filePath, data);
}
//# sourceMappingURL=utils.js.map