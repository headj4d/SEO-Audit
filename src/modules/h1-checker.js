/* ============================================
   H1 CHECKER MODULE
   Parses Screaming Frog CSV for H1 issues
   ============================================ */
var H1CheckerModule = {
    results: null,

    init: function () {
        var self = this;
        var zone = document.getElementById('h1-upload-zone');
        var input = document.getElementById('h1-file-input');

        zone.addEventListener('click', function (e) {
            if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT') return;
            input.click();
        });
        zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', function () { zone.classList.remove('dragover'); });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) self.processFile(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', function () {
            if (input.files.length) self.processFile(input.files[0]);
        });
    },

    processFile: function (file) {
        var self = this;
        var zone = document.getElementById('h1-upload-zone');

        CSVParser.parseFile(file).then(function (parsed) {
            var fields = parsed.fields;
            var data = parsed.data;

            // Find relevant columns
            var urlCol = CSVParser.findColumn(fields, ['Address', 'URL', 'address', 'url']);
            var h1Col1 = CSVParser.findColumn(fields, ['H1-1', 'H1 - 1', 'h1-1', 'H1']);
            var h1Col2 = CSVParser.findColumn(fields, ['H1-2', 'H1 - 2', 'h1-2']);
            var h1CountCol = CSVParser.findColumn(fields, ['H1 Count', 'h1 count', 'H1-Count']);

            if (!urlCol) {
                App.showToast('Could not find URL/Address column in CSV', 'error');
                return;
            }

            var missing = [];
            var multiple = [];

            data.forEach(function (row) {
                var url = row[urlCol];
                if (!url) return;

                var h1Count;
                if (h1CountCol) {
                    h1Count = parseInt(row[h1CountCol]) || 0;
                } else {
                    h1Count = 0;
                    if (h1Col1 && row[h1Col1] && String(row[h1Col1]).trim()) h1Count++;
                    if (h1Col2 && row[h1Col2] && String(row[h1Col2]).trim()) h1Count++;
                }

                var h1Text = h1Col1 ? (row[h1Col1] || '') : '';

                if (h1Count === 0) {
                    missing.push({ url: url, h1: '(none)' });
                } else if (h1Count > 1) {
                    var texts = [];
                    if (h1Col1 && row[h1Col1]) texts.push(String(row[h1Col1]).trim());
                    if (h1Col2 && row[h1Col2]) texts.push(String(row[h1Col2]).trim());
                    multiple.push({ url: url, count: h1Count, h1s: texts.join(' | ') });
                }
            });

            self.results = { missing: missing, multiple: multiple, total: data.length };
            self.displayResults();

            zone.classList.add('uploaded');
            zone.querySelector('p').textContent = '✓ ' + file.name + ' loaded (' + data.length + ' pages)';

            // Update audit state
            if (missing.length > 0) {
                AuditState.setCheck('h1-missing', SEO_CONSTANTS.SEVERITY.CRITICAL, missing.length + ' pages missing H1');
            } else {
                AuditState.setCheck('h1-missing', SEO_CONSTANTS.SEVERITY.PASS, 'All pages have H1 tags');
            }

            if (multiple.length > 0) {
                AuditState.setCheck('h1-multiple', SEO_CONSTANTS.SEVERITY.WARNING, multiple.length + ' pages with multiple H1s');
            } else {
                AuditState.setCheck('h1-multiple', SEO_CONSTANTS.SEVERITY.PASS, 'No pages with multiple H1s');
            }

            App.showToast('H1 analysis complete', 'success');
        }).catch(function (err) {
            App.showToast('Error parsing CSV: ' + err.message, 'error');
        });
    },

    displayResults: function () {
        var container = document.getElementById('h1-results');
        var r = this.results;
        var html = '';

        // Summary
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">';
        html += '<div class="score-card"><div class="score-label">Total Pages</div><div style="font-size:1.5rem;font-weight:700;color:var(--text-primary);">' + r.total + '</div></div>';
        html += '<div class="score-card"><div class="score-label">Missing H1</div><div style="font-size:1.5rem;font-weight:700;color:' + (r.missing.length > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)') + ';">' + r.missing.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">Multiple H1s</div><div style="font-size:1.5rem;font-weight:700;color:' + (r.multiple.length > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)') + ';">' + r.multiple.length + '</div></div>';
        html += '</div>';

        // Missing H1 table
        if (r.missing.length > 0) {
            html += '<h3 class="sub-title" style="margin-bottom:10px;color:var(--accent-red);">⚠ Pages Missing H1 Tags (' + r.missing.length + ')</h3>';
            html += '<table class="result-table"><thead><tr><th>#</th><th>URL</th><th>Status</th></tr></thead><tbody>';
            r.missing.forEach(function (item, i) {
                html += '<tr><td>' + (i + 1) + '</td><td title="' + item.url + '">' + item.url + '</td><td><span class="severity-badge severity-critical">Missing</span></td></tr>';
            });
            html += '</tbody></table>';
        }

        // Multiple H1s table
        if (r.multiple.length > 0) {
            html += '<h3 class="sub-title" style="margin-top:24px;margin-bottom:10px;color:var(--accent-amber);">⚠ Pages With Multiple H1 Tags (' + r.multiple.length + ')</h3>';
            html += '<table class="result-table"><thead><tr><th>#</th><th>URL</th><th>Count</th><th>H1 Tags</th></tr></thead><tbody>';
            r.multiple.forEach(function (item, i) {
                html += '<tr><td>' + (i + 1) + '</td><td title="' + item.url + '">' + item.url + '</td><td>' + item.count + '</td><td title="' + item.h1s + '">' + item.h1s + '</td></tr>';
            });
            html += '</tbody></table>';
        }

        if (r.missing.length === 0 && r.multiple.length === 0) {
            html += '<div class="empty-state"><p style="color:var(--accent-emerald);font-weight:600;font-size:1.1rem;">✓ All pages have exactly one H1 tag</p></div>';
        }

        container.innerHTML = html;
    },

    getFindings: function () {
        if (!this.results) return null;
        return {
            title: 'H1 Tag Analysis',
            severity: this.results.missing.length > 0 ? 'critical' : this.results.multiple.length > 0 ? 'warning' : 'pass',
            data: this.results
        };
    }
};
