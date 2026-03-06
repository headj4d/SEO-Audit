const docx = require('docx');
const fs = require('fs');

async function generateReport(domain, results, clientName, auditorName) {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } = docx;

    function heading(text, level) {
        const levels = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2 };
        return new Paragraph({ text, heading: levels[level] || HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } });
    }

    function para(text, opts = {}) {
        return new Paragraph({
            children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: opts.size })],
            spacing: { after: 120 }
        });
    }

    function bullet(text) {
        return new Paragraph({
            children: [new TextRun({ text })],
            bullet: { level: 0 }
        });
    }

    const children = [];

    // Title Page
    children.push(new Paragraph({ spacing: { before: 2000 } }));
    children.push(new Paragraph({
        children: [new TextRun({ text: 'Technical SEO Audit Report', bold: true, size: 56, color: '4F46E5' })],
        alignment: AlignmentType.CENTER
    }));
    children.push(para(clientName, { size: 36, bold: true, alignment: AlignmentType.CENTER }));
    children.push(para(`Domain: ${domain}`, { size: 24, alignment: AlignmentType.CENTER }));
    children.push(para(`Date: ${new Date().toLocaleDateString()}`, { size: 24, alignment: AlignmentType.CENTER }));

    // PageSpeed
    children.push(new Paragraph({ pageBreakBefore: true }));
    children.push(heading('1. PageSpeed Insights', 1));
    if (results.pagespeed) {
        const s = results.pagespeed;
        const lowScore = (s.mobile !== null && s.mobile < 50) ? s.mobile : (s.desktop !== null && s.desktop < 50) ? s.desktop : null;

        if (lowScore !== null) {
            children.push(para('Unoptimized page speed', { bold: true, size: 28 }));
            children.push(para('Priority: High', { bold: true, color: 'DC2626' }));
            children.push(para(`At the moment your site scores only (${lowScore}) out of 100 on Google’s Page Speed Insight’s test, this is currently negatively impacting both your conversion and organic rankings and we suggest fixing this as soon as possible.`));
        }

        children.push(para(`Mobile Score: ${s.mobile !== null ? s.mobile : 'N/A'}`, { bold: true, color: (s.mobile !== null && s.mobile < 50) ? 'DC2626' : '059669' }));
        children.push(para(`Desktop Score: ${s.desktop !== null ? s.desktop : 'N/A'}`, { bold: true, color: (s.desktop !== null && s.desktop < 50) ? 'DC2626' : '059669' }));
    }

    // H1
    if (results.h1) {
        children.push(heading('2. H1 Tags', 1));

        // Multiple H1 tags SOP
        if (results.h1.multiple.length) {
            children.push(para('Multiple H1 tags', { bold: true, size: 28 }));
            children.push(para('Priority: Warning', { bold: true, color: 'D97706' }));
            children.push(para('One of the top SEO practices for on-page SEO is to always have only ONE H1 tag per page after all H1 tags are one of the top points that give Google the context of your page.'));
            children.push(para(`At the moment, you have (${results.h1.multiple.length}) pages with multiple H1 tags, which is negatively impacting their rankings and organic traffic.`));
            results.h1.multiple.slice(0, 5).forEach(m => children.push(bullet(m.url)));
        }

        // Missing H1 tags SOP
        if (results.h1.missing.length) {
            children.push(para('Missing H1 tags', { bold: true, size: 28 }));
            children.push(para('Priority: High', { bold: true, color: 'DC2626' }));
            children.push(para('H1 heading tags are among the 3 most important on-page factors, as Google directly looks and crawls them to figure out the context of your page.'));
            children.push(para('If you don’t have an H1 heading tag on your page, Google will simply struggle a bit more to understand the topic you’re trying to rank for and thus you’ll rank lower.'));
            children.push(para(`In the case of your website, (${results.h1.missing.length}) pages seem to be missing H1 heading tags, adding them is a great quick-win opportunity.`));
            results.h1.missing.slice(0, 5).forEach(m => children.push(bullet(m.url)));
        }

        if (!results.h1.missing.length && !results.h1.multiple.length) {
            children.push(para('All checked pages have exactly one H1 tag.', { color: '059669' }));
        }
    }

    // Robots
    if (results.robots) {
        children.push(heading('3. Robots.txt AI Bots', 1));
        const blocked = results.robots.filter(r => r.status === 'blocked');
        if (blocked.length) {
            children.push(para(`${blocked.length} AI bots are blocked:`, { color: 'D97706' }));
            blocked.forEach(b => children.push(bullet(b.name)));
        } else {
            children.push(para('All AI bots are allowed.', { color: '059669' }));
        }
    }

    // Meta Titles
    if (results.metaTitles) {
        children.push(heading('4. Meta Titles', 1));
        const issues = results.metaTitles.tooLong;
        if (issues.length) {
            children.push(para('Meta Titles Are Too Long & Unoptimized', { bold: true, size: 28 }));
            children.push(para('Priority: Warning', { bold: true, color: 'D97706' }));
            children.push(para('Meta titles are a critical part of SEO, serving as the first impression in search results. However, meta titles that are too long are a problem, when trying to maximize the visibility of your website.'));
            children.push(para(`Ideally, meta titles should be under 60 characters to display fully in search results. During our review of ${domain}, we found numerous pages exceeding this limit.`));
            children.push(para('Addressing this by shortening and optimizing meta titles presents an opportunity to enhance click-through rates, improve user experience, and boost SEO effectiveness.'));

            children.push(para(`${issues.length} titles are too long (>60 chars):`, { bold: true }));
            issues.slice(0, 5).forEach(m => children.push(bullet(`${m.url} (${m.length} chars)`)));
        } else {
            children.push(para('All titles are optimized.', { color: '059669' }));
        }

        // Duplicate Page Titles SOP
        if (results.metaTitles.duplicates && results.metaTitles.duplicates.length) {
            children.push(para('Duplicated Page Titles', { bold: true, size: 28 }));
            children.push(para('Priority: Warning', { bold: true, color: 'D97706' }));
            children.push(para('Duplicate page titles across multiple pages can confuse search engines and dilute your SEO efforts. When multiple pages have the same title, it becomes challenging for search engines to determine the most relevant page to rank, potentially leading to lower visibility and missed opportunities in search results.'));
            children.push(para(`We noticed more than (${results.metaTitles.duplicates.length}) pages with duplicated titles on the ${domain}. Addressing this by creating unique, descriptive titles for each page is essential to improving search engine clarity, boosting click-through rates, and enhancing overall site optimization.`));

            results.metaTitles.duplicates.slice(0, 5).forEach(d => {
                children.push(para(`Title: "${d.title}"`, { bold: true, margin: { top: 120 } }));
                d.urls.forEach(u => children.push(bullet(u)));
            });
        }
    }

    // Ahrefs: Broken Backlinks
    if (results.brokenBacklinks && results.brokenBacklinks.length) {
        children.push(heading('5. Broken Backlinks (Ahrefs)', 1));
        children.push(para(`${results.brokenBacklinks.length} broken backlinks found pointing to your site. Fixing these or redirecting the targets can recover lost link equity.`, { color: 'DC2626' }));
        results.brokenBacklinks.slice(0, 10).forEach(b => {
            children.push(bullet(`From: ${b.sourceUrl} -> To: ${b.targetUrl}`));
        });
    }

    // Ahrefs: 4xx Pages
    if (results.fourxx && results.fourxx.length) {
        children.push(heading('6. 4xx Broken Pages (Ahrefs)', 1));
        children.push(para(`${results.fourxx.length} internal pages are returning 4xx errors. These should be fixed or redirected to maintain a healthy crawl graph.`, { color: 'DC2626' }));
        results.fourxx.slice(0, 10).forEach(p => {
            children.push(bullet(p.url));
        });
    }

    // Broken Links
    if (results.brokenLinks) {
        children.push(heading('5. Broken Links', 1));
        if (results.brokenLinks.length) {
            children.push(para(`${results.brokenLinks.length} broken links found:`, { color: 'DC2626' }));
            results.brokenLinks.slice(0, 10).forEach(l => children.push(bullet(`${l.url} (${l.statusCode})`)));
        } else {
            children.push(para('No broken internal links found.', { color: '059669' }));
        }
    }

    // URL Structure
    if (results.urlStructure) {
        children.push(heading('6. URL Structure', 1));
        const bad = results.urlStructure.filter(u => u.severity !== 'pass');
        if (bad.length) {
            children.push(para(`${bad.length} URL structure issues found:`, { color: 'DC2626' }));
            bad.slice(0, 5).forEach(u => children.push(bullet(u.url)));
        } else {
            children.push(para('URL structure looks good.', { color: '059669' }));
        }
    }

    // Screenshots
    if (results.screenshots && results.screenshots.length > 0) {
        children.push(new Paragraph({ pageBreakBefore: true }));
        children.push(heading('Screenshots', 1));

        for (const s of results.screenshots) {
            children.push(heading(s.name, 2));
            try {
                const imageBuffer = fs.readFileSync(s.path);
                children.push(new Paragraph({
                    children: [new ImageRun({
                        data: imageBuffer,
                        transformation: { width: 500, height: 300 }
                    })]
                }));
            } catch (e) {
                children.push(para(`[Image missing: ${s.path}]`));
            }
        }
    }

    const doc = new Document({
        sections: [{ properties: {}, children: children }]
    });

    return await Packer.toBuffer(doc);
}

module.exports = { generateReport };
