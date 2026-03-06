const fetch = require('node-fetch');

async function checkBrokenLinks(pages, baseUrl, onProgress) {
    const broken = [];
    // Collect all unique internal links found during crawl that weren't visited
    // (The crawler visits max 50 pages, but might have found 1000 links)

    // Actually, strictly internal broken links are those returning 4xx/5xx.
    // The pages array already contains the pages we visited.
    // We can look at pages that failed to load (statusCode != 200)

    pages.forEach(page => {
        if (page.statusCode >= 400 || page.error) {
            broken.push({
                url: page.url,
                statusCode: page.statusCode || 'Error',
                error: page.error,
                source: 'Crawler' // We don't track incoming links easily in this simple BFS to save memory, but could
            });
        }
    });

    // NOTE: A more thorough check would verifying ALL discovered links, 
    // but for a "mini" audit, checking the pages we attempted to crawl is a good start.
    // To be better, let's verify a subset of unvisited links found.

    // Gather all unique links found
    const allLinks = new Set();
    pages.forEach(p => {
        p.links.forEach(l => allLinks.add(l.url));
    });

    // Remove visited ones
    const visited = new Set(pages.map(p => p.url));
    const toCheck = [...allLinks].filter(url => !visited.has(url)).slice(0, 20); // Check 20 extra links for speed

    let checkedCount = 0;
    for (const url of toCheck) {
        try {
            const res = await fetch(url, { method: 'HEAD', timeout: 5000 });
            if (res.status >= 400) {
                broken.push({ url, statusCode: res.status, source: 'Internal Link' });
            }
        } catch (err) {
            broken.push({ url, statusCode: 'Error', error: err.message, source: 'Internal Link' });
        }
        checkedCount++;
        if (onProgress) onProgress(checkedCount, toCheck.length);
    }

    return broken;
}

module.exports = { checkBrokenLinks };
