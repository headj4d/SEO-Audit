const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { URL } = require('url');

/**
 * Crawls a website to find images missing alt text
 * @param {string} baseUrl - The domain/homepage to start from
 * @param {Function} onProgress - Callback to report progress via SSE
 * @returns {Promise<Object>} - Object with missing alt results
 */
async function checkMissingAlt(baseUrl, onProgress) {
    const maxPages = 50; // Sensible limit to prevent infinite crawls
    const visited = new Set();
    const queue = [baseUrl];
    const initialUrlInfo = new URL(baseUrl);
    const domain = initialUrlInfo.hostname;

    const results = {
        domain: domain,
        pagesChecked: 0,
        totalImages: 0,
        missingAltCount: 0,
        affectedPagesCount: 0,
        groupedIssues: [] 
    };

    const duplicateCheck = new Set();
    const affectedPages = new Set();
    const pageIssuesMap = {};

    while (queue.length > 0 && visited.size < maxPages) {
        const currentUrl = queue.shift();

        // Normalize URL to avoid duplicates with/without trailing slash
        const normalizedUrl = currentUrl.endsWith('/') && currentUrl.length > 1 ? currentUrl.slice(0, -1) : currentUrl;

        if (visited.has(normalizedUrl)) continue;
        visited.add(normalizedUrl);
        
        onProgress({ 
            step: 'crawling', 
            message: `Crawling ${currentUrl}... (${visited.size}/${maxPages})`,
            crawled: visited.size,
            queue: queue.length
        });

        try {
            const res = await fetch(currentUrl, {
                headers: { 'User-Agent': 'SEO-Audit-Agent/1.0 (Compatible)' },
                timeout: 10000
            });

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) continue;

            const html = await res.text();
            const $ = cheerio.load(html);

            // 1. Process Links for Crawling Queue
            $('a[href]').each((i, el) => {
                const href = $(el).attr('href');
                try {
                    const absoluteUrl = new URL(href, currentUrl).href;
                    const linkDomain = new URL(absoluteUrl).hostname;
                    
                    if (linkDomain === domain) {
                        const noHash = absoluteUrl.split('#')[0];
                        const normalizedAbsoluteUrl = noHash.endsWith('/') && noHash.length > 1 ? noHash.slice(0, -1) : noHash;

                        if (!visited.has(normalizedAbsoluteUrl) && !queue.includes(normalizedAbsoluteUrl)) {
                            // Ignore common non-html files
                            if (!normalizedAbsoluteUrl.match(/\.(jpg|jpeg|png|gif|pdf|css|js|svg|zip)$/i)) {
                                queue.push(normalizedAbsoluteUrl);
                            }
                        }
                    }
                } catch (e) {
                    // Invalid URL
                }
            });

            // 2. Process Images for Missing Alt Text
            $('img').each((i, el) => {
                results.totalImages++;
                
                let src = $(el).attr('src') || $(el).attr('data-src') || '';
                if (!src) return; // Ignore if no src at all

                try {
                    src = new URL(src, currentUrl).href;
                } catch(e) {
                    // Invalid src, keep original
                }

                const altAttr = $(el).attr('alt');
                let isMissing = false;
                let altValue = '';
                let statusMsg = '';

                if (altAttr === undefined) {
                    isMissing = true;
                    altValue = 'Missing attribute';
                    statusMsg = 'Image tag is missing the alt attribute entirely';
                } else if (altAttr.trim() === '') {
                    isMissing = true;
                    altValue = 'Empty string';
                    statusMsg = 'Alt attribute is present but empty';
                }

                if (isMissing) {
                    const issueHash = `${currentUrl}::${src}`;
                    if (!duplicateCheck.has(issueHash)) {
                        duplicateCheck.add(issueHash);
                        affectedPages.add(currentUrl);
                        
                        results.missingAltCount++;

                        if (!pageIssuesMap[currentUrl]) {
                            pageIssuesMap[currentUrl] = {
                                pageUrl: currentUrl,
                                imageCount: 0,
                                affectedImages: [],
                                status: 'ISSUE',
                                message: 'Page contains images with missing alt text'
                            };
                        }

                        pageIssuesMap[currentUrl].imageCount++;
                        pageIssuesMap[currentUrl].affectedImages.push({
                            imageUrl: src,
                            altStatus: 'ISSUE',
                            details: altValue,
                            message: statusMsg
                        });
                    }
                }
            });

        } catch (err) {
            console.error(`Failed to crawl ${currentUrl} for missing alt: ${err.message}`);
        }

        // Polite delay
        await new Promise(r => setTimeout(r, 200));
    }

    results.pagesChecked = visited.size;
    results.affectedPagesCount = affectedPages.size;
    results.groupedIssues = Object.values(pageIssuesMap);

    return results;
}

module.exports = {
    checkMissingAlt
};
