import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ensureDir, safeSlug } from "./utils.js";
import { Blueprint, Page, View, PageView } from "../types.js";

function buildStyleAttrForView(v: View | undefined): string {
  if (!v) return "";
  const style: string[] = [];
  const bg = v.background_color || "";
  if (bg) style.push(`backgroundColor: '${bg}'`);
  const bgImg = v.background_image || "";
  if (bgImg) {
    style.push(`backgroundImage: 'url(${bgImg})'`);
    style.push(`backgroundSize: 'cover'`);
    style.push(`backgroundPosition: 'center'`);
    style.push(`backgroundRepeat: 'no-repeat'`);
  }
  const textColor = v.text_color || "";
  if (textColor) style.push(`color: '${textColor}'`);
  // paddings
  if (v.paddingLeft) style.push(`paddingLeft: '${v.paddingLeft}px'`);
  if (v.paddingRight) style.push(`paddingRight: '${v.paddingRight}px'`);
  if (v.paddingTop) style.push(`paddingTop: '${v.paddingTop}px'`);
  if (v.paddingBottom) style.push(`paddingBottom: '${v.paddingBottom}px'`);
  // margins
  if (v.marginLeft) style.push(`marginLeft: '${v.marginLeft}px'`);
  if (v.marginRight) style.push(`marginRight: '${v.marginRight}px'`);
  if (v.marginTop) style.push(`marginTop: '${v.marginTop}px'`);
  if (v.marginBottom) style.push(`marginBottom: '${v.marginBottom}px'`);
  // dimensions
  if (v.minHeight) style.push(`minHeight: '${v.minHeight}px'`);
  if (v.minWidth) style.push(`minWidth: '${v.minWidth}px'`);
  if (v.maxHeight) style.push(`maxHeight: '${v.maxHeight}px'`);
  if (v.maxWidth) style.push(`maxWidth: '${v.maxWidth}px'`);
  // grid centering similar to reference
  style.push(`display: 'grid'`);
  const vertical = v.verticalAlign || '';
  const horiz = v.align || '';
  const place =
    (vertical === 'Top' && horiz === 'Left') ? 'start start' :
    (vertical === 'Top' && horiz === 'Center') ? 'start center' :
    (vertical === 'Top' && horiz === 'Right') ? 'start end' :
    (vertical === 'Center' && horiz === 'Left') ? 'center start' :
    (vertical === 'Center' && horiz === 'Center') ? 'center center' :
    (vertical === 'Center' && horiz === 'Right') ? 'center end' :
    (vertical === 'Bottom' && horiz === 'Left') ? 'end start' :
    (vertical === 'Bottom' && horiz === 'Center') ? 'end center' :
    (vertical === 'Bottom' && horiz === 'Right') ? 'end end' : 'center center';
  style.push(`placeItems: '${place}'`);
  if (style.length === 0) return "";
  return ` style={{ ${style.join(", ")} }}`;
}

function buildResponsiveColClasses(viewCfg: PageView, legacy: boolean, colsPerView: number | null): string {
  const col = viewCfg.colpos || 1;
  const colMd = viewCfg.colposmd || col;
  const colSm = viewCfg.colpossm || colMd;
  const spanBase = (n: number) => Math.max(1, Math.min(12, n));
  const lg = spanBase(legacy ? (colsPerView || 1) : col);
  const md = spanBase(legacy ? (colsPerView || 1) : colMd);
  const sm = spanBase(legacy ? (colsPerView || 1) : colSm);
  return [`col-span-${sm}`, `md:col-span-${md}`, `lg:col-span-${lg}`].join(" ");
}

export async function writePages(targetDir: string, blueprint: Blueprint, viewMap: Map<string, { componentName: string; relImport: string }>): Promise<void> {
  const appDir = path.join(targetDir, "src", "app");
  ensureDir(appDir);
  
  const pages = blueprint.pages || [];
  const systemViews = blueprint.views || [];
  
  for (const p of pages) {
    const slug = safeSlug(p.name || p.id || "page");
    const isHome = p.is_home === true;
    const pageDir = isHome ? appDir : path.join(appDir, slug);
    ensureDir(pageDir);
    const imports: string[] = [];
    const pageViews = [...p.views];
    // sort by rowpos
    pageViews.sort((a, b) => (a.rowpos || 0) - (b.rowpos || 0));
    // group by rowpos
    let currentRow = undefined as undefined | number;
    let rowGroup: PageView[] = [];
    const rowBlocks: string[] = [];
    const flushRow = () => {
      if (!rowGroup.length) return;
      const total = rowGroup.reduce((sum, v) => sum + (v.colpos || 1), 0);
      const legacy = total !== 12;
      const colsPerView = legacy ? Math.floor(12 / rowGroup.length) : null;
      let rowCode = `\n                    <div className="h-full gap-4 grid grid-cols-12 relative">`;
      for (const rv of rowGroup) {
        const sys = systemViews.find((sv) => sv.id === rv.id);
        const info = viewMap.get(rv.id);
        if (!info) {
          continue;
        }
        // import - adjust path for home page
        const adjustedImport = isHome ? info.relImport.replace('../../', '../') : info.relImport;
        imports.push(`import ${info.componentName} from '${adjustedImport}';`);
        const styleAttr = buildStyleAttrForView(sys);
        const cols = buildResponsiveColClasses(rv, legacy, colsPerView);
        const allClasses = ["h-full", "w-full", cols].join(" ");
        // Pass isContainer={false} for text components at page level
        const componentProps = sys && sys.type === 'text' ? ' isContainer={false}' : '';
        rowCode += `\n                        <div className="${allClasses}"${styleAttr}>`;
        rowCode += `\n                          <div className="w-full">`;
        rowCode += `\n                            <${info.componentName}${componentProps} />`;
        rowCode += `\n                          </div>`;
        rowCode += `\n                        </div>`;
      }
      rowCode += `\n                    </div>`;
      rowBlocks.push(rowCode);
      rowGroup = [];
    };
    for (const pv of pageViews) {
      const rp = pv.rowpos || 0;
      if (currentRow === undefined) {
        currentRow = rp;
      }
      if (rp !== currentRow) {
        flushRow();
        currentRow = rp;
      }
      rowGroup.push(pv);
    }
    flushRow();
    const viewsMarkup = rowBlocks.length ? rowBlocks.join("\n") : "        <div />";
    const code = `import React from 'react';
import { Metadata } from 'next';
${Array.from(new Set(imports)).join("\n")}

export const metadata: Metadata = { title: ${JSON.stringify(p.name || slug)}, description: ${JSON.stringify(p.description || "")} };

export default function Page(){
  return (
    <div className=\"page\" style={{ minHeight: '70vh' }}>
      <main>
${viewsMarkup}
      </main>
    </div>
  );
}
`;
    const pagePath = path.join(pageDir, "page.tsx");
    await fsp.writeFile(pagePath, code, "utf8");
  }
  
  const hasHome = pages.some((p) => p.is_home === true);
  
  if (!hasHome) {
    const homePath = path.join(appDir, "page.tsx");
    if (!fs.existsSync(homePath)) {
      await fsp.writeFile(homePath, `import React from 'react';

export default function Home(){return <div>Home</div>}`);
    }
  }
}


