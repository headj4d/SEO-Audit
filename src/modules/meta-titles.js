/* ============================================
   META TITLES MODULE
   Checks for overly long / unoptimized titles
   ============================================ */
var MetaTitlesModule = {
    results: null,

    init: function () {
        var self = this;
        var zone = document.getElementById('meta-upload-zone');
        var input = document.getElementById('meta-file-input');

        zone.addEventListener('click', function (e) {
            // Don't trigger if the click came from the label or input itself
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
        var zone = document.getElementById('meta-upload-zone');

        CSVParser.parseFile(file).then(function (parsed) {
            var fields = parsed.fields;
            var data = parsed.data;

            var urlCol = CSVParser.findColumn(fields, ['Address', 'URL', 'address', 'url']);
            var titleCol = CSVParser.findColumn(fields, ['Title 1', 'Title', 'title 1', 'title', 'Meta Title', 'Page Title']);
            var titleLenCol = CSVParser.findColumn(fields, ['Title 1 Length', 'Title Length', 'title 1 length']);

            if (!urlCol) {
                App.showToast('Could not find URL/Address column', 'error');
                return;
            }

            if (!titleCol) {
                App.showToast('Could not find Title column. Looking for: Title 1, Title, Meta Title', 'error');
                return;
            }

            var tooLong = [];
            var tooShort = [];
            var missing = [];
            var ok = [];

            data.forEach(function (row) {
                var url = row[urlCol];
                if (!url) return;

                var title = titleCol ? String(row[titleCol] || '').trim() : '';
                var length = title.length;

                if (titleLenCol && row[titleLenCol]) {
                    length = parseInt(row[titleLenCol]) || title.length;
                }

                if (!title || title === 'undefined') {
                    missing.push({ url: url, title: '(empty)', length: 0 });
                } else if (length > SEO_CONSTANTS.TITLE_MAX_LENGTH) {
                    tooLong.push({ url: url, title: title, length: length });
                } else if (length < SEO_CONSTANTS.TITLE_MIN_LENGTH) {
                    tooShort.push({ url: url, title: title, length: length });
                } else {
                    ok.push({ url: url, title: title, length: length });
                }
            });

            self.results = { tooLong: tooLong, tooShort: tooShort, missing: missing, ok: ok, total: data.length };

            // Detect Duplicates
            var titleMap = {};
            data.forEach(function (row) {
                var url = row[urlCol];
                var title = String(row[titleCol] || '').trim();
                if (url && title && title !== 'undefined') {
                    if (!titleMap[title]) titleMap[title] = [];
                    titleMap[title].push(url);
                }
            });

            var duplicates = [];
            Object.keys(titleMap).forEach(function (title) {
                if (titleMap[title].length > 1) {
                    duplicates.push({ title: title, urls: titleMap[title] });
                }
            });

            self.results.duplicates = duplicates;
            DuplicateTitlesModule.setResults(duplicates);

            self.displayResults();

            zone.classList.add('uploaded');
            zone.querySelector('p').textContent = '✓ ' + file.name + ' loaded (' + data.length + ' pages)';

            if (duplicates.length > 0) {
                AuditState.setCheck('duplicate-titles', SEO_CONSTANTS.SEVERITY.CRITICAL, duplicates.length + ' duplicate titles found');
            } else {
                AuditState.setCheck('duplicate-titles', SEO_CONSTANTS.SEVERITY.PASS, 'No duplicate titles');
            }

            var issueCount = tooLong.length + tooShort.length + missing.length;
            if (issueCount > 0) {
                AuditState.setCheck('meta-titles', SEO_CONSTANTS.SEVERITY.WARNING, issueCount + ' title issues found');
            } else {
                AuditState.setCheck('meta-titles', SEO_CONSTANTS.SEVERITY.PASS, 'All titles optimized');
            }

            App.showToast('Meta titles analysis complete', 'success');
        }).catch(function (err) {
            App.showToast('Error parsing CSV: ' + err.message, 'error');
        });
    },

    displayResults: function () {
        var container = document.getElementById('meta-results');
        var r = this.results;
        var html = '';

        // Summary
        html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">';
        html += '<div class="score-card"><div class="score-label">Total</div><div style="font-size:1.3rem;font-weight:700;color:var(--text-primary);">' + r.total + '</div></div>';
        html += '<div class="score-card"><div class="score-label">Too Long (>60)</div><div style="font-size:1.3rem;font-weight:700;color:' + (r.tooLong.length ? 'var(--accent-amber)' : 'var(--accent-emerald)') + ';">' + r.tooLong.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">Too Short (<10)</div><div style="font-size:1.3rem;font-weight:700;color:' + (r.tooShort.length ? 'var(--accent-amber)' : 'var(--accent-emerald)') + ';">' + r.tooShort.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">Missing</div><div style="font-size:1.3rem;font-weight:700;color:' + (r.missing.length ? 'var(--accent-red)' : 'var(--accent-emerald)') + ';">' + r.missing.length + '</div></div>';
        html += '</div>';

        function renderTable(items, label, badgeClass) {
            if (items.length === 0) return '';
            var t = '<h3 class="sub-title" style="margin-top:20px;margin-bottom:10px;">' + label + ' (' + items.length + ')</h3>';
            t += '<table class="result-table"><thead><tr><th>#</th><th>URL</th><th>Title</th><th>Chars</th><th>Status</th></tr></thead><tbody>';
            items.forEach(function (item, i) {
                t += '<tr>';
                t += '<td>' + (i + 1) + '</td>';
                t += '<td title="' + item.url + '">' + item.url + '</td>';
                t += '<td title="' + item.title + '">' + item.title + '</td>';
                t += '<td>' + item.length + '</td>';
                t += '<td><span class="severity-badge ' + badgeClass + '">' + (badgeClass === 'severity-critical' ? 'Missing' : badgeClass === 'severity-warning' ? 'Issue' : 'OK') + '</span></td>';
                t += '</tr>';
            });
            t += '</tbody></table>';
            return t;
        }

        html += renderTable(r.missing, '❌ Missing Titles', 'severity-critical');
        html += renderTable(r.tooLong, '⚠️ Titles Too Long (>60 chars)', 'severity-warning');
        html += renderTable(r.tooShort, '⚠️ Titles Too Short (<10 chars)', 'severity-warning');

        if (r.missing.length === 0 && r.tooLong.length === 0 && r.tooShort.length === 0) {
            html += '<div class="empty-state"><p style="color:var(--accent-emerald);font-weight:600;font-size:1.1rem;">✓ All meta titles are well-optimized</p></div>';
        }

        container.innerHTML = html;
    },

    getFindings: function () {
        if (!this.results) return null;
        return {
            title: 'Meta Titles Analysis',
            severity: this.results.missing.length > 0 ? 'critical' : (this.results.tooLong.length + this.results.tooShort.length > 0) ? 'warning' : 'pass',
            data: this.results
        };
    }
};
