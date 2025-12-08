
export interface BackgroundOverlay {
  id: string;          // Unique identifier (e.g., 'dots', 'grid')
  name: string;        // Display name
  description: string; // Brief description
  svgTemplate: string; // SVG with {{COLOR}} placeholder
}

export const BACKGROUND_OVERLAYS: BackgroundOverlay[] = [
  {
    id: 'dots',
    name: 'Dots',
    description: 'Subtle dot grid pattern',
    svgTemplate: `<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="1.5" fill="{{COLOR}}"/></svg>`
  },
  {
    id: 'diagonal-lines',
    name: 'Diagonal Lines',
    description: 'Thin diagonal stripes',
    svgTemplate: `<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M-1,5 L5,-1 M-1,21 L21,-1 M11,21 L21,11" stroke="{{COLOR}}" stroke-width="1"/></svg>`
  },
  {
    id: 'grid',
    name: 'Grid',
    description: 'Fine grid mesh pattern',
    svgTemplate: `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M40,0 L0,0 L0,40" fill="none" stroke="{{COLOR}}" stroke-width="1"/></svg>`
  },
  {
    id: 'waves',
    name: 'Waves',
    description: 'Soft wave pattern',
    svgTemplate: `<svg width="100" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M0 10 Q 25 20 50 10 T 100 10" fill="none" stroke="{{COLOR}}" stroke-width="1.5"/></svg>`
  },
  {
    id: 'crosshatch',
    name: 'Crosshatch',
    description: 'Light crosshatch texture',
    svgTemplate: `<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L20,20 M20,0 L0,20" stroke="{{COLOR}}" stroke-width="1"/></svg>`
  },
  {
    id: 'circles',
    name: 'Circles',
    description: 'Concentric circle ripples',
    svgTemplate: `<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="10" fill="none" stroke="{{COLOR}}"/><circle cx="30" cy="30" r="20" fill="none" stroke="{{COLOR}}"/></svg>`
  },
  {
    id: 'noise',
    name: 'Noise',
    description: 'Subtle noise grain texture',
    svgTemplate: `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#noise)" opacity="0.4" fill="{{COLOR}}"/></svg>`
  },
  {
    id: 'geometric',
    name: 'Geometric',
    description: 'Abstract geometric shapes',
    svgTemplate: `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><polygon points="40,10 70,40 40,70 10,40" fill="none" stroke="{{COLOR}}" stroke-width="1.5"/></svg>`
  },
  {
    id: 'hexagons',
    name: 'Hexagons',
    description: 'Honeycomb pattern',
    svgTemplate: `<svg width="56" height="100" xmlns="http://www.w3.org/2000/svg"><path d="M28 0 L56 16.5 L56 49.5 L28 66 L0 49.5 L0 16.5 Z" fill="none" stroke="{{COLOR}}" stroke-width="1"/></svg>`
  }
];

export function getBackgroundOverlay(id: string | null): BackgroundOverlay | undefined {
  if (!id) return undefined;
  return BACKGROUND_OVERLAYS.find(o => o.id === id);
}

