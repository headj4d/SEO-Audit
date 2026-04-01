var AutoAuditModule = {
    activeSource: null,
    currentAuditId: null,

    init: function () {
        var self = this;
        var btn = document.getElementById('btn-auto-audit-start');
        if (btn) {
            btn.addEventListener('click', function () {
                self.startAudit();
            });
        }

        // CSV Upload UI
        var zone = document.getElementById('auto-audit-csv-zone');
        var input = document.getElementById('auto-audit-csv-input');
        if (zone && input) {
            zone.addEventListener('click', function (e) {
                if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT') return;
                input.click();
            });
            zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
            zone.addEventListener('dragleave', function () { zone.classList.remove('dragover'); });
            zone.addEventListener('drop', function (e) {
                e.preventDefault();
                zone.classList.remove('dragover');
                if (e.dataTransfer.files.length) self.processScreamingFrogCSV(e.dataTransfer.files[0]);
            });
            input.addEventListener('change', function () {
                if (input.files.length) self.processScreamingFrogCSV(input.files[0]);
            });
        }

        // Ahrefs Spammy Domains UI in Auto Audit
        var spamZone = document.getElementById('auto-spammy-domains-zone');
        var spamInput = document.getElementById('auto-spammy-domains-input');
        if (spamZone && spamInput) {
            spamZone.addEventListener('click', function (e) {
                if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT') return;
                spamInput.click();
            });
            spamZone.addEventListener('dragover', function (e) { e.preventDefault(); spamZone.classList.add('dragover'); });
            spamZone.addEventListener('dragleave', function () { spamZone.classList.remove('dragover'); });
            spamZone.addEventListener('drop', function (e) {
                e.preventDefault();
                spamZone.classList.remove('dragover');
                if (e.dataTransfer.files.length) {
                    if(window.SpammyDomainsModule) SpammyDomainsModule.processFile(e.dataTransfer.files[0]);
                    spamZone.querySelector('p').textContent = '✓ Uploaded: ' + e.dataTransfer.files[0].name;
                }
            });
            spamInput.addEventListener('change', function () {
                if (spamInput.files.length) {
                    if(window.SpammyDomainsModule) SpammyDomainsModule.processFile(spamInput.files[0]);
                    spamZone.querySelector('p').textContent = '✓ Uploaded: ' + spamInput.files[0].name;
                }
            });
        }

        var dlBtn = document.getElementById('btn-download-auto-report');
        if (dlBtn) {
            dlBtn.addEventListener('click', function () {
                if (self.currentAuditId) {
                    window.location.href = '/api/report/' + self.currentAuditId;
                }
            });
        }
    },

    startAudit: function () {
        var urlInput = document.getElementById('auto-audit-url');
        var domain = urlInput.value.trim();

        if (!domain) {
            alert('Please enter a URL');
            return;
        }

        // Reset UI
        document.getElementById('auto-audit-progress').style.display = 'block';
        document.getElementById('auto-audit-results').style.display = 'none';
        document.getElementById('progress-steps').innerHTML = '';
        document.getElementById('audit-log').innerHTML = '';

        // Disable button
        document.getElementById('btn-auto-audit-start').disabled = true;

        // Start SSE
        if (this.activeSource) this.activeSource.close();

        // Connect to backend
        this.activeSource = new EventSource('/api/audit?domain=' + encodeURIComponent(domain));

        var self = this;
        this.activeSource.addEventListener('message', function (e) {
            var data = JSON.parse(e.data);
            self.handleEvent(data);
        });

        this.activeSource.addEventListener('error', function (e) {
            if (e.target.readyState === EventSource.CLOSED) {
                // Normal close
            } else {
                self.log('Connection error', 'error');
                document.getElementById('btn-auto-audit-start').disabled = false;
                self.activeSource.close();
            }
        });
    },

    handleEvent: function (data) {
        switch (data.type) {
            case 'started':
                this.currentAuditId = data.auditId;
                this.log('Audit started for ' + data.domain);
                this.renderSteps();
                break;

            case 'progress':
                this.updateStep(data.step, data.status);
                this.log(data.message);
                break;

            case 'result':
                // Update global AuditState and individual modules
                this.processResult(data.step, data.data, data.severity);
                this.updateStep(data.step, 'done', data.severity);
                break;

            case 'complete':
                this.log('Audit finished successfully!');
                this.activeSource.close();
                document.getElementById('btn-auto-audit-start').disabled = false;
                document.getElementById('auto-audit-results').style.display = 'block';
                App.showToast('Audit complete!', 'success');
                break;

            case 'error':
                this.log('Error: ' + data.message, 'error');
                this.activeSource.close();
                document.getElementById('btn-auto-audit-start').disabled = false;
                break;
        }
    },

    log: function (msg, type) {
        var logDiv = document.getElementById('audit-log');
        var p = document.createElement('div');
        p.textContent = '> ' + msg;
        if (type === 'error') p.style.color = '#ef4444';
        logDiv.appendChild(p);
        logDiv.scrollTop = logDiv.scrollHeight;
    },

    renderSteps: function () {
        var steps = [
            { id: 'crawl', label: 'Crawling Site' },
            { id: 'pagespeed', label: 'PageSpeed' },
            { id: 'robots', label: 'Robots.txt' },
            { id: 'h1', label: 'H1 Analysis' },
            { id: 'metaTitles', label: 'Meta Titles' },
            { id: 'externalLinks', label: 'External Links' },
            { id: 'urlStructure', label: 'URL Structure' },
            { id: 'screenshots', label: 'Screenshots' }
        ];

        var container = document.getElementById('progress-steps');
        container.innerHTML = steps.map(function (s) {
            return '<div class="step-item" id="step-' + s.id + '">' +
                '<div class="step-icon">○</div>' +
                '<span class="step-label">' + s.label + '</span>' +
                '</div>';
        }).join('');
    },

    updateStep: function (id, status, severity) {
        var step = document.getElementById('step-' + id);
        if (!step) return;

        var icon = step.querySelector('.step-icon');
        step.className = 'step-item ' + status;

        if (status === 'running') {
            icon.textContent = '...';
            step.style.opacity = '1';
        } else if (status === 'done') {
            if (severity === 'critical') {
                icon.textContent = '✕';
                icon.style.color = '#ef4444';
            } else if (severity === 'warning') {
                icon.textContent = '!';
                icon.style.color = '#f59e0b';
            } else {
                icon.textContent = '✓';
                icon.style.color = '#10b981';
            }
        } else if (status === 'error') {
            icon.textContent = 'ERR';
            icon.style.color = '#ef4444';
        }
    },

    processResult: function (step, data, severity) {
        // 1. Update AuditState for dashboard summary
        var checkMap = {
            'pagespeed': 'pagespeed',
            'robots': 'robots-ai',
            'h1': 'h1-checker',
            'metaTitles': 'meta-titles',
            'externalLinks': 'external-domains',
            'urlStructure': 'shopify-urls',
            'screenshots': 'screenshots'
        };

        var checkId = checkMap[step];
        if (checkId) {
            var detail = 'Auto-checked';
            if (step === 'h1') detail = (data.missing.length + data.multiple.length) + ' issues found';
            if (step === 'metaTitles') detail = (data.tooLong.length + data.missing.length) + ' issues found';
            if (step === 'robots' && data && data.results) {
                var blocked = data.results.filter(function (r) { return r.status === 'blocked'; });
                detail = blocked.length > 0 ? blocked.length + ' AI bots blocked' : 'All AI bots allowed';
                // Feed results into the Robots AI tab UI
                RobotsAIModule.results = data.results;
                RobotsAIModule.displayResults(data.results, data.robotsUrl);
            }

            AuditState.setCheck(checkId, severity, detail);
        }

        // Exception: Screenshots gallery
        if (step === 'screenshots' && data.path) {
            // This likely won't work easily as the path is server-side.
        }
    },

    processScreamingFrogCSV: function (file) {
        var self = this;
        this.log('Processing Screaming Frog CSV: ' + file.name);

        CSVParser.parseFile(file).then(function (parsed) {
            var fields = parsed.fields;
            var data = parsed.data;

            // Simple crawl results extraction
            var results = {
                domain: 'Imported Site',
                h1: { missing: [], multiple: [] },
                metaTitles: { tooLong: [], missing: [], duplicates: [] }
            };

            // Detect columns
            var urlCol = CSVParser.findColumn(fields, ['Address', 'URL']);
            var titleCol = CSVParser.findColumn(fields, ['Title 1', 'Title']);
            var h1Col1 = CSVParser.findColumn(fields, ['H1-1', 'H1']);
            var h1Col2 = CSVParser.findColumn(fields, ['H1-2']);

            var titleMap = {};

            data.forEach(function (row) {
                var url = row[urlCol];
                if (!url) return;

                // Meta Titles
                var title = String(row[titleCol] || '').trim();
                if (!title || title === 'undefined') {
                    results.metaTitles.missing.push({ url: url });
                } else {
                    if (title.length > 60) results.metaTitles.tooLong.push({ url: url, length: title.length });

                    // Duplicate Logic
                    if (!titleMap[title]) titleMap[title] = [];
                    titleMap[title].push(url);
                }

                // H1 logic
                var h1s = [];
                if (row[h1Col1]) h1s.push(row[h1Col1]);
                if (row[h1Col2]) h1s.push(row[h1Col2]);

                if (h1s.length === 0) results.h1.missing.push({ url: url });
                else if (h1s.length > 1) results.h1.multiple.push({ url: url });
            });

            // Format Duplicates
            Object.keys(titleMap).forEach(function (title) {
                if (titleMap[title].length > 1) {
                    results.metaTitles.duplicates.push({ title: title, urls: titleMap[title] });
                }
            });

            // Store results in Module to allow adding Ahrefs later
            self.importedData = results;

            self.uploadData(results);

        }).catch(err => {
            self.log('Import failed: ' + err.message, 'error');
        });
    },

    uploadData: function (results) {
        var self = this;
        fetch('/api/import-audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: results })
        }).then(res => res.json()).then(data => {
            self.currentAuditId = data.auditId;
            self.log('Import complete! ' + results.h1.missing.length + ' H1 missing, ' + results.metaTitles.tooLong.length + ' titles long, ' + results.metaTitles.duplicates.length + ' duplicated.');

            // Show completion UI
            document.getElementById('auto-audit-progress').style.display = 'block';
            document.getElementById('auto-audit-results').style.display = 'block';

            // Update Dashboard stats
            self.processResult('h1', results.h1, results.h1.missing.length > 0 ? 'critical' : 'pass');
            self.processResult('metaTitles', results.metaTitles, results.metaTitles.tooLong.length > 0 ? 'warning' : 'pass');

            // Duplicate Titles State
            DuplicateTitlesModule.setResults(results.metaTitles.duplicates);
            if (results.metaTitles.duplicates.length > 0) {
                AuditState.setCheck('duplicate-titles', SEO_CONSTANTS.SEVERITY.CRITICAL, results.metaTitles.duplicates.length + ' duplicate titles');
            } else {
                AuditState.setCheck('duplicate-titles', SEO_CONSTANTS.SEVERITY.PASS, 'No duplicate titles');
            }

            App.showToast('Audit Import Updated!', 'success');
        });
    },

    processAhrefsBacklinks: function (file) {
        var self = this;
        CSVParser.parseFile(file).then(function (parsed) {
            var fields = parsed.fields, data = parsed.data;
            var urlCol = CSVParser.findColumn(fields, ['URL (target)', 'Broken URL', 'Target URL']);
            var refCol = CSVParser.findColumn(fields, ['URL (source)', 'Referring URL', 'Source']);

            var results = [];
            data.forEach(function (row) {
                if (row[urlCol]) results.push({ targetUrl: row[urlCol], sourceUrl: row[refCol] || '' });
            });

            if (!self.importedData) self.importedData = { domain: 'Ahrefs Import', h1: { missing: [], multiple: [] }, metaTitles: { tooLong: [], missing: [], duplicates: [] } };
            self.importedData.brokenBacklinks = results;

            document.getElementById('ahrefs-backlinks-zone').querySelector('p').textContent = '✓ Backlinks: ' + results.length;
            self.uploadData(self.importedData);
        });
    },

    processAhrefsFourxx: function (file) {
        var self = this;
        CSVParser.parseFile(file).then(function (parsed) {
            var fields = parsed.fields, data = parsed.data;
            var urlCol = CSVParser.findColumn(fields, ['URL', 'Page URL']);

            var results = [];
            data.forEach(function (row) {
                if (row[urlCol]) results.push({ url: row[urlCol] });
            });

            if (!self.importedData) self.importedData = { domain: 'Ahrefs Import', h1: { missing: [], multiple: [] }, metaTitles: { tooLong: [], missing: [], duplicates: [] } };
            self.importedData.fourxx = results;

            document.getElementById('ahrefs-fourxx-zone').querySelector('p').textContent = '✓ 4xx Pages: ' + results.length;
            self.uploadData(self.importedData);
        });
    }
};
