import fs from "node:fs";
import path from "node:path";
import { BundleFile, JobResultSummary, ManifestEntry, OverwriteMode } from "./types.js";
import { ensureDirectoryExists, parseAllowedRootsFromEnv, sanitizeTargetPath, sha256HexFromBuffer } from "./utils.js";

export interface ApplyBundleOptions {
  targetDir: string;
  manifest: ManifestEntry[];
  files: BundleFile[];
  overwriteMode: OverwriteMode;
}

export function applyBundleToDisk(options: ApplyBundleOptions): JobResultSummary {
  const { targetDir, manifest, files, overwriteMode } = options;
  const allowedRoots = parseAllowedRootsFromEnv();
  const resolvedTargetDir = sanitizeTargetPath(allowedRoots, targetDir);
  ensureDirectoryExists(resolvedTargetDir);

  const result: JobResultSummary = { created: [], updated: [], skipped: [], conflicts: [], backups: [] };

  const fileMap = new Map<string, BundleFile>();
  for (const f of files) fileMap.set(normalizeRelPath(f.path), f);

  // Create directories first
  for (const entry of manifest) {
    const rel = normalizeRelPath(entry.path);
    if (entry.mode === "dir") {
      const abs = path.join(resolvedTargetDir, rel);
      sanitizeTargetPath([resolvedTargetDir], abs);
      ensureDirectoryExists(abs);
    }
  }

  for (const entry of manifest) {
    if (entry.mode !== "file") continue;
    const rel = normalizeRelPath(entry.path);
    const bundleFile = fileMap.get(rel);
    if (!bundleFile) {
      // Not fatal: manifest may enumerate logical files; skip if not included
      result.skipped.push(rel);
      continue;
    }
    const abs = path.join(resolvedTargetDir, rel);
    sanitizeTargetPath([resolvedTargetDir], abs);
    const parent = path.dirname(abs);
    ensureDirectoryExists(parent);

    const newBuffer = Buffer.from(bundleFile.contentsBase64, "base64");
    const newHash = bundleFile.hash ?? sha256HexFromBuffer(newBuffer);
    const exists = fs.existsSync(abs);

    if (!exists) {
      fs.writeFileSync(abs, newBuffer);
      result.created.push(rel);
      continue;
    }

    const currentBuffer = fs.readFileSync(abs);
    const currentHash = sha256HexFromBuffer(currentBuffer);
    const isSame = currentHash === newHash;
    if (isSame) {
      result.skipped.push(rel);
      continue;
    }

    switch (overwriteMode) {
      case "fail": {
        result.conflicts.push(rel);
        break;
      }
      case "skip": {
        result.skipped.push(rel);
        break;
      }
      case "backup": {
        const backupPath = uniqueBackupPath(abs);
        ensureDirectoryExists(path.dirname(backupPath));
        fs.renameSync(abs, backupPath);
        fs.writeFileSync(abs, newBuffer);
        result.backups.push(path.relative(resolvedTargetDir, backupPath));
        result.updated.push(rel);
        break;
      }
      case "overwrite": {
        fs.writeFileSync(abs, newBuffer);
        result.updated.push(rel);
        break;
      }
      default: {
        const _exhaustive: never = overwriteMode as never;
        throw new Error(`Unknown overwrite mode: ${_exhaustive}`);
      }
    }
  }

  return result;
}

function normalizeRelPath(p: string): string {
  // Prevent absolute paths and backtracking
  const normalized = p.replace(/\\/g, "/");
  if (normalized.startsWith("/")) return normalized.slice(1);
  return normalized;
}

function uniqueBackupPath(originalAbsPath: string): string {
  const dir = path.dirname(originalAbsPath);
  const base = path.basename(originalAbsPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let candidate = path.join(dir, `${base}.bak.${stamp}`);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base}.bak.${stamp}.${counter++}`);
  }
  return candidate;
}

