export function styleStringToObject(styleStr) {
    const styles = [];
    const parts = styleStr.split(';').filter(p => p.trim());
    for (const part of parts) {
        const [key, ...valParts] = part.split(':');
        if (!key || valParts.length === 0)
            continue;
        const val = valParts.join(':').trim();
        const camelKey = key.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        // Escape single quotes in value
        const safeVal = val.replace(/'/g, "\\'");
        // Check if value is a number (and not a color or string starting with 0 unless it's just 0)
        // But CSS values like '12px' are strings. pure numbers are rare in style strings unless unitless (z-index, opacity).
        // Safer to keep everything as string for now to avoid issues.
        styles.push(`${camelKey}: '${safeVal}'`);
    }
    if (styles.length === 0)
        return "{{}}";
    return `{{ ${styles.join(', ')} }}`;
}
export function convertHtmlToJsx(html) {
    let jsx = html;
    // 1. Self-closing tags
    const voidTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
    for (const tag of voidTags) {
        // Regex matches <tag ... > and replaces with <tag ... />
        // Negative lookahead (?!/) ensures we don't double-close if already closed
        const regex = new RegExp(`<(${tag})\\b([^>]*?)(?<!/)>`, 'gi');
        jsx = jsx.replace(regex, '<$1$2 />');
    }
    // 2. class -> className
    jsx = jsx.replace(/\bclass="/g, 'className="');
    // 3. for -> htmlFor
    jsx = jsx.replace(/\bfor="/g, 'htmlFor="');
    // 4. tabindex -> tabIndex
    jsx = jsx.replace(/\btabindex="/g, 'tabIndex="');
    // 5. contenteditable -> contentEditable
    jsx = jsx.replace(/\bcontenteditable="/g, 'contentEditable="');
    // 6. colspan -> colSpan, rowspan -> rowSpan
    jsx = jsx.replace(/\bcolspan="/g, 'colSpan="');
    jsx = jsx.replace(/\browspan="/g, 'rowSpan="');
    // 7. style="string" -> style={{ object }}
    // We use a callback to process the style string
    jsx = jsx.replace(/\bstyle="([^"]*)"/g, (match, styleStr) => {
        return `style=${styleStringToObject(styleStr)}`;
    });
    // 8. onclick="code" -> onClick={() => { code }}
    // Handles window.postMessage calls mostly
    jsx = jsx.replace(/\bonclick="([^"]*)"/g, (match, code) => {
        // Replace simple window.postMessage calls with safe arrow function wrapper
        return `onClick={() => { ${code} }}`;
    });
    // 9. Comments <!-- --> -> {/* */}
    jsx = jsx.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');
    return jsx;
}
//# sourceMappingURL=html-to-jsx.js.map