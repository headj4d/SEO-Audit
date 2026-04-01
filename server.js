const express = require('express');
const path = require('path');
const { runAudit } = require('./server/audit-runner');
const { generateReport } = require('./server/report');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Store active audit results for report download
const auditResults = new Map();

// ===== SSE AUDIT ENDPOINT =====
app.get('/api/audit', (req, res) => {
    const domain = req.query.domain;
    if (!domain) {
        return res.status(400).json({ error: 'domain parameter required' });
    }

    // Setup SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const auditId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    function sendEvent(type, data) {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    }

    sendEvent('started', { auditId, domain, message: 'Audit started for ' + domain });

    // Run the audit
    runAudit(domain, sendEvent)
        .then(results => {
            auditResults.set(auditId, { domain, results, timestamp: Date.now() });
            sendEvent('complete', { auditId, message: 'Audit complete!' });
            res.end();

            // Clean up old results after 1 hour
            setTimeout(() => auditResults.delete(auditId), 3600000);
        })
        .catch(err => {
            sendEvent('error', { message: err.message });
            res.end();
        });

    // Handle client disconnect
    req.on('close', () => {
        // Client disconnected
    });
});

// ===== IMPORT AUDIT (Manual Results) =====
app.post('/api/import-audit', (req, res) => {
    const { results } = req.body;
    if (!results) {
        return res.status(400).json({ error: 'Results data required' });
    }

    const auditId = 'imported_' + Date.now().toString(36);
    auditResults.set(auditId, {
        domain: results.domain || 'Imported Site',
        results: results,
        timestamp: Date.now()
    });

    res.json({ auditId, message: 'Audit results imported successfully' });

    // Clean up after 1 hour
    setTimeout(() => auditResults.delete(auditId), 3600000);
});

// ===== REPORT DOWNLOAD =====
app.get('/api/report/:id', async (req, res) => {
    const audit = auditResults.get(req.params.id);
    if (!audit) {
        return res.status(404).json({ error: 'Audit not found or expired' });
    }

    try {
        const clientName = req.query.client || audit.domain;
        const auditorName = req.query.auditor || 'SEO Auditor';

        const buffer = await generateReport(audit.domain, audit.results, clientName, auditorName);
        const filename = `SEO_Audit_${audit.domain.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: 'Report generation failed: ' + err.message });
    }
});

// ===== ROBOTS.TXT PROXY CHECK =====
app.get('/api/check-robots', async (req, res) => {
    let siteUrl = req.query.url;
    if (!siteUrl) return res.status(400).json({ error: 'url parameter required' });

    try {
        const { checkRobotsAI } = require('./server/checks/robots-ai');
        const result = await checkRobotsAI(siteUrl);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== SCHEMA VALIDATION ENDPOINT =====
app.post('/api/check-schema', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url in body required' });

    try {
        const { validateSchema } = require('./server/checks/schema-validator');
        const result = await validateSchema(url);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== PAGESPEED INSIGHTS API =====
app.get('/api/pagespeed', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'url parameter required' });

    try {
        const { fetchPSI, processResult } = require('./server/checks/pagespeed-insights');

        // Run mobile and desktop in parallel
        const [mobileRaw, desktopRaw] = await Promise.all([
            fetchPSI(url, 'mobile'),
            fetchPSI(url, 'desktop')
        ]);

        const mobile = processResult(mobileRaw);
        const desktop = processResult(desktopRaw);

        res.json({
            url,
            finalUrl: mobile.finalUrl || desktop.finalUrl || url,
            timestamp: mobile.timestamp || desktop.timestamp,
            mobile,
            desktop
        });
    } catch (err) {
        console.error('PSI API error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===== SHOPIFY URL STRUCTURE CHECK (SSE) =====
app.get('/api/check-shopify-urls', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'url parameter required' });

    // Setup SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    function sendEvent(type, data) {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    }

    sendEvent('started', { url, message: 'Starting Shopify URL structure check...' });

    try {
        const { checkShopifyUrls } = require('./server/checks/shopify-url-checker');
        const result = await checkShopifyUrls(url, (progressData) => {
            sendEvent('progress', progressData);
        });
        sendEvent('complete', { result });
    } catch (err) {
        sendEvent('error', { message: err.message });
    }

    res.end();

    req.on('close', () => {});
});

// ===== MISSING ALT TEXT CHECK (SSE) =====
app.get('/api/check-missing-alt', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'url parameter required' });

    // Setup SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    function sendEvent(type, data) {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    }

    sendEvent('started', { url, message: 'Starting Missing Alt Text check...' });

    try {
        const { checkMissingAlt } = require('./server/checks/missing-alt-checker');
        const result = await checkMissingAlt(url, (progressData) => {
            sendEvent('progress', progressData);
        });
        sendEvent('complete', { result });
    } catch (err) {
        sendEvent('error', { message: err.message });
    }

    res.end();

    req.on('close', () => {});
});

// ===== SCREENSHOT DOWNLOAD =====
app.get('/api/screenshots/:auditId/:filename', (req, res) => {
    const screenshotDir = path.join(__dirname, 'temp-screenshots', req.params.auditId);
    const filePath = path.join(screenshotDir, req.params.filename);
    res.sendFile(filePath);
});

app.listen(PORT, () => {
    console.log(`\n  🔍 SEO Audit Agent running at http://localhost:${PORT}\n`);
});
