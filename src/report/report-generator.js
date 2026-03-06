/* ============================================
   REPORT GENERATOR
   Generates .docx report for Google Docs
   ============================================ */
var ReportGenerator = {
    generate: function () {
        var domain = document.getElementById('audit-domain').value || 'Unknown Domain';
        var client = document.getElementById('report-client').value || domain;
        var auditor = document.getElementById('report-auditor').value || 'SEO Auditor';
        var dateVal = document.getElementById('report-date').value;
        var auditDate = dateVal ? new Date(dateVal).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        var D = docx;
        var children = [];

        // Helper functions
        function heading(text, level) {
            var headingMap = { 1: D.HeadingLevel.HEADING_1, 2: D.HeadingLevel.HEADING_2, 3: D.HeadingLevel.HEADING_3 };
            return new D.Paragraph({ text: text, heading: headingMap[level] || D.HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } });
        }

        function para(text, opts) {
            opts = opts || {};
            return new D.Paragraph({
                children: [new D.TextRun({ text: text, bold: opts.bold || false, color: opts.color, size: opts.size })],
                spacing: { after: 120 }
            });
        }

        function bullet(text, level) {
            return new D.Paragraph({
                children: [new D.TextRun({ text: text })],
                bullet: { level: level || 0 },
                spacing: { after: 60 }
            });
        }

        function severityText(sev) {
            if (sev === 'critical') return '🔴 CRITICAL';
            if (sev === 'warning') return '🟡 WARNING';
            if (sev === 'pass') return '🟢 PASS';
            return '🔵 INFO';
        }

        // ===== TITLE PAGE =====
        children.push(new D.Paragraph({ spacing: { before: 2000 } }));
        children.push(new D.Paragraph({
            children: [new D.TextRun({ text: 'Technical SEO Audit Report', bold: true, size: 56, color: '4F46E5' })],
            alignment: D.AlignmentType.CENTER
        }));
        children.push(new D.Paragraph({
            children: [new D.TextRun({ text: client, bold: true, size: 36 })],
            alignment: D.AlignmentType.CENTER, spacing: { before: 200 }
        }));
        children.push(new D.Paragraph({
            children: [new D.TextRun({ text: 'Prepared by: ' + auditor, size: 24, color: '6B7280' })],
            alignment: D.AlignmentType.CENTER, spacing: { before: 400 }
        }));
        children.push(new D.Paragraph({
            children: [new D.TextRun({ text: 'Date: ' + auditDate, size: 24, color: '6B7280' })],
            alignment: D.AlignmentType.CENTER, spacing: { before: 100 }
        }));
        children.push(new D.Paragraph({
            children: [new D.TextRun({ text: 'Domain: ' + domain, size: 24, color: '6B7280' })],
            alignment: D.AlignmentType.CENTER, spacing: { before: 100 }
        }));

        // ===== EXECUTIVE SUMMARY =====
        children.push(new D.Paragraph({ pageBreakBefore: true }));
        children.push(heading('Executive Summary', 1));

        var checks = AuditState.checks;
        var critCount = 0, warnCount = 0, passCount = 0;
        Object.keys(checks).forEach(function (k) {
            if (checks[k].severity === 'critical') critCount++;
            else if (checks[k].severity === 'warning') warnCount++;
            else if (checks[k].severity === 'pass') passCount++;
        });

        children.push(para('This report summarizes the technical SEO audit findings for ' + domain + '.'));
        children.push(bullet(critCount + ' Critical Issues', 0));
        children.push(bullet(warnCount + ' Warnings', 0));
        children.push(bullet(passCount + ' Checks Passed', 0));
        children.push(bullet(ScreenshotsModule.screenshots.length + ' Evidence Screenshots', 0));

        // ===== PAGESPEED =====
        var ps = PageSpeedModule.getFindings();
        if (ps) {
            children.push(heading('1. PageSpeed Insights', 1));
            children.push(para('Status: ' + severityText(ps.severity), { bold: true }));
            children.push(para('URL tested: ' + ps.data.url));
            children.push(bullet('Mobile Score: ' + (ps.data.mobile !== null ? ps.data.mobile : 'N/A') + (ps.data.mobile < 50 ? ' ⚠ Below threshold' : ''), 0));
            children.push(bullet('Desktop Score: ' + (ps.data.desktop !== null ? ps.data.desktop : 'N/A') + (ps.data.desktop < 50 ? ' ⚠ Below threshold' : ''), 0));
            if (ps.severity === 'critical') {
                children.push(para('Recommendation: Pages scoring below 50 need immediate performance optimization. Focus on reducing unused JavaScript, optimizing images, and implementing lazy loading.', { color: 'DC2626' }));
            }
        }

        // ===== H1 TAGS =====
        var h1 = H1CheckerModule.getFindings();
        if (h1) {
            children.push(heading('2. H1 Tag Analysis', 1));
            children.push(para('Status: ' + severityText(h1.severity), { bold: true }));
            if (h1.data.missing.length > 0) {
                children.push(heading('Missing H1 Tags (' + h1.data.missing.length + ' pages)', 2));
                h1.data.missing.slice(0, 20).forEach(function (item) {
                    children.push(bullet(item.url, 0));
                });
                if (h1.data.missing.length > 20) children.push(para('... and ' + (h1.data.missing.length - 20) + ' more'));
                children.push(para('Recommendation: Every page should have exactly one H1 tag that clearly describes the page content and includes relevant keywords.', { color: 'DC2626' }));
            }
            if (h1.data.multiple.length > 0) {
                children.push(heading('Multiple H1 Tags (' + h1.data.multiple.length + ' pages)', 2));
                h1.data.multiple.slice(0, 20).forEach(function (item) {
                    children.push(bullet(item.url + ' (' + item.count + ' H1s)', 0));
                });
                children.push(para('Recommendation: Each page should have only one H1 tag. Consolidate multiple H1s into a single, descriptive heading.'));
            }
            if (h1.data.missing.length === 0 && h1.data.multiple.length === 0) {
                children.push(para('All pages have exactly one H1 tag. No issues found.'));
            }
        }

        // ===== ROBOTS.TXT / AI BOTS =====
        var robots = RobotsAIModule.getFindings();
        if (robots) {
            children.push(heading('3. AI Bots / LLMs in robots.txt', 1));
            children.push(para('Status: ' + severityText(robots.severity), { bold: true }));
            var blocked = robots.data.filter(function (r) { return r.status === 'blocked'; });
            var allowed = robots.data.filter(function (r) { return r.status === 'allowed'; });
            if (blocked.length > 0) {
                children.push(heading('Blocked AI Bots (' + blocked.length + ')', 2));
                blocked.forEach(function (b) { children.push(bullet(b.name + ' (' + b.label + ')', 0)); });
                children.push(para('Recommendation: Consider whether blocking these AI crawlers aligns with your visibility goals. Blocking AI bots may reduce your presence in AI-powered search results and chatbot answers.'));
            }
            if (allowed.length > 0) {
                children.push(heading('Allowed AI Bots (' + allowed.length + ')', 2));
                allowed.forEach(function (b) { children.push(bullet(b.name + ' (' + b.label + ')', 0)); });
            }
        }

        // ===== META TITLES =====
        var meta = MetaTitlesModule.getFindings();
        if (meta) {
            children.push(heading('4. Meta Titles Analysis', 1));
            children.push(para('Status: ' + severityText(meta.severity), { bold: true }));
            children.push(para('Total pages analyzed: ' + meta.data.total));
            if (meta.data.tooLong.length > 0) {
                children.push(heading('Titles Too Long - >' + SEO_CONSTANTS.TITLE_MAX_LENGTH + ' chars (' + meta.data.tooLong.length + ')', 2));
                meta.data.tooLong.slice(0, 15).forEach(function (item) {
                    children.push(bullet(item.url + ' — "' + item.title + '" (' + item.length + ' chars)', 0));
                });
                children.push(para('Recommendation: Keep title tags under 60 characters to prevent truncation in search results. Include primary keywords near the beginning of the title.'));
            }
            if (meta.data.missing.length > 0) {
                children.push(heading('Missing Titles (' + meta.data.missing.length + ')', 2));
                meta.data.missing.slice(0, 15).forEach(function (item) { children.push(bullet(item.url, 0)); });
            }
        }

        // ===== EXTERNAL DOMAINS =====
        var ext = ExternalDomainsModule.getFindings();
        if (ext) {
            children.push(heading('5. External Do-Follow Domains', 1));
            children.push(para('Status: ' + severityText(ext.severity), { bold: true }));
            if (ext.data.flagged.length > 0) {
                children.push(heading('Flagged Irrelevant Domains (' + ext.data.flagged.length + ')', 2));
                ext.data.flagged.forEach(function (d) { children.push(bullet(d.domain + ' (' + d.links + ' links)', 0)); });
                children.push(para('Recommendation: Review and remove or nofollow links to irrelevant external domains. Linking to low-quality or irrelevant sites can dilute your site\'s authority.'));
            } else {
                children.push(para('No irrelevant do-follow external domains were flagged.'));
            }
        }

        // ===== SHOPIFY URLS =====
        var shopify = ShopifyUrlsModule.getFindings();
        if (shopify) {
            children.push(heading('6. URL Structure (Shopify)', 1));
            children.push(para('Status: ' + severityText(shopify.severity), { bold: true }));
            var issues = shopify.data.filter(function (r) { return r.severity !== 'pass'; });
            if (issues.length > 0) {
                issues.forEach(function (item) {
                    children.push(bullet('Issue: ' + item.url, 0));
                    children.push(bullet(item.issue, 1));
                    if (item.suggestion) children.push(bullet('Correct URL: ' + item.suggestion, 1));
                });
                children.push(para('Recommendation: Shopify creates duplicate product URLs when accessed through collections (/collections/*/products/*). Ensure canonical tags point to the /products/ version. Consider updating internal links to use the canonical /products/ URL structure to avoid duplicate content issues.', { color: 'DC2626' }));
            } else {
                children.push(para('All checked URLs have correct structure.'));
            }
        }

        // ===== BROKEN LINKS =====
        var broken = BrokenLinksModule.getFindings();
        if (broken) {
            if (broken.backlinks) {
                children.push(heading('7. Broken Backlinks', 1));
                children.push(para('Status: ' + severityText(broken.backlinks.severity), { bold: true }));
                if (broken.backlinks.data.length > 0) {
                    children.push(para(broken.backlinks.data.length + ' broken backlinks found:'));
                    broken.backlinks.data.slice(0, 20).forEach(function (item) {
                        children.push(bullet(item.targetUrl + ' (Status: ' + (item.statusCode || 'N/A') + ')', 0));
                        if (item.sourceUrl) children.push(bullet('Source: ' + item.sourceUrl, 1));
                    });
                    children.push(para('Recommendation: Set up 301 redirects for broken URLs that have valuable backlinks. This recovers lost link equity and improves user experience.'));
                }
            }
            if (broken.fourxx) {
                children.push(heading('8. 4xx Broken Pages', 1));
                children.push(para('Status: ' + severityText(broken.fourxx.severity), { bold: true }));
                if (broken.fourxx.data.length > 0) {
                    children.push(para(broken.fourxx.data.length + ' pages returning 4xx errors:'));
                    broken.fourxx.data.slice(0, 20).forEach(function (item) {
                        children.push(bullet(item.url + ' (HTTP ' + (item.statusCode || '4xx') + ')', 0));
                    });
                    children.push(para('Recommendation: Fix or redirect all 4xx pages. Broken pages waste crawl budget and create poor user experiences. Implement 301 redirects to relevant pages or return proper 410 (Gone) status codes for permanently removed content.'));
                }
            }
        }

        // ===== SCREENSHOTS =====
        var screenshots = ScreenshotsModule.getFindings();
        if (screenshots && screenshots.length > 0) {
            children.push(heading('Evidence Screenshots', 1));
            children.push(para('The following screenshots document the issues found during this audit:'));
            screenshots.forEach(function (s, i) {
                var catLabel = SEO_CONSTANTS.CATEGORIES.find(function (c) { return c.value === s.category; });
                children.push(heading('Screenshot ' + (i + 1) + ': ' + (catLabel ? catLabel.label : s.category), 3));
                // Embed image
                try {
                    var base64 = s.dataUrl.split(',')[1];
                    var imgType = s.dataUrl.split(';')[0].split('/')[1];
                    children.push(new D.Paragraph({
                        children: [new D.ImageRun({
                            data: Uint8Array.from(atob(base64), function (c) { return c.charCodeAt(0); }),
                            transformation: { width: 500, height: 300 },
                            type: imgType === 'png' ? D.ImageType.PNG : D.ImageType.JPEG
                        })],
                        spacing: { after: 100 }
                    }));
                } catch (e) {
                    children.push(para('[Screenshot: ' + s.name + ']'));
                }
                if (s.notes) children.push(para('Notes: ' + s.notes));
            });
        }

        // Build document
        var doc = new D.Document({
            sections: [{ properties: {}, children: children }],
            styles: {
                default: {
                    document: { run: { font: 'Calibri', size: 22 } }
                }
            }
        });

        // Generate and download
        D.Packer.toBlob(doc).then(function (blob) {
            var fileName = 'SEO_Audit_' + domain.replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.docx';
            saveAs(blob, fileName);
            App.showToast('Report downloaded as ' + fileName, 'success');
        });
    }
};
