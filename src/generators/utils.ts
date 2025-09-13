import fs from "node:fs";
import { View } from "../types.js";

export type AnyRecord = Record<string, any>;

export function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export function safeSlug(input: string): string {
  const raw = (input ?? "").toString();
  let s = raw.toLowerCase().replace(/[^a-z0-9]/gi, "_");
  s = s.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!s) s = "page";
  if (/^[0-9]/.test(s)) s = `p_${s}`;
  return s;
}

export function viewFileBaseName(view: View): string {
  const name = view.name || view.id || "view";
  return safeSlug(name);
}


