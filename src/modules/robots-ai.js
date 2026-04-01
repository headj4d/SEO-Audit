/* ============================================
   ROBOTS AI MODULE
   Checks robots.txt for AI bot directives
   ============================================ */
var RobotsAIModule = {
    results: null,

    init: function () {
        var self = this;
        document.getElementById('btn-robots-fetch').addEventListener('click', function () {
            self.fetchRobotsTxt();
        });
        document.getElementById('btn-robots-check').addEventListener('click', function () {
            var content = document.getElementById('robots-content').value;
            if (content.trim()) {
                self.analyzeContent(content, null);
            } else {
                App.showToast('Please paste robots.txt content or enter a URL above', 'error');
            }
        });
    },

    fetchRobotsTxt: function () {
        var url = document.getElementById('robots-url').value.trim();
        if (!url) {
            App.showToast('Please enter a website URL', 'error');
            return;
        }

        var self = this;
        App.showToast('Fetching robots.txt via server...', 'info');

        // Route through our backend to avoid CORS
        fetch('/api/check-robots?url=' + encodeURIComponent(url))
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.error) {
                    App.showToast('Error: ' + data.error, 'error');
                    return;
                }
                // Populate the textarea so the user can see the raw content
                if (data.rawContent) {
                    document.getElementById('robots-content').value = data.rawContent;
                }
                self.displayResults(data.results, data.robotsUrl);
                self.results = data.results;

                var blockedCount = data.results.filter(function (r) { return r.status === 'blocked'; }).length;
                var severity = blockedCount > 0 ? SEO_CONSTANTS.SEVERITY.WARNING : SEO_CONSTANTS.SEVERITY.PASS;
                var detail = blockedCount > 0 ? blockedCount + ' AI bots blocked' : 'All AI bots allowed';
                AuditState.setCheck('robots-ai', severity, detail);
                App.showToast('robots.txt analysis complete', 'success');
            })
            .catch(function (err) {
                App.showToast('Failed to check robots.txt: ' + err.message, 'error');
            });
    },

    // Called from auto-audit with a URL
    checkUrl: function (url) {
        var self = this;
        return fetch('/api/check-robots?url=' + encodeURIComponent(url))
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.error) throw new Error(data.error);
                self.results = data.results;
                return data;
            });
    },

    analyzeContent: function (content, robotsUrl) {
        var lines = content.split('\n');
        var bots = SEO_CONSTANTS.AI_BOTS;
        var results = [];
        var blocks = {};
        var currentAgents = [];

        // Parse user-agent blocks
        lines.forEach(function (rawLine) {
            var line = rawLine.trim();
            if (!line || line.startsWith('#')) {
                currentAgents = [];
                return;
            }
            var match = line.match(/^user-agent:\s*(.+)/i);
            if (match) {
                var agent = match[1].trim();
                currentAgents.push(agent);
                if (!blocks[agent]) blocks[agent] = [];
                return;
            }
            currentAgents.forEach(function (a) {
                if (!blocks[a]) blocks[a] = [];
                blocks[a].push(line);
            });
        });

        var wildcardBlock = blocks['*'] || [];
        var wildcardDisallowAll = wildcardBlock.some(function (d) { return /^disallow:\s*\/\s*$/i.test(d); });

        bots.forEach(function (bot) {
            var botKey = Object.keys(blocks).find(function (k) {
                return k.toLowerCase() === bot.name.toLowerCase();
            });
            var botBlock = botKey ? blocks[botKey] : null;

            var status, reason;

            if (botBlock) {
                var hasDisallowAll = botBlock.some(function (d) { return /^disallow:\s*\/\s*$/i.test(d); });
                var hasDisallowRoot = botBlock.some(function (d) { return /^disallow:\s*\//i.test(d); });
                var hasAllowAll = botBlock.some(function (d) { return /^allow:\s*\/\s*$/i.test(d); });
                var hasEmptyDisallow = botBlock.some(function (d) { return /^disallow:\s*$/i.test(d); });

                if (hasDisallowAll && !hasAllowAll) {
                    status = 'blocked';
                    reason = 'Explicitly blocked — Disallow: /';
                } else if (hasDisallowRoot && !hasAllowAll) {
                    var disallows = botBlock
                        .filter(function (d) { return /^disallow:/i.test(d); })
                        .map(function (d) { return d.replace(/^disallow:\s*/i, '').trim(); })
                        .join(', ');
                    status = 'blocked';
                    reason = 'Partially blocked — Disallow: ' + disallows;
                } else if (hasEmptyDisallow || hasAllowAll) {
                    status = 'allowed';
                    reason = 'Explicitly allowed';
                } else {
                    status = 'allowed';
                    reason = 'Mentioned — allowed';
                }
            } else if (wildcardDisallowAll) {
                status = 'blocked';
                reason = 'Blocked by wildcard — User-agent: * / Disallow: /';
            } else {
                status = 'allowed';
                reason = 'Not mentioned (assumed allowed)';
            }

            results.push({ name: bot.name, label: bot.label, status: status, reason: reason });
        });

        this.results = results;
        this.displayResults(results, robotsUrl);

        var blockedCount = results.filter(function (r) { return r.status === 'blocked'; }).length;
        var severity = blockedCount > 0 ? SEO_CONSTANTS.SEVERITY.WARNING : SEO_CONSTANTS.SEVERITY.PASS;
        var detail = blockedCount > 0 ? blockedCount + ' AI bots blocked' : 'All AI bots allowed';
        AuditState.setCheck('robots-ai', severity, detail);
        App.showToast('robots.txt analysis complete', 'success');
    },

    displayResults: function (results, robotsUrl) {
        var container = document.getElementById('robots-results');
        if (!results || !results.length) {
            container.innerHTML = '<p style="color:var(--text-muted)">No results yet.</p>';
            return;
        }

        var blocked = results.filter(function (r) { return r.status === 'blocked'; });
        var allowed = results.filter(function (r) { return r.status === 'allowed'; });

        var html = '';

        // Robots.txt link banner
        if (robotsUrl) {
            html += '<div style="margin-bottom:16px;padding:10px 14px;background:var(--bg-card);border-radius:8px;border:1px solid var(--border);font-size:0.8rem;">';
            html += '📄 Checked: <a href="' + robotsUrl + '" target="_blank" style="color:var(--accent-blue);word-break:break-all;">' + robotsUrl + '</a>';
            html += '</div>';
        }

        // Summary cards
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">';
        html += '<div class="score-card"><div class="score-label">🚫 Blocked</div><div style="font-size:1.5rem;font-weight:700;color:var(--accent-red);">' + blocked.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">✓ Allowed</div><div style="font-size:1.5rem;font-weight:700;color:var(--accent-emerald);">' + allowed.length + '</div></div>';
        html += '</div>';

        // Blocked section
        if (blocked.length > 0) {
            html += '<h4 style="color:var(--accent-red);margin:0 0 10px;font-size:0.85rem;text-transform:uppercase;letter-spacing:.05em;">🚫 Blocked AI Bots (' + blocked.length + ')</h4>';
            html += '<div class="bots-grid" style="margin-bottom:20px;">';
            blocked.forEach(function (bot) {
                html += '<div class="bot-card">';
                html += '  <div class="bot-status blocked"></div>';
                html += '  <div style="flex:1">';
                html += '    <div class="bot-name">' + bot.name + '</div>';
                html += '    <div style="font-size:0.7rem;color:var(--text-muted);">' + bot.label + '</div>';
                html += '    <div style="font-size:0.7rem;color:var(--accent-red);margin-top:2px;">' + (bot.reason || '') + '</div>';
                html += '  </div>';
                html += '  <span class="bot-label" style="background:rgba(239,68,68,0.15);color:var(--accent-red);">🚫 Blocked</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        // Allowed section
        if (allowed.length > 0) {
            html += '<h4 style="color:var(--accent-emerald);margin:0 0 10px;font-size:0.85rem;text-transform:uppercase;letter-spacing:.05em;">✓ Allowed AI Bots (' + allowed.length + ')</h4>';
            html += '<div class="bots-grid">';
            allowed.forEach(function (bot) {
                html += '<div class="bot-card">';
                html += '  <div class="bot-status allowed"></div>';
                html += '  <div style="flex:1">';
                html += '    <div class="bot-name">' + bot.name + '</div>';
                html += '    <div style="font-size:0.7rem;color:var(--text-muted);">' + bot.label + '</div>';
                html += '    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">' + (bot.reason || '') + '</div>';
                html += '  </div>';
                html += '  <span class="bot-label" style="background:rgba(52,211,153,0.15);color:var(--accent-emerald);">✓ Allowed</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        container.innerHTML = html;
    },

    getFindings: function () {
        if (!this.results) return null;
        return {
            title: 'AI Bots / robots.txt',
            severity: this.results.some(function (r) { return r.status === 'blocked'; }) ? 'warning' : 'pass',
            data: this.results
        };
    }
};
