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
                self.analyzeContent(content);
            } else {
                App.showToast('Please paste robots.txt content', 'error');
            }
        });
    },

    fetchRobotsTxt: function () {
        var url = document.getElementById('robots-url').value.trim();
        if (!url) {
            App.showToast('Please enter a URL', 'error');
            return;
        }

        // Ensure it ends with /robots.txt
        if (!url.includes('robots.txt')) {
            if (!url.endsWith('/')) url += '/';
            url += 'robots.txt';
        }
        if (!url.startsWith('http')) url = 'https://' + url;

        var self = this;
        App.showToast('Fetching robots.txt...', 'info');

        // Use a CORS proxy or direct fetch
        fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.text();
            })
            .then(function (text) {
                document.getElementById('robots-content').value = text;
                self.analyzeContent(text);
            })
            .catch(function (err) {
                App.showToast('Could not fetch robots.txt (CORS may block this). Try pasting the content manually.', 'error');
            });
    },

    analyzeContent: function (content) {
        var lines = content.split('\n');
        var bots = SEO_CONSTANTS.AI_BOTS;
        var results = [];
        var currentAgent = '';

        // Parse user-agent blocks
        var blocks = {};

        lines.forEach(function (line) {
            line = line.trim();
            if (line.startsWith('#') || !line) return;

            var match = line.match(/^user-agent:\s*(.+)/i);
            if (match) {
                currentAgent = match[1].trim();
                if (!blocks[currentAgent]) {
                    blocks[currentAgent] = [];
                }
                return;
            }

            if (currentAgent) {
                blocks[currentAgent] = blocks[currentAgent] || [];
                blocks[currentAgent].push(line);
            }
        });

        // Check each AI bot
        bots.forEach(function (bot) {
            var status = 'allowed'; // default
            var reason = 'Not mentioned in robots.txt';

            // Check if this bot has a specific block
            var botBlock = null;
            Object.keys(blocks).forEach(function (agent) {
                if (agent.toLowerCase() === bot.name.toLowerCase()) {
                    botBlock = blocks[agent];
                }
            });

            if (botBlock) {
                // Check for disallow
                var hasDisallow = false;
                botBlock.forEach(function (directive) {
                    if (/^disallow:\s*\//i.test(directive)) {
                        hasDisallow = true;
                    }
                });
                if (hasDisallow) {
                    status = 'blocked';
                    reason = 'Disallowed via User-agent: ' + bot.name;
                } else {
                    status = 'allowed';
                    reason = 'Explicitly allowed';
                }
            }

            // Also check wildcard * rules
            if (blocks['*'] && status === 'allowed') {
                blocks['*'].forEach(function (directive) {
                    // Only flag if there is a blanket disallow for all
                    if (/^disallow:\s*\/\s*$/i.test(directive)) {
                        if (!botBlock) {
                            status = 'blocked';
                            reason = 'Blocked by wildcard Disallow: /';
                        }
                    }
                });
            }

            results.push({
                name: bot.name,
                label: bot.label,
                status: status,
                reason: reason
            });
        });

        this.results = results;
        this.displayResults();

        var blockedCount = results.filter(function (r) { return r.status === 'blocked'; }).length;
        var severity = blockedCount > 0 ? SEO_CONSTANTS.SEVERITY.WARNING : SEO_CONSTANTS.SEVERITY.PASS;
        var detail = blockedCount > 0 ? blockedCount + ' AI bots blocked' : 'All AI bots allowed';

        AuditState.setCheck('robots-ai', severity, detail);
        App.showToast('robots.txt analysis complete', 'success');
    },

    displayResults: function () {
        var container = document.getElementById('robots-results');
        var results = this.results;

        var blocked = results.filter(function (r) { return r.status === 'blocked'; });
        var allowed = results.filter(function (r) { return r.status === 'allowed'; });

        var html = '';

        // Summary
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">';
        html += '<div class="score-card"><div class="score-label">Blocked</div><div style="font-size:1.5rem;font-weight:700;color:var(--accent-red);">' + blocked.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">Allowed</div><div style="font-size:1.5rem;font-weight:700;color:var(--accent-emerald);">' + allowed.length + '</div></div>';
        html += '</div>';

        // Bot grid
        html += '<div class="bots-grid">';
        results.forEach(function (bot) {
            html += '<div class="bot-card">';
            html += '  <div class="bot-status ' + bot.status + '"></div>';
            html += '  <div>';
            html += '    <div class="bot-name">' + bot.name + '</div>';
            html += '    <div style="font-size:0.7rem;color:var(--text-muted);">' + bot.label + '</div>';
            html += '  </div>';
            html += '  <span class="bot-label">' + (bot.status === 'blocked' ? '🚫 Blocked' : '✓ Allowed') + '</span>';
            html += '</div>';
        });
        html += '</div>';

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
