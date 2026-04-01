/* ============================================
   BROKEN LINKS MODULE
   Parses Ahrefs broken backlinks & 4xx pages
   ============================================ */
var BrokenLinksModule = {
    backlinksResults: null,
    fourxxResults: null,

    init: function () {
        var self = this;
        this._setupUpload('backlinks-upload-zone', 'backlinks-file-input', function (f) { self.processBacklinks(f); });
        this._setupUpload('fourxx-upload-zone', 'fourxx-file-input', function (f) { self.processFourxx(f); });
    },

    _setupUpload: function (zoneId, inputId, handler) {
        var zone = document.getElementById(zoneId);
        var input = document.getElementById(inputId);
        if (!zone || !input) return;
        zone.addEventListener('click', function (e) {
            if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT') return;
            input.click();
        });
        zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', function () { zone.classList.remove('dragover'); });
        zone.addEventListener('drop', function (e) {
            e.preventDefault(); zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handler(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', function () { if (input.files.length) handler(input.files[0]); });
    },

    processBacklinks: function (file) {
        var self = this;
        var zone = document.getElementById('backlinks-upload-zone');
        CSVParser.parseFile(file).then(function (parsed) {
            var fields = parsed.fields, data = parsed.data;
            var urlCol = CSVParser.findColumn(fields, ['URL (target)', 'Target URL', 'Target', 'URL', 'Broken URL']);
            var refCol = CSVParser.findColumn(fields, ['URL (source)', 'Source URL', 'Referring URL', 'Source']);
            var statusCol = CSVParser.findColumn(fields, ['HTTP code', 'Status Code', 'HTTP Code', 'Status']);
            var anchorCol = CSVParser.findColumn(fields, ['Anchor', 'Anchor text']);
            var results = [];
            data.forEach(function (row) {
                var target = urlCol ? String(row[urlCol] || '').trim() : '';
                if (target) {
                    results.push({
                        targetUrl: target,
                        sourceUrl: refCol ? String(row[refCol] || '').trim() : '',
                        statusCode: statusCol ? String(row[statusCol] || '').trim() : '',
                        anchor: anchorCol ? String(row[anchorCol] || '').trim() : ''
                    });
                }
            });
            self.backlinksResults = results;
            self.displayResults();
            zone.classList.add('uploaded');
            zone.querySelector('p').textContent = '✓ ' + file.name + ' (' + results.length + ' links)';
            AuditState.setCheck('broken-backlinks',
                results.length > 0 ? SEO_CONSTANTS.SEVERITY.CRITICAL : SEO_CONSTANTS.SEVERITY.PASS,
                results.length > 0 ? results.length + ' broken backlinks' : 'No broken backlinks');
            App.showToast('Broken backlinks loaded', 'success');
        }).catch(function (err) { App.showToast('Error: ' + err.message, 'error'); });
    },

    processFourxx: function (file) {
        var self = this;
        var zone = document.getElementById('fourxx-upload-zone');
        CSVParser.parseFile(file).then(function (parsed) {
            var fields = parsed.fields, data = parsed.data;
            var urlCol = CSVParser.findColumn(fields, ['URL', 'Page URL', 'Address', 'Target URL']);
            var statusCol = CSVParser.findColumn(fields, ['HTTP code', 'Status Code', 'HTTP Code', 'Status']);
            var refCol = CSVParser.findColumn(fields, ['Referer', 'Referrer', 'Source', 'Referring URL']);
            var results = [];
            data.forEach(function (row) {
                var url = urlCol ? String(row[urlCol] || '').trim() : '';
                if (url) {
                    results.push({
                        url: url,
                        statusCode: statusCol ? String(row[statusCol] || '').trim() : '',
                        referrer: refCol ? String(row[refCol] || '').trim() : ''
                    });
                }
            });
            self.fourxxResults = results;
            self.displayResults();
            zone.classList.add('uploaded');
            zone.querySelector('p').textContent = '✓ ' + file.name + ' (' + results.length + ' pages)';
            AuditState.setCheck('fourxx-pages',
                results.length > 0 ? SEO_CONSTANTS.SEVERITY.CRITICAL : SEO_CONSTANTS.SEVERITY.PASS,
                results.length > 0 ? results.length + ' broken pages (4xx)' : 'No 4xx pages');
            App.showToast('4xx pages loaded', 'success');
        }).catch(function (err) { App.showToast('Error: ' + err.message, 'error'); });
    },

    displayResults: function () {
        var container = document.getElementById('broken-results');
        var html = '';
        if (this.backlinksResults) {
            var bl = this.backlinksResults;
            html += '<h3 class="sub-title" style="color:' + (bl.length > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)') + ';margin-bottom:12px;">'
                + (bl.length > 0 ? '🔗 Broken Backlinks (' + bl.length + ')' : '✓ No Broken Backlinks') + '</h3>';
            if (bl.length > 0) {
                html += '<table class="result-table"><thead><tr><th>#</th><th>Broken URL</th><th>Source</th><th>Status</th></tr></thead><tbody>';
                bl.forEach(function (item, i) {
                    html += '<tr><td>' + (i + 1) + '</td><td title="' + item.targetUrl + '">' + item.targetUrl + '</td>'
                        + '<td title="' + item.sourceUrl + '">' + item.sourceUrl + '</td>'
                        + '<td><span class="severity-badge severity-critical">' + (item.statusCode || 'N/A') + '</span></td></tr>';
                });
                html += '</tbody></table>';
            }
        }
        if (this.fourxxResults) {
            var fx = this.fourxxResults;
            html += '<h3 class="sub-title" style="color:' + (fx.length > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)') + ';margin-top:24px;margin-bottom:12px;">'
                + (fx.length > 0 ? '❌ 4xx Pages (' + fx.length + ')' : '✓ No 4xx Pages') + '</h3>';
            if (fx.length > 0) {
                html += '<table class="result-table"><thead><tr><th>#</th><th>URL</th><th>Status</th><th>Referrer</th></tr></thead><tbody>';
                fx.forEach(function (item, i) {
                    html += '<tr><td>' + (i + 1) + '</td><td title="' + item.url + '">' + item.url + '</td>'
                        + '<td><span class="severity-badge severity-critical">' + (item.statusCode || 'N/A') + '</span></td>'
                        + '<td>' + (item.referrer || '-') + '</td></tr>';
                });
                html += '</tbody></table>';
            }
        }
        if (!this.backlinksResults && !this.fourxxResults) {
            html = '<div class="empty-state"><p>Upload Ahrefs CSV exports above to analyze.</p></div>';
        }
        container.innerHTML = html;
    },

    getFindings: function () {
        var f = {};
        if (this.backlinksResults) f.backlinks = { title: 'Broken Backlinks', severity: this.backlinksResults.length > 0 ? 'critical' : 'pass', data: this.backlinksResults };
        if (this.fourxxResults) f.fourxx = { title: '4xx Pages', severity: this.fourxxResults.length > 0 ? 'critical' : 'pass', data: this.fourxxResults };
        return Object.keys(f).length > 0 ? f : null;
    }
};
