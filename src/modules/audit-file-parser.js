/* ============================================
   AUDIT FILE PARSER MODULE
   Parses Screaming Frog audit overview files (TSV)
   and maps issues to existing app tabs
   ============================================ */
var AuditFileParser = {
    results: null,

    // Map Screaming Frog issue names to app tabs/checks
    ISSUE_MAP: {
        // H1 Tags
        'H1: Multiple': { check: 'h1-multiple', severity: 'warning', tab: 'h1-checker' },
        'H1: Duplicate': { check: 'h1-missing', severity: 'warning', tab: 'h1-checker' },
        'H1: Missing': { check: 'h1-missing', severity: 'critical', tab: 'h1-checker' },
        'H1: Over 70 Characters': { check: null, severity: 'warning', tab: 'h1-checker' },

        // Meta Titles
        'Page Titles: Over 60 Characters': { check: 'meta-titles', severity: 'warning', tab: 'meta-titles' },
        'Page Titles: Below 30 Characters': { check: 'meta-titles', severity: 'warning', tab: 'meta-titles' },
        'Page Titles: Over 561 Pixels': { check: 'meta-titles', severity: 'warning', tab: 'meta-titles' },
        'Page Titles: Below 200 Pixels': { check: 'meta-titles', severity: 'warning', tab: 'meta-titles' },
        'Page Titles: Missing': { check: 'meta-titles', severity: 'critical', tab: 'meta-titles' },
        'Page Titles: Same as H1': { check: null, severity: 'info', tab: 'meta-titles' },

        // Duplicate Titles
        'Page Titles: Duplicate': { check: 'duplicate-titles', severity: 'critical', tab: 'duplicate-titles' },

        // Broken Links / 4xx
        'Response Codes: Internal Client Error (4xx)': { check: 'fourxx-pages', severity: 'critical', tab: 'broken-links' },
        'Links: Broken Internal Links': { check: 'broken-backlinks', severity: 'critical', tab: 'broken-links' },

        // URL Structure
        'URL: Uppercase': { check: 'shopify-urls', severity: 'warning', tab: 'shopify-urls' },
        'Response Codes: Internal Redirection (3xx)': { check: null, severity: 'warning', tab: 'shopify-urls' },

        // External Links
        'Links: Pages With High External Outlinks': { check: 'external-domains', severity: 'warning', tab: 'external-domains' },
        'Links: Internal Nofollow Outlinks': { check: null, severity: 'warning', tab: 'external-domains' },
    },

    init: function () {
        var self = this;
        var zone = document.getElementById('audit-file-zone');
        var input = document.getElementById('audit-file-input');
        if (!zone || !input) return;

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
        var zone = document.getElementById('audit-file-zone');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            delimiter: '\t',
            complete: function (results) {
                // Strip BOM from field names
                var fields = (results.meta.fields || []).map(function (f) {
                    return f.replace(/^\uFEFF/, '').trim();
                });

                console.log('[Audit File] Detected columns:', fields.join(', '));

                // Re-map data to clean keys
                var originalFields = results.meta.fields || [];
                var data = results.data.map(function (row) {
                    var newRow = {};
                    for (var i = 0; i < originalFields.length; i++) {
                        newRow[fields[i]] = row[originalFields[i]];
                    }
                    return newRow;
                });

                // Find the right column names
                var issueNameCol = null;
                var issueTypeCol = null;
                var priorityCol = null;
                var urlsCol = null;
                var percentCol = null;
                var descCol = null;
                var howToFixCol = null;

                fields.forEach(function (f) {
                    var fl = f.toLowerCase();
                    if (fl === 'issue name') issueNameCol = f;
                    else if (fl === 'issue type') issueTypeCol = f;
                    else if (fl === 'issue priority') priorityCol = f;
                    else if (fl === 'urls') urlsCol = f;
                    else if (fl.indexOf('% of total') !== -1 || fl === '% of total') percentCol = f;
                    else if (fl === 'description') descCol = f;
                    else if (fl === 'how to fix') howToFixCol = f;
                });

                if (!issueNameCol) {
                    App.showToast('Could not find "Issue Name" column. Is this a Screaming Frog audit file?', 'error');
                    return;
                }

                var issues = [];
                data.forEach(function (row) {
                    var name = row[issueNameCol];
                    if (!name || !String(name).trim()) return;

                    issues.push({
                        name: String(name).trim(),
                        type: issueTypeCol ? String(row[issueTypeCol] || '').trim() : '',
                        priority: priorityCol ? String(row[priorityCol] || '').trim() : '',
                        urls: urlsCol ? parseInt(row[urlsCol]) || 0 : 0,
                        percent: percentCol ? parseFloat(row[percentCol]) || 0 : 0,
                        description: descCol ? String(row[descCol] || '').trim() : '',
                        howToFix: howToFixCol ? String(row[howToFixCol] || '').trim() : ''
                    });
                });

                self.results = issues;
                console.log('[Audit File] Parsed ' + issues.length + ' issues');

                // Map to app checks
                self.mapToChecks(issues);

                // Display full overview
                self.displayResults(issues);

                // Update zone
                zone.classList.add('uploaded');
                zone.querySelector('p').textContent = '✓ ' + file.name + ' loaded (' + issues.length + ' issues)';

                App.showToast('Audit file parsed: ' + issues.length + ' issues found', 'success');
            },
            error: function (err) {
                App.showToast('Error parsing audit file: ' + err.message, 'error');
            }
        });
    },

    mapToChecks: function (issues) {
        var self = this;

        issues.forEach(function (issue) {
            var mapping = self.ISSUE_MAP[issue.name];
            if (mapping && mapping.check) {
                var detail = issue.urls + ' URLs (' + issue.percent.toFixed(1) + '%)';
                var sev = mapping.severity;

                // Override severity based on Screaming Frog priority
                if (issue.priority === 'High') sev = 'critical';
                else if (issue.priority === 'Medium') sev = 'warning';

                AuditState.setCheck(mapping.check, sev, detail);
            }
        });
    },

    displayResults: function (issues) {
        var container = document.getElementById('audit-file-results');
        if (!container) return;

        container.style.display = 'block';

        // Group by priority
        var high = issues.filter(function (i) { return i.priority === 'High'; });
        var medium = issues.filter(function (i) { return i.priority === 'Medium'; });
        var low = issues.filter(function (i) { return i.priority === 'Low'; });

        var totalUrls = issues.reduce(function (sum, i) { return sum + i.urls; }, 0);

        var html = '';

        // Summary cards
        html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">';
        html += '<div class="score-card"><div class="score-label">Total Issues</div><div style="font-size:1.5rem;font-weight:700;color:var(--text-primary);">' + issues.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">High Priority</div><div style="font-size:1.5rem;font-weight:700;color:var(--accent-red);">' + high.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">Medium Priority</div><div style="font-size:1.5rem;font-weight:700;color:var(--accent-amber);">' + medium.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">Low Priority</div><div style="font-size:1.5rem;font-weight:700;color:var(--accent-emerald);">' + low.length + '</div></div>';
        html += '</div>';

        // Issues table
        html += '<h3 class="sub-title" style="margin-bottom:12px;">All Issues Overview</h3>';
        html += '<table class="result-table"><thead><tr>';
        html += '<th>#</th><th>Issue</th><th>Type</th><th>Priority</th><th>URLs</th><th>% of Total</th>';
        html += '</tr></thead><tbody>';

        // Sort: High first, then Medium, then Low
        var sorted = [].concat(high, medium, low);

        sorted.forEach(function (issue, i) {
            var prioClass = '';
            if (issue.priority === 'High') prioClass = 'severity-critical';
            else if (issue.priority === 'Medium') prioClass = 'severity-warning';
            else prioClass = 'severity-pass';

            var typeIcon = '';
            if (issue.type === 'Issue') typeIcon = '🔴';
            else if (issue.type === 'Warning') typeIcon = '🟡';
            else if (issue.type === 'Opportunity') typeIcon = '🔵';

            html += '<tr>';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td title="' + (issue.description || '').replace(/"/g, '&quot;') + '">' + issue.name + '</td>';
            html += '<td>' + typeIcon + ' ' + issue.type + '</td>';
            html += '<td><span class="severity-badge ' + prioClass + '">' + issue.priority + '</span></td>';
            html += '<td style="font-weight:600;">' + issue.urls + '</td>';
            html += '<td>' + issue.percent.toFixed(1) + '%</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';

        container.innerHTML = html;
    },

    getFindings: function () {
        return this.results;
    }
};
