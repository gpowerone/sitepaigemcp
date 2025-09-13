export async function fetchRemoteBundle(prompt) {
    // The remote bundle generator endpoint is not publicly documented.
    // For now we always use the local mock to synthesize a bundle.
    const debugEnv = process.env.SITEPAIGE_DEBUG;
    const debug = typeof debugEnv === "string" && ["1", "true", "yes", "on"].includes(debugEnv.toLowerCase());
    if (debug) {
        // eslint-disable-next-line no-console
        console.warn("[sitepaige] Using local mock bundle generator. No network calls will be made.");
    }
    return mockRemoteBundle(prompt);
}
export async function mockRemoteBundle(prompt) {
    const title = "Dress Boutique";
    const safePrompt = prompt.slice(0, 200);
    const indexHtml = `<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\"/>\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/>\n  <title>${title}</title>\n  <link rel=\"stylesheet\" href=\"styles.css\"/>\n</head>\n<body>\n  <header><h1>${title}</h1></header>\n  <main>\n    <section class=\"hero\">\n      <p>${safePrompt}</p>\n      <a class=\"cta\" href=\"#shop\">Shop now</a>\n    </section>\n    <section id=\"shop\" class=\"grid\">\n      <article class=\"card\"><img src=\"https://picsum.photos/seed/dress1/400/300\" alt=\"Red Dress\"/><h3>Red Dress</h3><p>$79</p></article>\n      <article class=\"card\"><img src=\"https://picsum.photos/seed/dress2/400/300\" alt=\"Blue Dress\"/><h3>Blue Dress</h3><p>$89</p></article>\n      <article class=\"card\"><img src=\"https://picsum.photos/seed/dress3/400/300\" alt=\"Green Dress\"/><h3>Green Dress</h3><p>$99</p></article>\n    </section>\n  </main>\n  <footer>© ${new Date().getFullYear()} ${title}</footer>\n  <script src=\"script.js\"></script>\n</body>\n</html>`;
    const stylesCss = `:root{--brand:#8a2be2;}*{box-sizing:border-box}body{margin:0;font-family:system-ui,Segoe UI,Roboto,Arial}header{padding:24px;background:var(--brand);color:white}main{padding:24px}.hero{display:grid;gap:12px;align-content:center;min-height:40vh}.cta{display:inline-block;background:black;color:white;padding:12px 16px;text-decoration:none;border-radius:8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card{border:1px solid #eee;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.06)}.card img{width:100%;height:auto;display:block}footer{padding:24px;text-align:center;border-top:1px solid #eee;color:#555}`;
    const scriptJs = `document.querySelectorAll('.card').forEach(c=>c.addEventListener('click',()=>alert('Thanks for your interest!')));`;
    // Simple base64 encoding
    const toB64 = (s) => Buffer.from(s, "utf8").toString("base64");
    const files = [
        { path: "index.html", contentsBase64: toB64(indexHtml) },
        { path: "styles.css", contentsBase64: toB64(stylesCss) },
        { path: "script.js", contentsBase64: toB64(scriptJs) }
    ];
    const manifest = [
        { path: ".", mode: "dir" },
        { path: "index.html", mode: "file", size: Buffer.byteLength(indexHtml, "utf8") },
        { path: "styles.css", mode: "file", size: Buffer.byteLength(stylesCss, "utf8") },
        { path: "script.js", mode: "file", size: Buffer.byteLength(scriptJs, "utf8") }
    ];
    const plan = `# Generation Plan\n\n- Create a simple boutique landing page\n- Include responsive grid of products\n- Provide minimal styling and JS interactivity`;
    await new Promise((r) => setTimeout(r, 300));
    return { plan, manifest, files };
}
//# sourceMappingURL=remote.js.map