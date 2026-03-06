function analyzeUrlStructure(pages, baseUrl) {
    const issues = [];
    const SHOPIFY_REGEX = /\/collections\/[^\/]+\/products\//i;
    const domain = new URL(baseUrl).hostname;

    pages.forEach(page => {
        if (SHOPIFY_REGEX.test(page.url)) {
            // Suggest correction
            let suggestion = '';
            const match = page.url.match(/\/products\/([^\/\?#]+)/);
            if (match) {
                suggestion = `${new URL(page.url).origin}/products/${match[1]}`;
            }

            issues.push({
                url: page.url,
                issue: 'Duplicate URL pattern (/collections/*/products/*)',
                severity: 'critical',
                suggestion: suggestion
            });
        }
    });

    return issues;
}

module.exports = { analyzeUrlStructure };
