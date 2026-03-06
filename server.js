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

// ===== SCREENSHOT DOWNLOAD =====
app.get('/api/screenshots/:auditId/:filename', (req, res) => {
    const screenshotDir = path.join(__dirname, 'temp-screenshots', req.params.auditId);
    const filePath = path.join(screenshotDir, req.params.filename);
    res.sendFile(filePath);
});

app.listen(PORT, () => {
    console.log(`\n  🔍 SEO Audit Agent running at http://localhost:${PORT}\n`);
});
