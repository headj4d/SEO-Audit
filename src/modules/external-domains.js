/* ============================================
   EXTERNAL DOMAINS MODULE
   Parses Ahrefs Linked Domains export
   ============================================ */
var ExternalDomainsModule = {
    results: null,
    flagged: {},

    init: function () {
        var self = this;
        var zone = document.getElementById('domains-upload-zone');
        var input = document.getElementById('domains-file-input');

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
        var zone = document.getElementById('domains-upload-zone');

        CSVParser.parseFile(file).then(function (parsed) {
            var fields = parsed.fields;
            var data = parsed.data;

            // Ahrefs Linked Domains columns
            var domainCol = CSVParser.findColumn(fields, [
                'Linked Domain', 'Domain', 'Referring Domain', 'Target',
                'linked domain', 'domain', 'Linked domain'
            ]);
            var typeCol = CSVParser.findColumn(fields, [
                'Type', 'Link Type', 'type', 'Dofollow', 'Follow',
                'Links to target dofollow', 'Dofollow links to target'
            ]);
            var linksCol = CSVParser.findColumn(fields, [
                'Links from target', 'Links', 'Backlinks', 'links',
                'Links to target', 'Total links to target'
            ]);

            if (!domainCol) {
                App.showToast('Could not find domain column. Looking for: Linked Domain, Domain, Referring Domain', 'error');
                return;
            }

            var domains = [];
            data.forEach(function (row) {
                var domain = row[domainCol];
                if (!domain) return;

                var type = typeCol ? String(row[typeCol] || '').trim() : '';
                var links = linksCol ? (parseInt(row[linksCol]) || 0) : 0;

                // Filter for dofollow if type column exists
                var isDofollow = true;
                if (typeCol) {
                    var typeVal = type.toLowerCase();
                    if (typeVal === 'nofollow' || typeVal === 'false' || typeVal === '0') {
                        isDofollow = false;
                    }
                }

                domains.push({
                    domain: String(domain).trim(),
                    type: isDofollow ? 'dofollow' : 'nofollow',
                    links: links
                });
            });

            // Sort dofollow first, then by link count
            domains.sort(function (a, b) {
                if (a.type !== b.type) return a.type === 'dofollow' ? -1 : 1;
                return b.links - a.links;
            });

            self.results = domains;
            self.displayResults();

            zone.classList.add('uploaded');
            zone.querySelector('p').textContent = '✓ ' + file.name + ' (' + domains.length + ' domains)';

            var dofollow = domains.filter(function (d) { return d.type === 'dofollow'; });
            AuditState.setCheck('external-domains', SEO_CONSTANTS.SEVERITY.INFO,
                dofollow.length + ' do-follow domains — review for relevance');

            App.showToast('External domains loaded', 'success');
        }).catch(function (err) {
            App.showToast('Error parsing CSV: ' + err.message, 'error');
        });
    },

    toggleFlag: function (domain) {
        this.flagged[domain] = !this.flagged[domain];
        this.displayResults();

        var flaggedCount = Object.keys(this.flagged).filter(function (k) { return ExternalDomainsModule.flagged[k]; }).length;
        if (flaggedCount > 0) {
            AuditState.setCheck('external-domains', SEO_CONSTANTS.SEVERITY.WARNING,
                flaggedCount + ' irrelevant domains flagged');
        }
    },

    displayResults: function () {
        var container = document.getElementById('domains-results');
        var domains = this.results;
        var self = this;
        if (!domains) return;

        var dofollow = domains.filter(function (d) { return d.type === 'dofollow'; });
        var nofollow = domains.filter(function (d) { return d.type === 'nofollow'; });
        var flaggedCount = Object.keys(this.flagged).filter(function (k) { return self.flagged[k]; }).length;

        var html = '';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">';
        html += '<div class="score-card"><div class="score-label">Do-Follow</div><div style="font-size:1.3rem;font-weight:700;color:var(--accent-indigo);">' + dofollow.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">No-Follow</div><div style="font-size:1.3rem;font-weight:700;color:var(--text-secondary);">' + nofollow.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">Flagged</div><div style="font-size:1.3rem;font-weight:700;color:' + (flaggedCount > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)') + ';">' + flaggedCount + '</div></div>';
        html += '</div>';

        html += '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">Click "Flag" to mark irrelevant do-follow domains. Flagged domains will appear in the audit report.</p>';

        html += '<table class="result-table"><thead><tr><th>#</th><th>Domain</th><th>Type</th><th>Links</th><th>Action</th></tr></thead><tbody>';
        dofollow.forEach(function (d, i) {
            var flagged = self.flagged[d.domain];
            html += '<tr style="' + (flagged ? 'background:rgba(248,113,113,0.05);' : '') + '">';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td>' + d.domain + '</td>';
            html += '<td><span class="severity-badge severity-info">dofollow</span></td>';
            html += '<td>' + d.links + '</td>';
            html += '<td><button class="flag-btn ' + (flagged ? 'flagged' : '') + '" onclick="ExternalDomainsModule.toggleFlag(\'' + d.domain + '\')">' + (flagged ? '🚩 Flagged' : 'Flag') + '</button></td>';
            html += '</tr>';
        });
        html += '</tbody></table>';

        container.innerHTML = html;
    },

    getFindings: function () {
        if (!this.results) return null;
        var self = this;
        var flaggedDomains = this.results.filter(function (d) { return self.flagged[d.domain]; });
        return {
            title: 'External Do-Follow Domains',
            severity: flaggedDomains.length > 0 ? 'warning' : 'pass',
            data: { all: this.results, flagged: flaggedDomains }
        };
    }
};
