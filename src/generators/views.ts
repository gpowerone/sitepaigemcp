import fsp from "node:fs/promises";
import path from "node:path";
import { ensureDir, viewFileBaseName } from "./utils.js";
import { generateMenuViewCode } from "./menus.js";
import { Blueprint, View, Menu, Page, PageView, Code } from "../types.js";

// Debug logging helper for MCP context
async function debugLog(message: string): Promise<void> {
  try {
    const logFile = path.join(process.cwd(), 'sitepaige-debug.log');
    const timestamp = new Date().toISOString();
    await fsp.appendFile(logFile, `[${timestamp}] ${message}\n`);
  } catch {
    // Silently fail if can't write log
  }
}

// Icon definitions for icon bar views
// Global array to collect CSS classes for injection into global.css
const viewStyleClasses: string[] = [];

// Add CSS for heading color handling via custom properties
viewStyleClasses.push(`
.view-with-heading-color h1,
.view-with-heading-color h2,
.view-with-heading-color h3,
.view-with-heading-color h4,
.view-with-heading-color h5,
.view-with-heading-color h6 {
  color: var(--heading-color) !important;
}`);

const ICON_SVGS_CONST = `const ICON_SVGS: { [key: string]: string } = {
  'shopping-cart': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  'search': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
  'user': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  'bell': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  'settings': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m4.22-13.22 4.24 4.24M1.54 1.54l4.24 4.24M20.46 20.46l-4.24-4.24M1.54 20.46l4.24-4.24"/></svg>',
  'home': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  'menu': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  'heart': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  'mail': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  'phone': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  'help': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  'info': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  'star': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  'bookmark': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  'download': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  'upload': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  'share': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  'logout': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  'calendar': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  'chart': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>'
};`;

// Track generated component names to ensure uniqueness
const generatedComponentNames = new Set<string>();

function pascalCaseFromBase(base: string, viewId?: string): string {
  // IMPORTANT: Add 'Generated' prefix to avoid naming conflicts with imported components
  // Without this prefix, views like "HeaderLogin" would become "HeaderLoginView" which could
  // conflict with or circular import the LoginSection component from headerlogin.tsx
  // With the prefix, it becomes "GeneratedHeaderLoginView" which is guaranteed to be unique
  let componentName = `Generated${base.replace(/(^|_)([a-z])/g, (_m, _g1, c) => c.toUpperCase())}View`;
  
  // If this name already exists, append a suffix to make it unique
  if (generatedComponentNames.has(componentName) && viewId) {
    // Use part of the view ID to create a unique suffix
    const suffix = viewId.slice(-6).replace(/[^a-zA-Z0-9]/g, '');
    componentName = `${componentName}_${suffix}`;
  }
  
  generatedComponentNames.add(componentName);
  return componentName;
}

// Helper function to generate style props from View object
export function generateStyleProps(systemView: View, isContainer: boolean): { styleAttrs: string, cssClasses: string[] } {
    const styleProps = [];
    const cssClasses = [];
    
    // Background color and image
    if (systemView.background_color && systemView.background_color !== '') {
        styleProps.push(`backgroundColor: '${systemView.background_color}'`);
    }
    
    if (systemView.opacity !== null && systemView.opacity !== undefined) {
        styleProps.push(`opacity: ${systemView.opacity}`);
    }

    if (systemView.background_image && systemView.background_image !== '') {
        // CRITICAL FIX: Clean any data:image/jpeg;base64, prefix from background image
        const cleanedBackgroundImage = systemView.background_image.replace(/data:image\/[^;]+;base64,/g, '');
        
        // Handle background image inline for now - could be improved to use CSS classes
        styleProps.push(`backgroundImage: 'url(${cleanedBackgroundImage})'`);
        styleProps.push(`backgroundSize: 'cover'`);
        styleProps.push(`backgroundPosition: 'center'`);
        styleProps.push(`backgroundRepeat: 'no-repeat'`);
    }
    
    // Text and title colors
    if (systemView.text_color && systemView.text_color !== '') {
        styleProps.push(`color: '${systemView.text_color}'`);
    }
    
    // Padding - using conditional checks to match preview
    if (systemView.paddingLeft) styleProps.push(`paddingLeft: '${systemView.paddingLeft}px'`);
    if (systemView.paddingRight) styleProps.push(`paddingRight: '${systemView.paddingRight}px'`);
    if (systemView.paddingTop) styleProps.push(`paddingTop: '${systemView.paddingTop}px'`);
    if (systemView.paddingBottom) styleProps.push(`paddingBottom: '${systemView.paddingBottom}px'`);
    
    // Margin - using conditional checks to match preview
    if (systemView.marginLeft) styleProps.push(`marginLeft: '${systemView.marginLeft}px'`);
    if (systemView.marginRight) styleProps.push(`marginRight: '${systemView.marginRight}px'`);
    if (systemView.marginTop) styleProps.push(`marginTop: '${systemView.marginTop}px'`);
    if (systemView.marginBottom) styleProps.push(`marginBottom: '${systemView.marginBottom}px'`);
    
    // Min/Max dimensions - using conditional checks to match preview
    if (systemView.minHeight) styleProps.push(`minHeight: '${systemView.minHeight}px'`);
    if (systemView.minWidth) styleProps.push(`minWidth: '${systemView.minWidth}px'`);
    if (systemView.maxHeight) styleProps.push(`maxHeight: '${systemView.maxHeight}px'`);
    if (systemView.maxWidth) styleProps.push(`maxWidth: '${systemView.maxWidth}px'`);
    
    // Layout system - using grid layout like in rview.tsx
    styleProps.push(`display: 'grid'`);
    
    // Opacity
    if (systemView.opacity !== null && systemView.opacity !== undefined) {
        styleProps.push(`opacity: ${systemView.opacity}`);
    }
    
    // Combined alignment using placeItems (matches rview.tsx exactly)
    const verticalAlign = (systemView.verticalAlign || '').toLowerCase();
    const align = (systemView.align || '').toLowerCase();

    const placeItems = 
        verticalAlign.toLowerCase() === 'top' && align.toLowerCase() === 'left' ? 'start start' :
        verticalAlign.toLowerCase() === 'top' && align.toLowerCase() === 'center' ? 'start center' :
        verticalAlign.toLowerCase() === 'top' && align.toLowerCase() === 'right' ? 'start end' :
        verticalAlign.toLowerCase() === 'center' && align.toLowerCase() === 'left' ? 'center start' :
        verticalAlign.toLowerCase() === 'center' && align.toLowerCase() === 'center' ? 'center center' :
        verticalAlign.toLowerCase() === 'center' && align.toLowerCase() === 'right' ? 'center end' :
        verticalAlign.toLowerCase() === 'bottom' && align.toLowerCase() === 'left' ? 'end start' :
        verticalAlign.toLowerCase() === 'bottom' && align.toLowerCase() === 'center' ? 'end center' :
        verticalAlign.toLowerCase() === 'bottom' && align.toLowerCase() === 'right' ? 'end end' : 'center center';

    styleProps.push(`placeItems: '${placeItems}'`);

    // Text alignment 
    if (systemView.type!=="container") {
      if (align.toLowerCase() === 'left') {
          styleProps.push(`textAlign: 'left'`);
          styleProps.push(`justifyContent: 'start'`);
      } else if (align.toLowerCase() === 'center') {
          styleProps.push(`textAlign: 'center'`);
          styleProps.push(`justifyContent: 'center'`);
      } else if (align.toLowerCase() === 'right') {
          styleProps.push(`textAlign: 'right'`);
          styleProps.push(`justifyContent: 'end'`);
      }
    }
    
    // Apply heading color via CSS custom property
    if (systemView.card_title_color && systemView.card_title_color !== '') {
        styleProps.push(`'--heading-color': '${systemView.card_title_color}'`);
        cssClasses.push('view-with-heading-color');
    }
    
    const styleAttrs = styleProps.length > 0 ? ` style={{ ${styleProps.join(', ')} }}` : '';
    const classNames = cssClasses.length > 0 ? cssClasses : [];
    
    return { styleAttrs, cssClasses: classNames };
}


function buildResponsiveColClasses(cfg: Partial<PageView>, legacy: boolean, colsPerView: number | null): string {
  const col = cfg.colpos || 1;
  const colMd = cfg.colposmd || col;
  const colSm = cfg.colpossm || colMd;
  const spanBase = (n: number) => Math.max(1, Math.min(12, n));
  const lg = spanBase(legacy ? (colsPerView || 1) : col);
  const md = spanBase(legacy ? (colsPerView || 1) : colMd);
  const sm = spanBase(legacy ? (colsPerView || 1) : colSm);
  return [`col-span-${sm}`, `md:col-span-${md}`, `lg:col-span-${lg}`].join(" ");
}

interface ContainerSubview {
  viewId?: string;
  id?: string;
  colpos?: number;
  colposmd?: number;
  colpossm?: number;
}

function parseContainerSubviews(desc: unknown): Array<ContainerSubview> {
  if (!desc) return [];
  if (Array.isArray(desc)) return desc as ContainerSubview[];
  if (typeof desc === "string") {
    try {
      const parsed = JSON.parse(desc);
      return Array.isArray(parsed) ? (parsed as ContainerSubview[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function writeViews(targetDir: string, blueprint: Blueprint, projectCode?: Code, authProviders?: { apple: boolean; facebook: boolean; github: boolean; google: boolean }): Promise<Map<string, { componentName: string; relImport: string }>> {
  // Clear the component names set for a fresh start
  generatedComponentNames.clear();
  
  const viewsDir = path.join(targetDir, "src", "views");
  ensureDir(viewsDir);
  const viewMap = new Map<string, { componentName: string; relImport: string }>();
  const views = blueprint.views || [];
  const menus = blueprint.menus || [];
  const pages = blueprint.pages || [];
  const byId = new Map<string, View>();
  for (const v of views) {
    if (v.id) byId.set(v.id, v);
  }
  
  // Debug logging
  await debugLog('[writeViews] projectCode: ' + (projectCode ? 'exists' : 'undefined'));
  if (projectCode && projectCode.views) {
    await debugLog('[writeViews] projectCode.views count: ' + projectCode.views.length);
    for (const vc of projectCode.views) {
      await debugLog(`[writeViews] View code available for ID: ${vc.viewID}, code length: ${vc.code?.length || 0}`);
    }
  }

  // First pass: non-container views
  for (const v of views) {
    const type = v.type.toLowerCase();
    if (type === "container") continue;
    const base = viewFileBaseName(v);
    const file = path.join(viewsDir, `${base}.tsx`);
    const comp = pascalCaseFromBase(base, v.id);
    let code = "";
    
    await debugLog(`[writeViews] Processing view: ${v.id}, type: ${type}, name: ${v.name}`);
    
    // Check if we have code from the blueprint
    let hasProvidedCode = false;
    if (projectCode && projectCode.views) {
      const viewCode = projectCode.views.find(vc => vc.viewID === v.id);
      await debugLog(`[writeViews] Looking for code for view ${v.id}, found: ${viewCode ? 'yes' : 'no'}`);
      if (viewCode && viewCode.code) {
        // Don't clean data:image prefixes - let them pass through to transpiler
        const cleanedCode = viewCode.code;
        
        try {
          // Dynamically import the transpiler
          // @ts-ignore - CommonJS module
          const { transpileCode } = await import("../../transpiler/transpiler.cjs");
          const transpiler = { transpileCode };
          
          // Transpile the code
          const dictionary = blueprint.dictionary || {}; // Use dictionary from blueprint
          const transpiledResult: { success: boolean, code: string, error?: string } = JSON.parse(
            transpiler.transpileCode(cleanedCode, pages, dictionary)
          );
          
          if (transpiledResult.success) {
            code = transpiledResult.code;
            hasProvidedCode = true;
          } else {
            await debugLog(`[writeViews] Transpilation failed for view ${v.id}: ${transpiledResult.error}`);
            // Fall back to description-based transpilation if available
            if (v.custom_view_description) {
              const cleanedDescription = v.custom_view_description;
              const fallbackResult = JSON.parse(
                transpiler.transpileCode(cleanedDescription, pages, blueprint.dictionary || {})
              );
              if (fallbackResult.success) {
                code = fallbackResult.code;
                hasProvidedCode = true;
              }
            }
          }
        } catch (error) {
          await debugLog(`[writeViews] Error processing code for view ${v.id}: ${error}`);
        }
      }
    }
    
    // Only generate default code if we don't have provided code
    if (!hasProvidedCode) {
    if (type === "text") {
      const html = v.custom_view_description.replace(/`/g, "\\`");
      const useCard = false; // You can modify this based on view properties if needed
      code = `import React from 'react';

interface ${comp}Props {
  isContainer?: boolean;
}

export default function ${comp}({ isContainer = false }: ${comp}Props){
  const useCard = ${useCard};
  return (
      <div className="rtext-content" dangerouslySetInnerHTML={{__html: ${JSON.stringify(html)} }} />
  );
}`;
    } else if (type === "image") {
      const src = v.custom_view_description || v.background_image || "";
      const height = v.height;
      code = `import React from 'react';

export default function ${comp}(){
  return (
    <>
      ${src ? `<img
        src=${JSON.stringify(src)}
        alt="image"
        style={{ 
          objectFit: 'cover',
          objectPosition: 'center',
          width: '100%',
          height: ${height ? `'${height}px'` : "'auto'"},
          display: 'block'
        }}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />` : ''}
    </>
  );
}`;
    } else if (type === "logo") {
      // Logo images are now saved directly as logo.png/logo.jpg by the image processor
      const logoPath = v.background_image || v.custom_view_description || "";
      let logoFileName = "logo.png";
      
      // Check if the logo path starts with /logo. (already processed)
      if (logoPath.startsWith("/logo.")) {
        logoFileName = logoPath.slice(1); // Remove leading slash
      }
      
      code = `import React from 'react';

export default function ${comp}(){return <div className=\"logo\"><a href=\"/\"><img src=\"/${logoFileName}\" alt=\"Logo\" width=\"240\" height=\"80\" /></a></div>}`;
    } else if (type === "menu") {
      const menuId = v.custom_view_description;
      code = generateMenuViewCode(comp, menuId, menus, pages);
    } else if (type === "component") {
      const promptText = v.prompt || "Component view";
      code = `import React from 'react';

export default function ${comp}(){
  return (
    <div className="text-content opacity-80" style={{ 
      padding: '1.5rem',
      borderRadius: '0.5rem'${v.background_color ? `,
      backgroundColor: ${JSON.stringify(v.background_color)}` : ''}
    }}>
      <div className="text-gray-600">
        <strong>Prompt:</strong> ${promptText}
      </div>
    </div>
  );
}`;
    } else if (type === "iconbar" || type === "icon bar" || type === "icon_bar") {
      // Generate icon bar component
      const customViewDescription = v.custom_view_description || '[]';
      const align = v.align || 'Center';
      
      code = `
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

// Icon definitions as inline SVG strings
${ICON_SVGS_CONST}

interface IconItem {
  icon: string;
  text: string;
  pageId: string;
}

export default function ${comp}() {
  const router = useRouter();
  const customViewDescription = ${JSON.stringify(customViewDescription)};
  const align = '${align}';
  
  let items: IconItem[] = [];

  try {
    const parsed = customViewDescription ? JSON.parse(customViewDescription) : [];
    items = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // Error parsing icon bar data - no MCP logging in client component
    items = [];
  }

  if (items.length === 0) {
    return (
      <div>
       &nbsp;
      </div>
    );
  }

  const alignmentClasses = {
    'Left': 'justify-start',
    'Center': 'justify-center',
    'Right': 'justify-end'
  };

  const handleClick = (pageId: string) => {
    if (!pageId) return;
    
    // Find the page using the pageId and navigate to it
    const pages = ${JSON.stringify(pages.map(p => ({ id: p.id, name: p.name })))};
    const page = pages.find(p => p.id === pageId);
    if (page) {
      // Use page name for URL, replace non-alphanumeric with underscore
      let folderName = page.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      
      // Replace multiple consecutive underscores with a single underscore
      folderName = folderName.replace(/_+/g, '_');
      
      // Remove leading and trailing underscores
      folderName = folderName.replace(/^_+|_+$/g, '');
      
      // If folder name is empty or starts with underscore after trimming, prefix with 'p'
      if (!folderName || folderName.startsWith('_')) {
        folderName = 'p' + folderName;
      }
      
      router.push('/' + folderName);
    }
  };

  return (
    <>
      <div className={\`hidden md:flex gap-4 p-2 \${alignmentClasses[align as keyof typeof alignmentClasses]}\`}>
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => handleClick(item.pageId)}
            disabled={!item.pageId}
            className="!bg-transparent flex-shrink-0 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              height: '40px',
              width: '40px'
            }}
          >
            <div
              className="w-full h-full flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6"
              dangerouslySetInnerHTML={{ __html: ICON_SVGS[item.icon] || ICON_SVGS['bell'] }}
            />
          </button>
        ))}
      </div>
    </>
  );
}`;
    } else if (type === "loginbutton") {
      // Import the LoginSection component from headerlogin.tsx
      code = `import React from 'react';
import LoginSection from '../components/headerlogin';

export default function ${comp}() {
  return <LoginSection />;
}`;
    } else if (type === "headerlogin") {
      // Import the LoginSection component from headerlogin.tsx
      code = `import React from 'react';
import LoginSection from '../components/headerlogin';

export default function ${comp}() {
  return <LoginSection />;
}`;
    } else if (type === "logincallback") {
      // Import the LoginCallback component
      code = `import React from 'react';
import LoginCallback from '../components/logincallback';

export default function ${comp}() {
  return <LoginCallback />;
}`;
    } else if (type === "login") {
      // Import the Login component
      // Convert authProviders object to providers array
      const providers: string[] = [];
      if (authProviders) {
        if (authProviders.google) providers.push('google');
        if (authProviders.facebook) providers.push('facebook');
        if (authProviders.github) providers.push('github');
        if (authProviders.apple) providers.push('apple');
      } else {
        // Default to google if no auth providers specified
        providers.push('google');
      }
      
      code = `import React from 'react';
import Login from '../components/login';

export default function ${comp}() {
  return <Login providers={${JSON.stringify(providers)}} />;
}`;
    } else if (type === "profile") {
      // Import the Profile component
      code = `import React from 'react';
import Profile from '../components/profile';

export default function ${comp}() {
  return <Profile />;
}`;
    } else if (type === "cta") {
      // Import the CTA component and wrap it with navigation logic
      const customViewDescription = v.custom_view_description || '{}';
      code = `'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import RCTA from '../components/cta';

export default function ${comp}() {
  const router = useRouter();
  const customViewDescription = ${JSON.stringify(customViewDescription)};
  
  const handleNavigate = (pageId: string) => {
    if (!pageId) return;
    
    // Find the page using the pageId and navigate to it
    const pages = ${JSON.stringify(pages.map(p => ({ id: p.id, name: p.name })))};
    const page = pages.find(p => p.id === pageId);
    if (page) {
      // Use page name for URL, replace non-alphanumeric with underscore
      let folderName = page.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      
      // Replace multiple consecutive underscores with a single underscore
      folderName = folderName.replace(/_+/g, '_');
      
      // Remove leading and trailing underscores
      folderName = folderName.replace(/^_+|_+$/g, '');
      
      // If empty or just 'home', use root
      if (!folderName || folderName === 'home') {
        router.push('/');
      } else {
        router.push('/' + folderName);
      }
    }
  };
  
  return <RCTA custom_view_description={customViewDescription} onNavigate={handleNavigate} isPaigeLoading={false} />;
}`;
    } else if (type === "loggedinmenu") {
      // Import the LoggedInMenu component
      code = `import React from 'react';
import LoggedInMenu from '../components/loggedinmenu';

export default function ${comp}() {
  return <LoggedInMenu />;
}`;
    } else if (type === "adminmenu") {
      // Import the AdminMenu component
      code = `import React from 'react';
import AdminMenu from '../components/adminmenu';

export default function ${comp}() {
  return <AdminMenu />;
}`;
    } else if (type === "useradmin") {
      // Import the Admin component (useradmin uses admin.tsx)
      code = `import React from 'react';
import Admin from '../components/admin';

export default function ${comp}() {
  return <Admin />;
}`;
    } else if (type === "integration") {
      const promptText = v.prompt || "Integration view";
      code = `import React from 'react';

export default function ${comp}() {
  return (
    <span>
      {/* Integration Placeholder: ${promptText} */}
    </span>
  );
}`;
     } else {
      // Default case for unhandled view types (including complexcomponent)
      const promptText = v.prompt || `${v.type} view`;
      code = `import React from 'react';

export default function ${comp}(){
  return (
    <div className="text-content opacity-80" style={{ 
      padding: '1.5rem',
      borderRadius: '0.5rem'${v.background_color ? `,
      backgroundColor: ${JSON.stringify(v.background_color)}` : ''}
    }}>
      <div className="text-gray-600">
        <strong>Prompt:</strong> ${promptText}
      </div>
    </div>
  );
}`;
    }
    } // Close if (!hasProvidedCode)
    
    await fsp.writeFile(file, code, "utf8");
    viewMap.set(v.id, { componentName: comp, relImport: path.posix.join("../../views", `${base}`) });
  }

  // Second pass: container views with subviews
  for (const v of views) {
    const type = v.type.toLowerCase();
    if (type !== "container") continue;

    const base = viewFileBaseName(v);
    const file = path.join(viewsDir, `${base}.tsx`);
    const comp = pascalCaseFromBase(base, v.id);

    const subviews = parseContainerSubviews(v.custom_view_description);
    // Normalize into objects with viewId/colpos...
    const normalized = subviews.map((s) => {
      if (typeof s === "string") return { viewId: s } as ContainerSubview;
      return s || {};
    });

    const total = normalized.reduce((sum, s) => sum + (s.colpos || 1), 0);
    const legacy = total !== 12 && normalized.length > 0;
    const colsPerView = legacy ? Math.floor(12 / normalized.length) : null;

    const importLines: string[] = [];
    const blocks: string[] = [];

    // Check if container has background image for opacity handling
    const hasContainerBackground = v.background_image && v.background_image !== '';

    for (const s of normalized) {
      const subId = s.viewId || s.id || "";
      if (!subId) continue;
      
      const target = byId.get(subId);
      if (!target) continue;
      
      const subBase = viewFileBaseName(target);
      
      // CRITICAL: Skip if the subview would generate the same file name as the container
      // This prevents circular imports when views have the same name but different IDs
      if (subBase === base) {
        await debugLog(`[writeViews] WARNING: Container view "${v.name}" (${v.id}) is trying to reference a view "${target.name}" (${target.id}) that generates the same file name. Skipping to prevent circular import.`);
        // Add a placeholder comment in the generated output
        const cols = buildResponsiveColClasses(s, legacy, colsPerView);
        const allClasses = ["h-full", "w-full", cols].join(" ");
        blocks.push(`\n            {/* WARNING: Circular reference detected - view would import itself */}\n            <div className="${allClasses}">\n              <div className="w-full p-4 text-center text-gray-500">\n                <p className="text-sm">Circular reference prevented</p>\n                <p className="text-xs mt-1">Container and subview generate same file: ${subBase}.tsx</p>\n              </div>\n            </div>`);
        continue;
      }
      
      const subComp = pascalCaseFromBase(subBase, target.id);
      importLines.push(`import ${subComp} from './${subBase}';`);
      
      // Build subview wrapper style and CSS classes
      const { styleAttrs: wrapperStyle, cssClasses } = generateStyleProps(target, true);
      let modifiedWrapperStyle = wrapperStyle;
    
    
      
      const cols = buildResponsiveColClasses(s, legacy, colsPerView);
      const allClasses = ["h-full", "w-full", cols, ...cssClasses].join(" ");
      // Pass isContainer={true} for text components
      const componentProps = target.type === 'text' ? ' isContainer={true}' : '';
      
      // Extract alignment from the target view to add appropriate classes to inner wrapper
      const verticalAlign = (target.verticalAlign || '').toLowerCase();
      const align = (target.align || '').toLowerCase();
      
      // Add flex classes to inner wrapper to ensure proper content alignment
      const innerWrapperClasses = [
        "w-full",
        "h-full",
        "flex",
        "flex-col",
        // Vertical alignment
        verticalAlign === 'top' ? 'justify-start' :
        verticalAlign === 'bottom' ? 'justify-end' : 'justify-center',
        // Horizontal alignment
        align === 'left' ? 'items-start' :
        align === 'right' ? 'items-end' : 'items-center'
      ].join(" ");
      
      blocks.push(`\n            <div className=\"${allClasses}\"${modifiedWrapperStyle}>\n              <div className=\"${innerWrapperClasses}\">\n                <${subComp}${componentProps} />\n              </div>\n            </div>`);
    }

    const { styleAttrs: containerStyle, cssClasses: containerCssClasses } = generateStyleProps(v, false);
    
    // Handle flowVertical property - use grid-flow-row for vertical, grid-flow-col for horizontal
    const gridDirection = v.flowVertical ? "grid-flow-row" : "grid-flow-col";
    // Only add grid-cols-12 for vertical flow (rows), not for horizontal flow (columns)
    const gridCols = v.flowVertical ? "grid-cols-12" : "";
    
    const containerClasses = ["h-full", "gap-4", "grid", gridCols, gridDirection, "relative", ...containerCssClasses].join(" ");
    
    const code = `import React from 'react';\n${importLines.join("\n")}\n\nexport default function ${comp}(){\n  return (\n    <div className=\"${containerClasses}\"${containerStyle}>${blocks.join("")}\n    </div>\n  );\n}`;

    await fsp.writeFile(file, code, "utf8");
    viewMap.set(v.id, { componentName: comp, relImport: path.posix.join("../../views", `${base}`) });
  }

  return viewMap;
}

// Function to get and clear collected view styles
export function getViewStyles(): string[] {
    const styles = [...viewStyleClasses];
    viewStyleClasses.length = 0; // Clear the array
    return styles;
}
