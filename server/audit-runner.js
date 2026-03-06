const { crawlSite } = require('./crawler');
const { checkPageSpeed } = require('./checks/pagespeed');
const { checkRobotsAI } = require('./checks/robots-ai');
const { analyzeH1Tags } = require('./checks/h1-analysis');
const { analyzeMetaTitles } = require('./checks/meta-titles');
const { analyzeExternalLinks } = require('./checks/external-links');
const { analyzeUrlStructure } = require('./checks/url-structure');
const { checkBrokenLinks } = require('./checks/broken-links');
const { takeScreenshots } = require('./screenshots');

/**
 * Run the full automated audit
 * @param {string} domain - Domain to audit (e.g. "example.com")
 * @param {Function} sendEvent - SSE callback: sendEvent(type, data)
 */
async function runAudit(domain, sendEvent) {
    // Normalize domain
    let baseUrl = domain.trim();
    if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
    baseUrl = baseUrl.replace(/\/+$/, '');

    const results = {
        domain: domain,
        baseUrl: baseUrl,
        pagespeed: null,
        robots: null,
        h1: null,
        metaTitles: null,
        externalLinks: null,
        urlStructure: null,
        brokenLinks: null,
        screenshots: []
    };

    // Step 1: Crawl the site
    sendEvent('progress', { step: 'crawl', status: 'running', message: 'Crawling site...' });
    let pages;
    try {
        pages = await crawlSite(baseUrl, 50, (crawled, queued) => {
            sendEvent('progress', { step: 'crawl', status: 'running', message: `Crawled ${crawled} pages (${queued} in queue)...` });
        });
        sendEvent('progress', { step: 'crawl', status: 'done', message: `Crawled ${pages.length} pages` });
    } catch (err) {
        sendEvent('progress', { step: 'crawl', status: 'error', message: 'Crawl error: ' + err.message });
        pages = [];
    }

    // Step 2: PageSpeed (runs on homepage)
    sendEvent('progress', { step: 'pagespeed', status: 'running', message: 'Running PageSpeed test...' });
    try {
        results.pagespeed = await checkPageSpeed(baseUrl);
        const mobileLow = results.pagespeed.mobile !== null && results.pagespeed.mobile < 50;
        const desktopLow = results.pagespeed.desktop !== null && results.pagespeed.desktop < 50;
        const severity = (mobileLow || desktopLow) ? 'critical' : 'pass';
        sendEvent('result', { step: 'pagespeed', severity, data: results.pagespeed });
    } catch (err) {
        sendEvent('progress', { step: 'pagespeed', status: 'error', message: err.message });
    }

    // Step 3: robots.txt AI check
    sendEvent('progress', { step: 'robots', status: 'running', message: 'Checking robots.txt for AI bots...' });
    try {
        results.robots = await checkRobotsAI(baseUrl);
        const blocked = results.robots.filter(r => r.status === 'blocked').length;
        sendEvent('result', { step: 'robots', severity: blocked > 0 ? 'warning' : 'pass', data: results.robots });
    } catch (err) {
        sendEvent('progress', { step: 'robots', status: 'error', message: err.message });
    }

    // Step 4: H1 analysis (from crawled data)
    sendEvent('progress', { step: 'h1', status: 'running', message: 'Analyzing H1 tags...' });
    try {
        results.h1 = analyzeH1Tags(pages);
        const sev = results.h1.missing.length > 0 ? 'critical' : results.h1.multiple.length > 0 ? 'warning' : 'pass';
        sendEvent('result', { step: 'h1', severity: sev, data: results.h1 });
    } catch (err) {
        sendEvent('progress', { step: 'h1', status: 'error', message: err.message });
    }

    // Step 5: Meta titles (from crawled data)
    sendEvent('progress', { step: 'metaTitles', status: 'running', message: 'Analyzing meta titles...' });
    try {
        results.metaTitles = analyzeMetaTitles(pages);
        const issues = results.metaTitles.tooLong.length + results.metaTitles.missing.length;
        sendEvent('result', { step: 'metaTitles', severity: issues > 0 ? 'warning' : 'pass', data: results.metaTitles });
    } catch (err) {
        sendEvent('progress', { step: 'metaTitles', status: 'error', message: err.message });
    }

    // Step 6: External links (from crawled data)
    sendEvent('progress', { step: 'externalLinks', status: 'running', message: 'Analyzing external links...' });
    try {
        results.externalLinks = analyzeExternalLinks(pages);
        sendEvent('result', { step: 'externalLinks', severity: 'info', data: results.externalLinks });
    } catch (err) {
        sendEvent('progress', { step: 'externalLinks', status: 'error', message: err.message });
    }

    // Step 7: URL structure
    sendEvent('progress', { step: 'urlStructure', status: 'running', message: 'Checking URL structure...' });
    try {
        results.urlStructure = analyzeUrlStructure(pages, baseUrl);
        const urlIssues = results.urlStructure.filter(r => r.severity !== 'pass');
        sendEvent('result', { step: 'urlStructure', severity: urlIssues.length > 0 ? 'critical' : 'pass', data: results.urlStructure });
    } catch (err) {
        sendEvent('progress', { step: 'urlStructure', status: 'error', message: err.message });
    }

    // Step 8: Broken internal links
    sendEvent('progress', { step: 'brokenLinks', status: 'running', message: 'Checking for broken internal links...' });
    try {
        results.brokenLinks = await checkBrokenLinks(pages, baseUrl, (checked, total) => {
            sendEvent('progress', { step: 'brokenLinks', status: 'running', message: `Checked ${checked}/${total} links...` });
        });
        sendEvent('result', { step: 'brokenLinks', severity: results.brokenLinks.length > 0 ? 'critical' : 'pass', data: results.brokenLinks });
    } catch (err) {
        sendEvent('progress', { step: 'brokenLinks', status: 'error', message: err.message });
    }

    // Step 9: Auto-screenshots
    sendEvent('progress', { step: 'screenshots', status: 'running', message: 'Taking screenshots of issues...' });
    try {
        results.screenshots = await takeScreenshots(results, baseUrl);
        sendEvent('result', { step: 'screenshots', severity: 'info', data: { count: results.screenshots.length } });
    } catch (err) {
        sendEvent('progress', { step: 'screenshots', status: 'error', message: 'Screenshots skipped: ' + err.message });
    }

    return results;
}

module.exports = { runAudit };
