import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fetch } from "undici";
import { ensureDir } from "./utils.js";
import { buildUrl } from "../sitepaige.js";
import { Blueprint, View } from "../types.js";

function isUuidV4Like(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function collectImageUuidsFromBlueprint(blueprint: Blueprint): Map<string, { uuid: string; isLogo?: boolean; isFavicon?: boolean }> {
  const imageInfo = new Map<string, { uuid: string; isLogo?: boolean; isFavicon?: boolean }>();
  const add = (val: string, isLogo = false, isFavicon = false) => {
    if (!val) return;
    let uuid: string | null = null;
    if (val.startsWith("image|")) {
      const id = val.slice("image|".length);
      if (isUuidV4Like(id)) uuid = id;
    } else if (isUuidV4Like(val)) {
      uuid = val;
    }
    if (uuid && !imageInfo.has(uuid)) {
      imageInfo.set(uuid, { uuid, isLogo, isFavicon });
    }
  };

  // Design-level images
  const d = blueprint.design;
  add(d.logo || "", true, false);  // Mark logo as special
  add(d.favicon || "", false, true);  // Mark favicon as special

  // Views background_image and image views
  const views = blueprint.views || [];
  for (const v of views) {
    const type = v.type.toLowerCase();
    const isLogoView = type === "logo";
    add(v.background_image || "", isLogoView, false);
    if (type === "image") add(v.custom_view_description || v.background_image || "", false, false);
    if (isLogoView) add(v.custom_view_description || v.background_image || "", true, false);
  }

  // SQL sample data pattern: 'image|uuid' or ="image|uuid"
  const sample = blueprint.sample_data || [];
  const pat1 = /'image\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'/gi;
  const pat2 = /="image\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/gi;
  for (const row of sample) {
    const sql = row.sql || "";
    for (const m of sql.matchAll(pat1)) add(m[1]);
    for (const m of sql.matchAll(pat2)) add(m[1]);
  }

  return imageInfo;
}

async function detectExtensionFromBytes(buf: Buffer): Promise<string> {
  if (buf.length >= 12) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return ".png";
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return ".webp";
  }
  return ".jpg";
}

export async function downloadImagesToPublic(targetDir: string, imageInfoMap: Map<string, { uuid: string; isLogo?: boolean; isFavicon?: boolean }>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!imageInfoMap.size) return map;
  const publicImages = path.join(targetDir, "public", "images");
  const publicRoot = path.join(targetDir, "public");
  ensureDir(publicImages);
  ensureDir(publicRoot);

  const jobs = Array.from(imageInfoMap.values()).map(async (info) => {
    const id = info.uuid;
    try {
      const url = buildUrl(`/api/image?imageid=${encodeURIComponent(id)}`);
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);

      const contentType = (res.headers.get("content-type") || "").toLowerCase();

      let buf: Buffer | null = null;
      let hintedExt: string | null = null;

      const extFromContentType = (ct: string | undefined | null): string | null => {
        if (!ct) return null;
        if (ct.includes("image/png")) return ".png";
        if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return ".jpg";
        if (ct.includes("image/webp")) return ".webp";
        if (ct.includes("image/gif")) return ".gif";
        if (ct.includes("image/svg")) return ".svg";
        return null;
      };

      if (contentType.includes("application/json") || contentType.includes("text/json")) {
        const text = await res.text();
        let payload: any = null;
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error("Expected JSON but failed to parse response for image " + id);
        }
        // Accept several shapes: { image: "base64..." } or { image: "data:mime;base64,..." }
        let base64OrDataUrl: string | undefined = undefined;
        let mimeFromPayload: string | undefined = undefined;
        if (typeof payload === "string") {
          base64OrDataUrl = payload;
        } else if (payload && typeof payload === "object") {
          base64OrDataUrl = payload.image ?? payload.data ?? payload.base64 ?? payload.buffer;
          mimeFromPayload = payload.contentType ?? payload.mime ?? payload.mimetype;
        }
        if (!base64OrDataUrl || typeof base64OrDataUrl !== "string") {
          throw new Error("JSON response missing base64 image data for " + id);
        }
        if (base64OrDataUrl.startsWith("data:")) {
          const commaIdx = base64OrDataUrl.indexOf(",");
          const meta = base64OrDataUrl.slice(5, commaIdx > 5 ? commaIdx : undefined); // between 'data:' and first comma
          const dataPart = commaIdx >= 0 ? base64OrDataUrl.slice(commaIdx + 1) : base64OrDataUrl;
          // meta looks like 'image/png;base64' or similar
          hintedExt = extFromContentType(meta) ?? null;
          buf = Buffer.from(dataPart, "base64");
        } else {
          // Plain base64 string
          buf = Buffer.from(base64OrDataUrl, "base64");
          hintedExt = extFromContentType(mimeFromPayload) ?? null;
        }
      } else {
        // Binary image response
        if (!hintedExt) hintedExt = extFromContentType(contentType);
        const arrayBuffer = await res.arrayBuffer();
        buf = Buffer.from(arrayBuffer);
      }

      if (!buf) throw new Error("No image bytes decoded for " + id);

      const ext = hintedExt ?? (await detectExtensionFromBytes(buf));
      let fileName: string;
      let filePath: string;
      
      if (info.isLogo) {
        // Save logo as "logo.png" in the public root directory
        fileName = `logo${ext}`;
        const abs = path.join(publicRoot, fileName);
        await fsp.writeFile(abs, buf);
        filePath = `/${fileName}`;
      } else if (info.isFavicon) {
        // Save favicon as "favicon.ico" in the public root directory
        fileName = `favicon.ico`;
        const abs = path.join(publicRoot, fileName);
        await fsp.writeFile(abs, buf);
        filePath = `/${fileName}`;
      } else {
        // Save regular images with UUID in the images directory
        fileName = `${id}${ext}`;
        const abs = path.join(publicImages, fileName);
        await fsp.writeFile(abs, buf);
        filePath = `/images/${fileName}`;
      }
      
      map.set(id, filePath);
    } catch (err) {
      // Silently skip failed image downloads
    }
  });

  await Promise.all(jobs);
  return map;
}

export function replaceImageRefsInBlueprint(blueprint: Blueprint, imageMap: Map<string, string>): Blueprint {
  const cloned = JSON.parse(JSON.stringify(blueprint));

  const replaceStr = (val: unknown): unknown => {
    if (typeof val !== "string") return val;
    if (val.startsWith("image|")) {
      const id = val.slice("image|".length);
      const p = imageMap.get(id);
      return p ?? val;
    }
    if (isUuidV4Like(val)) {
      const p = imageMap.get(val);
      return p ?? val;
    }
    return val;
  };

  const mutate = (obj: any) => {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) obj[i] = mutate(obj[i]);
      return obj;
    }
    if (obj && typeof obj === "object") {
      for (const k of Object.keys(obj)) obj[k] = mutate(obj[k]);
      return obj;
    }
    return replaceStr(obj);
  };

  return mutate(cloned);
}

export async function processBlueprintImages(targetDir: string, blueprint: Blueprint): Promise<Blueprint> {
  const imageInfoMap = collectImageUuidsFromBlueprint(blueprint);
  if (!imageInfoMap.size) return blueprint;
  const map = await downloadImagesToPublic(targetDir, imageInfoMap);
  return replaceImageRefsInBlueprint(blueprint, map);
}


