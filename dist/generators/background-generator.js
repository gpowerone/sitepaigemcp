import { BACKGROUND_OVERLAYS } from "../constants/backgrounds.js";
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}
function adjustColor(hex, amount) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return hex;
    const r = Math.max(0, Math.min(255, rgb.r + amount));
    const g = Math.max(0, Math.min(255, rgb.g + amount));
    const b = Math.max(0, Math.min(255, rgb.b + amount));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
// Check if color is dark to decide on gradient strategy
function isColorDark(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return false;
    // Relative luminance
    return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 < 0.5;
}
export function generateBackgrounds(design) {
    // Only generate if explicitly requested via heroLayout/designStyle
    const layout = design.heroLayout;
    // Check for 'gradient-hero' or 'centered-simple' which uses overlay
    if (layout !== 'gradient-hero' && layout !== 'centered-simple') {
        return;
    }
    const baseColor = design.backgroundColor || '#ffffff';
    const isDark = isColorDark(baseColor);
    // Generate Gradient if missing and style is gradient-hero
    if (layout === 'gradient-hero' && !design.backgroundGradient) {
        // Shift end color slightly
        // For dark theme: lighter end color? or darker? 
        // Docs: "Slightly shifted version of the base color (preserves contrast)"
        // Docs: "Third Color: The accent color with low opacity for subtle glow effects"
        const shiftAmount = isDark ? 20 : -20;
        const endColor = adjustColor(baseColor, shiftAmount);
        const accentColor = design.accentColor || '#516ab8';
        // Randomly select gradient type
        const rand = Math.random();
        if (rand < 0.5) {
            // Linear (50%)
            // "Vertical direction, solid until 55%, then gradual transition"
            // Angles: [180, 170, 190, 175, 185]
            const angles = [180, 170, 190, 175, 185];
            const angle = angles[Math.floor(Math.random() * angles.length)];
            design.backgroundGradient = `linear-gradient(${angle}deg, ${baseColor} 0%, ${baseColor} 55%, ${endColor} 85%, ${accentColor}15 100%)`;
        }
        else if (rand < 0.75) {
            // Radial (25%)
            // "Ellipse at bottom right, #6366f120 0%, #1e1e38 30%, #1a1a2e 70%"
            design.backgroundGradient = `radial-gradient(ellipse at bottom right, ${accentColor}20 0%, ${endColor} 30%, ${baseColor} 70%)`;
        }
        else {
            // Multi-stop linear (25%)
            // "Solid at top, gentle transition in lower half"
            design.backgroundGradient = `linear-gradient(180deg, ${baseColor} 0%, ${baseColor} 50%, ${endColor} 80%, ${accentColor}12 100%)`;
        }
    }
    // Generate Overlay if missing (for both gradient-hero and centered-simple)
    if (!design.backgroundOverlay) {
        // "Random selection from available patterns"
        const randomOverlay = BACKGROUND_OVERLAYS[Math.floor(Math.random() * BACKGROUND_OVERLAYS.length)];
        design.backgroundOverlay = randomOverlay.id;
    }
}
//# sourceMappingURL=background-generator.js.map