import { Design, Blueprint, getDesign } from "../types.js";
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';



export function writeFavicon(targetDir: string, favicon: string): void {
    const publicDir = path.join(targetDir, 'public');
    
    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const faviconPath = path.join(publicDir, 'favicon.ico');
    
    // Check if favicon is a path to an existing image file
    if (favicon.startsWith('/images/') || favicon.startsWith('images/')) {
        // It's a path to an image file that was already downloaded
        const sourcePath = path.join(targetDir, 'public', favicon.startsWith('/') ? favicon.slice(1) : favicon);
        
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, faviconPath);
        }
    } else if (favicon.includes('base64') || favicon.length > 1000) {
        // It's base64 data
        const cleanedFavicon = favicon.replace(/data:image\/[^;]+;base64,/g, '');
        const buffer = Buffer.from(cleanedFavicon, 'base64');
        fs.writeFileSync(faviconPath, buffer);
    }
}

export function writeLogo(targetDir: string, logo: string): void {
    const publicDir = path.join(targetDir, 'public');
    
    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const logoPath = path.join(publicDir, 'logo.png');
    
    // CRITICAL FIX: Remove data:image prefix if present before converting to buffer
    const cleanedLogo = logo.replace(/data:image\/[^;]+;base64,/g, '');
    const buffer = Buffer.from(cleanedLogo, 'base64');
    
    fs.writeFileSync(logoPath, buffer);
}


// Function to convert Tailwind font size classes to CSS values
function getTailwindFontSizeValue(twClass: string): string {
  const fontSizeMap: Record<string, string> = {
    'text-xs': '0.75rem',
    'text-sm': '0.875rem',
    'text-base': '1rem',
    'text-lg': '1.125rem',
    'text-xl': '1.25rem',
    'text-2xl': '1.5rem',
    'text-3xl': '1.875rem',
    'text-4xl': '2.25rem',
    'text-5xl': '3rem',
    'text-6xl': '3.75rem',
    'text-7xl': '4.5rem',
    'text-8xl': '6rem',
    'text-9xl': '8rem',
  };
  return fontSizeMap[twClass] || '1rem'; // Default to base size
}

// Function to convert button roundedness to CSS border-radius values
function getButtonBorderRadius(roundedness: string): string {
  const roundednessMap: Record<string, string> = {
    'none': '0',
    'square': '0',
    'sm': '0.125rem',
    'rounded': '0.375rem',
    'md': '0.375rem',
    'lg': '0.5rem',
    'xl': '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    'full': '9999px',
  };
  return roundednessMap[roundedness] || '0.375rem'; // Default to rounded
}

export async function updateGlobalCSS(targetDir: string, blueprint: Blueprint, viewStyles: string[] = []): Promise<void> {
  const design = getDesign(blueprint);
  
  // Convert Tailwind font sizes to CSS values
  const titleFontSizeValue = getTailwindFontSizeValue(design.titleFontSize || 'text-3xl');
  const textFontSizeValue = getTailwindFontSizeValue(design.textFontSize || 'text-base');
  
  // Convert button roundedness to CSS border-radius
  const buttonBorderRadius = getButtonBorderRadius(design.buttonRoundedness || 'rounded');
  
  // Ensure public directory exists
  const publicDir = path.join(targetDir, 'public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Write favicon if enabled and data exists
  if (design.generatefavicon !== false && design.favicon && design.favicon.trim() !== '') {
    try {
      console.log('🎨 Writing favicon to public/favicon.ico...');
      console.log('🔍 Favicon path will be:', path.join(publicDir, 'favicon.ico'));
      writeFavicon(targetDir, design.favicon);
      console.log('✅ Favicon written successfully');
      
      // Verify the file was written
      const faviconPath = path.join(publicDir, 'favicon.ico');
      if (fs.existsSync(faviconPath)) {
        const stats = fs.statSync(faviconPath);
        console.log('✅ Favicon file verified, size:', stats.size, 'bytes');
      } else {
        console.error('❌ Favicon file was not created!');
      }
    } catch (error) {
      console.error('❌ Error writing favicon:', error);
    }
  } else {
    console.log('📭 No favicon data found or generation disabled');
    console.log('  - generatefavicon:', design.generatefavicon);
    console.log('  - favicon exists:', !!design.favicon);
    console.log('  - favicon not empty:', design.favicon?.trim() !== '');
  }
  
  // Logo is now handled during logo view creation in pages.ts
  // The logo image gets downloaded during image processing and copied to logo.png during createLogoView()
  console.log('📝 Logo processing is now handled during logo view creation, not in CSS generation');
  
  // Read the global CSS file
  const cssPath = path.join(targetDir, 'src/app/globals.css');
  let cssContent = await fsp.readFile(cssPath, 'utf8');
  
  // Create the font import to insert
  const fontImport = `@import url('https://fonts.googleapis.com/css2?family=${design.textFont || 'Roboto'}&family=${design.titleFont || 'Roboto'}&family=${design.logoFont || 'Roboto'}&display=swap');`;
  
  // Replace the content between the CLAUDE IMPORTS comments
  cssContent = cssContent.replace(
    /\/\* CLAUDE IMPORTS \*\/[\s\S]*?\/\* END CLAUDE IMPORTS \*\//,
    `/* CLAUDE IMPORTS */\n${fontImport}\n/* END CLAUDE IMPORTS */`
  );
  
  // Create the CSS content to insert
  const viewStylesContent = viewStyles.length > 0 ? '\n/* PER-VIEW STYLES */\n' + viewStyles.join('\n') + '\n/* END PER-VIEW STYLES */\n' : '';
  
  const cssToInsert = `
body {
  background: ${design.backgroundColor || 'white'}; 
  color: ${design.textColor || 'black'};
  font-family: ${design.textFont || 'Roboto'}, sans-serif;
  font-size: ${textFontSizeValue};
}

h1 {
  color: ${design.titleColor || 'inherit'};
  font-family: ${design.titleFont || 'Roboto'}, sans-serif;
  font-size: ${titleFontSizeValue};
}

h2 {
  font-size: calc(${titleFontSizeValue} * 0.85);
  font-weight: 800;
}

h3 {
  font-size: calc(${titleFontSizeValue} * 0.7);
  font-weight: 600;
}

button {
  background-color: ${design.accentColor || '#516ab8'};
  color: ${design.accentTextColor || 'white'};
  font-family: ${design.titleFont || 'Roboto'}, sans-serif;
  border-radius: ${buttonBorderRadius};
}

${viewStylesContent}
`;
  // Replace the content between the CLAUDE CSS comments
  cssContent = cssContent.replace(
    /\/\* CLAUDE CSS \*\/[\s\S]*?\/\* END CLAUDE CSS \*\//,
    `/* CLAUDE CSS */${cssToInsert}\n/* END CLAUDE CSS */`
  );
  
  // Write the updated content back to the file
  await fsp.writeFile(cssPath, cssContent, 'utf8');
  console.log('Global CSS updated with design settings');
}
