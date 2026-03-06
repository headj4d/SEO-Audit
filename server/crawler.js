const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { URL } = require('url');

/**
 * Crawl a site starting from the base URL
 * @param {string} baseUrl - Homepage URL
 * @param {number} maxPages - Maximum pages to crawl
 * @param {Function} onProgress - Callback(crawledCount, queueSize)
 * @returns {Promise<Array>} - Array of page data objects
 */
async function crawlSite(baseUrl, maxPages = 50, onProgress) {
    const visited = new Set();
    const queue = [baseUrl];
    const pages = [];
    const domain = new URL(baseUrl).hostname;

    while (queue.length > 0 && visited.size < maxPages) {
        const currentUrl = queue.shift();

        if (visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        try {
            const res = await fetch(currentUrl, {
                headers: { 'User-Agent': 'SEO-Audit-Agent/1.0 (Compatible)' },
                timeout: 10000
            });

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) continue;

            const html = await res.text();
            const $ = cheerio.load(html);

            // Extract data
            const pageData = {
                url: currentUrl,
                statusCode: res.status,
                title: $('title').text() || '',
                h1s: [],
                links: [],
                externalLinks: []
            };

            // Extract H1s
            $('h1').each((i, el) => {
                pageData.h1s.push($(el).text().trim());
            });

            // Extract Links
            $('a[href]').each((i, el) => {
                const href = $(el).attr('href');
                try {
                    const absoluteUrl = new URL(href, currentUrl).href;
                    const linkDomain = new URL(absoluteUrl).hostname;
                    const rel = $(el).attr('rel') || '';
                    const isDofollow = !rel.toLowerCase().includes('nofollow');

                    if (linkDomain === domain) {
                        // Internal link
                        if (!visited.has(absoluteUrl) && !queue.includes(absoluteUrl)) {
                            // Simple filter to avoid junk
                            if (!absoluteUrl.match(/\.(jpg|jpeg|png|gif|pdf|css|js)$/i)) {
                                queue.push(absoluteUrl);
                            }
                        }
                        pageData.links.push({ url: absoluteUrl, text: $(el).text() });
                    } else {
                        // External link
                        pageData.externalLinks.push({
                            url: absoluteUrl,
                            domain: linkDomain,
                            dofollow: isDofollow
                        });
                    }
                } catch (e) {
                    // Invalid URL, ignore
                }
            });

            pages.push(pageData);
            if (onProgress) onProgress(visited.size, queue.length);

        } catch (err) {
            console.error(`Failed to crawl ${currentUrl}: ${err.message}`);
            // Add failed page so we know it's broken
            pages.push({ url: currentUrl, statusCode: 0, error: err.message, h1s: [], links: [], externalLinks: [] });
        }

        // Polite delay
        await new Promise(r => setTimeout(r, 200));
    }

    return pages;
}

module.exports = { crawlSite };
