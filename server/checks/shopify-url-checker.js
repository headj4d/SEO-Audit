const fetch = require('node-fetch');
const cheerio = require('cheerio');

const MAX_COLLECTION_PAGES = 30;
const FETCH_TIMEOUT = 12000;

// Patterns to skip
const SKIP_PATHS = /\/(cart|checkout|account|search|policies|blogs|pages|admin|login|register|password|wishlist|contact)/i;
const COLLECTION_PATH_RE = /\/collections\/([^\/\?#]+)/i;
const BAD_URL_RE = /\/collections\/[^\/]+\/products\/[^\/\?#]+/i;

/**
 * Fetches a URL and returns cheerio-parsed HTML.
 */
async function fetchPage(url) {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: FETCH_TIMEOUT,
        redirect: 'follow'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return cheerio.load(html);
}

/**
 * Extract all same-origin absolute hrefs from a page.
 */
function extractInternalLinks($, baseUrl) {
    const origin = new URL(baseUrl).origin;
    const links = new Set();
    $('a[href]').each((_, el) => {
        let href = $(el).attr('href');
        if (!href) return;
        href = href.split('#')[0].trim();
        if (!href) return;
        try {
            const abs = new URL(href, baseUrl).href;
            if (abs.startsWith(origin)) links.add(abs);
        } catch (_) {}
    });
    return [...links];
}

/**
 * Detect Shopify signals in HTML.
 */
function detectShopify($, links) {
    const html = $.html().toLowerCase();
    const signals = [];
    if (html.includes('cdn.shopify.com')) signals.push('cdn.shopify.com');
    if (html.includes('shopify.theme')) signals.push('Shopify.theme');
    if (html.includes('myshopify.com')) signals.push('myshopify.com');
    if (html.includes('shopify-section')) signals.push('shopify-section');
    const hasCollections = links.some(l => /\/collections\//i.test(l));
    if (hasCollections) signals.push('/collections/ links');
    return signals;
}

/**
 * Try to discover collection URLs from sitemap.
 */
async function discoverFromSitemap(baseUrl) {
    const origin = new URL(baseUrl).origin;
    const urls = new Set();

    // Try Shopify-specific collection sitemap first, then generic
    const sitemapUrls = [
        origin + '/sitemap_collections_1.xml',
        origin + '/sitemap.xml'
    ];

    for (const smUrl of sitemapUrls) {
        try {
            const res = await fetch(smUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)' },
                timeout: 8000,
                redirect: 'follow'
            });
            if (!res.ok) continue;
            const xml = await res.text();
            const $ = cheerio.load(xml, { xmlMode: true });
            $('loc').each((_, el) => {
                const loc = $(el).text().trim();
                if (COLLECTION_PATH_RE.test(loc) && !SKIP_PATHS.test(loc)) {
                    urls.add(loc);
                }
            });
            if (urls.size > 0) break; // Got collections, stop
        } catch (_) {}
    }
    return [...urls];
}

/**
 * Filter links to find unique collection page URLs worth checking.
 */
function filterCollectionLinks(links) {
    const seen = new Set();
    return links.filter(link => {
        if (SKIP_PATHS.test(link)) return false;
        const match = link.match(COLLECTION_PATH_RE);
        if (!match) return false;
        const handle = match[1].toLowerCase();
        // Skip "all" as it's just a catch-all page
        if (handle === 'all') return false;
        // Skip pagination/filtering variants
        if (/[?&](page|sort_by|filter)/i.test(link)) return false;
        // Skip links that ARE product links within collections
        if (BAD_URL_RE.test(link)) return false;
        // Deduplicate by handle
        if (seen.has(handle)) return false;
        seen.add(handle);
        return true;
    });
}

/**
 * Main entry: crawl a domain and check for Shopify URL issues.
 * @param {string} url - Homepage/domain URL
 * @param {function} onProgress - callback(eventData) for progress updates
 * @returns {Promise<object>} - Full results
 */
async function checkShopifyUrls(url, onProgress) {
    if (!url.startsWith('http')) url = 'https://' + url;
    // Normalize to origin
    const origin = new URL(url).origin;
    const homepageUrl = origin + '/';

    const progress = (msg, data) => {
        if (onProgress) onProgress({ message: msg, ...data });
    };

    // --- Step 1: Fetch homepage ---
    progress('Fetching homepage...', { phase: 'homepage' });
    let $home;
    try {
        $home = await fetchPage(homepageUrl);
    } catch (err) {
        return {
            url: homepageUrl,
            isShopify: false,
            shopifySignals: [],
            collectionPagesChecked: 0,
            problematicUrls: [],
            collectionResults: [],
            message: 'Could not fetch homepage: ' + err.message,
            status: 'error'
        };
    }

    // --- Step 2: Extract links & detect Shopify ---
    const homepageLinks = extractInternalLinks($home, homepageUrl);
    const shopifySignals = detectShopify($home, homepageLinks);
    const isShopify = shopifySignals.length > 0;

    progress('Detected ' + shopifySignals.length + ' Shopify signals', {
        phase: 'detection',
        shopifySignals,
        isShopify
    });

    // --- Step 3: Discover collection pages ---
    progress('Discovering collection pages...', { phase: 'discovery' });

    // From homepage links
    let collectionUrls = filterCollectionLinks(homepageLinks);

    // Also try sitemap
    const sitemapCollections = await discoverFromSitemap(homepageUrl);
    const fromSitemap = filterCollectionLinks(sitemapCollections);

    // Merge, deduplicate by handle
    const seenHandles = new Set(collectionUrls.map(u => {
        const m = u.match(COLLECTION_PATH_RE);
        return m ? m[1].toLowerCase() : '';
    }));

    fromSitemap.forEach(u => {
        const m = u.match(COLLECTION_PATH_RE);
        const handle = m ? m[1].toLowerCase() : '';
        if (!seenHandles.has(handle)) {
            seenHandles.add(handle);
            collectionUrls.push(u);
        }
    });

    // If no collections found and not Shopify
    if (collectionUrls.length === 0 && !isShopify) {
        return {
            url: homepageUrl,
            isShopify: false,
            shopifySignals,
            collectionPagesChecked: 0,
            problematicUrls: [],
            collectionResults: [],
            message: 'Shopify collection structure not detected',
            status: 'not-shopify'
        };
    }

    if (collectionUrls.length === 0) {
        return {
            url: homepageUrl,
            isShopify,
            shopifySignals,
            collectionPagesChecked: 0,
            problematicUrls: [],
            collectionResults: [],
            message: 'No collection pages detected',
            status: 'no-collections'
        };
    }

    // Limit pages
    collectionUrls = collectionUrls.slice(0, MAX_COLLECTION_PAGES);

    progress('Found ' + collectionUrls.length + ' collection pages to check', {
        phase: 'crawling',
        totalPages: collectionUrls.length
    });

    // --- Step 4: Crawl each collection page ---
    const collectionResults = [];
    const allProblematicUrls = new Set();

    for (let i = 0; i < collectionUrls.length; i++) {
        const colUrl = collectionUrls[i];
        const handleMatch = colUrl.match(COLLECTION_PATH_RE);
        const handle = (handleMatch && handleMatch[1]) || 'unknown';

        progress('Checking collection: /' + handle + ' (' + (i + 1) + '/' + collectionUrls.length + ')', {
            phase: 'checking',
            current: i + 1,
            total: collectionUrls.length,
            collectionUrl: colUrl
        });

        try {
            const $col = await fetchPage(colUrl);
            const pageLinks = extractInternalLinks($col, colUrl);

            // Find problematic URLs on this page
            const badUrls = [];
            pageLinks.forEach(link => {
                if (BAD_URL_RE.test(link)) {
                    // Normalize: remove trailing slash, query, hash
                    let normalized = link.split('?')[0].split('#')[0].replace(/\/$/, '');
                    if (!badUrls.includes(normalized)) {
                        badUrls.push(normalized);
                        allProblematicUrls.add(normalized);
                    }
                }
            });

            collectionResults.push({
                collectionUrl: colUrl,
                collectionHandle: handle,
                status: badUrls.length > 0 ? 'issue' : 'pass',
                problematicUrls: badUrls,
                totalLinksChecked: pageLinks.length,
                message: badUrls.length > 0
                    ? 'Unoptimized Shopify URL structure found'
                    : 'No unoptimized Shopify URL structure found'
            });

        } catch (err) {
            collectionResults.push({
                collectionUrl: colUrl,
                collectionHandle: handle,
                status: 'error',
                problematicUrls: [],
                totalLinksChecked: 0,
                message: 'Could not fetch page: ' + err.message
            });
        }
    }

    // --- Step 5: Build final result ---
    const issuePages = collectionResults.filter(r => r.status === 'issue').length;
    const passPages = collectionResults.filter(r => r.status === 'pass').length;

    let overallStatus = 'pass';
    let overallMessage = 'No unoptimized Shopify URL structure found on checked collection pages';
    if (allProblematicUrls.size > 0) {
        overallStatus = 'warning';
        overallMessage = allProblematicUrls.size + ' unoptimized Shopify URL(s) found across ' + issuePages + ' collection page(s)';
    }

    return {
        url: homepageUrl,
        isShopify,
        shopifySignals,
        collectionPagesChecked: collectionResults.length,
        collectionPagesWithIssues: issuePages,
        collectionPagesClean: passPages,
        uniqueProblematicUrls: allProblematicUrls.size,
        problematicUrls: [...allProblematicUrls],
        collectionResults,
        message: overallMessage,
        status: overallStatus
    };
}

module.exports = { checkShopifyUrls };
