// Configuration factory
export function createConfig(options) {
    return {
        sitepaige: {
            apiKey: options.apiKey,
            baseUrl: options.baseUrl,
            debug: options.debug || false
        },
        allowedRoots: options.allowedRoots || []
    };
}
//# sourceMappingURL=config.js.map