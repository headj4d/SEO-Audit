function analyzeExternalLinks(pages) {
    const dofollow = [];
    const seen = new Set();

    pages.forEach(page => {
        if (page.externalLinks) {
            page.externalLinks.forEach(link => {
                if (link.dofollow && !seen.has(link.domain)) {
                    seen.add(link.domain);
                    dofollow.push({
                        domain: link.domain,
                        url: link.url,
                        source: page.url,
                        type: 'dofollow'
                    });
                }
            });
        }
    });

    return { all: dofollow };
}

module.exports = { analyzeExternalLinks };
