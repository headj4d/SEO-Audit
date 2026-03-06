const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function takeScreenshots(auditResults, baseUrl) {
    const screenshots = [];
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process'
        ]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const tempDir = path.join(__dirname, '../temp-screenshots', new URL(baseUrl).hostname);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // Helper to take screenshot
    async function capture(url, name, category) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

            // Highlight element if needed? For now just full page or top fold

            const filename = `${category}_${Date.now()}.jpg`;
            const filepath = path.join(tempDir, filename);

            await page.screenshot({ path: filepath, type: 'jpeg', quality: 80 });

            screenshots.push({
                id: filename,
                name: name,
                category: category,
                path: filepath,
                url: url
            });
        } catch (err) {
            console.error(`Screenshot failed for ${url}: ${err.message}`);
        }
    }

    // 1. PageSpeed (Homepage) if critical
    if (auditResults.pagespeed.mobile < 50) {
        await capture(baseUrl, 'Low PageSpeed Score', 'pagespeed');
    }

    // 2. Broken Links (Sample 1)
    if (auditResults.brokenLinks.length > 0) {
        const broken = auditResults.brokenLinks[0];
        // We can't screenshot a 404 page easily as it might not render content, but let's try
        // Or screenshot the source page? We don't have source info easily for all.
        // Let's screenshot the broken link target to show the error page
        await captures(broken.url, `Broken Link (${broken.statusCode})`, 'broken-links');
    }

    // 3. Shopify URL Structure (Sample 1)
    const badUrls = auditResults.urlStructure.filter(u => u.severity === 'critical');
    if (badUrls.length > 0) {
        await capture(badUrls[0].url, 'Incorrect URL Structure', 'shopify-urls');
    }

    // 4. Missing H1 (Sample 1)
    if (auditResults.h1 && auditResults.h1.missing.length > 0) {
        await capture(auditResults.h1.missing[0].url, 'Missing H1 Tag', 'h1-missing');
    }

    await browser.close();
    return screenshots;
}

module.exports = { takeScreenshots };
