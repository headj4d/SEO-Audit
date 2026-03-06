/* ============================================
   SHOPIFY URLS MODULE
   Checks for /collections/*/products/* pattern
   ============================================ */
var ShopifyUrlsModule = {
    results: null,

    init: function () {
        var self = this;
        document.getElementById('btn-shopify-check').addEventListener('click', function () {
            self.analyzeUrls();
        });
    },

    analyzeUrls: function () {
        var input = document.getElementById('shopify-urls-input').value.trim();
        if (!input) {
            App.showToast('Please paste URLs to analyze', 'error');
            return;
        }

        var urls = input.split('\n').map(function (u) { return u.trim(); }).filter(function (u) { return u.length > 0; });
        var results = [];

        urls.forEach(function (url) {
            var hasCollectionPattern = SEO_CONSTANTS.SHOPIFY_COLLECTION_PRODUCT_REGEX.test(url);
            var isCorrectPattern = SEO_CONSTANTS.SHOPIFY_CORRECT_PRODUCT_REGEX.test(url);

            var issue = null;
            var severity = 'pass';
            var suggestion = '';

            if (hasCollectionPattern) {
                issue = 'Duplicate URL via /collections/*/products/* pattern';
                severity = 'critical';

                // Extract the product slug and suggest the correct URL
                var match = url.match(/\/products\/([^\/\?#]+)/);
                if (match) {
                    try {
                        var parsed = new URL(url);
                        suggestion = parsed.origin + '/products/' + match[1];
                    } catch (e) {
                        suggestion = '/products/' + match[1];
                    }
                }
            } else if (isCorrectPattern) {
                issue = null;
                severity = 'pass';
            } else {
                // Check other URL structure issues
                try {
                    var parsed = new URL(url);
                    var path = parsed.pathname;

                    // Check for overly long slugs
                    var segments = path.split('/').filter(function (s) { return s.length > 0; });
                    if (segments.some(function (s) { return s.length > 80; })) {
                        issue = 'Overly long URL slug';
                        severity = 'warning';
                    }

                    // Check for unnecessary nesting
                    if (segments.length > 3) {
                        issue = 'Deeply nested URL structure (' + segments.length + ' levels)';
                        severity = 'warning';
                    }
                } catch (e) {
                    // Not a valid URL, skip deep analysis
                }
            }

            results.push({
                url: url,
                issue: issue,
                severity: severity,
                suggestion: suggestion
            });
        });

        this.results = results;
        this.displayResults();

        var issues = results.filter(function (r) { return r.severity !== 'pass'; });
        if (issues.length > 0) {
            var critical = results.filter(function (r) { return r.severity === 'critical'; });
            AuditState.setCheck('shopify-urls',
                critical.length > 0 ? SEO_CONSTANTS.SEVERITY.CRITICAL : SEO_CONSTANTS.SEVERITY.WARNING,
                issues.length + ' URL structure issues found'
            );
        } else {
            AuditState.setCheck('shopify-urls', SEO_CONSTANTS.SEVERITY.PASS, 'URL structure looks correct');
        }

        App.showToast('URL analysis complete', 'success');
    },

    displayResults: function () {
        var container = document.getElementById('shopify-results');
        var results = this.results;
        if (!results) return;

        var issues = results.filter(function (r) { return r.severity !== 'pass'; });
        var ok = results.filter(function (r) { return r.severity === 'pass'; });

        var html = '';

        // Summary
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">';
        html += '<div class="score-card"><div class="score-label">URLs Checked</div><div style="font-size:1.3rem;font-weight:700;color:var(--text-primary);">' + results.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">Issues</div><div style="font-size:1.3rem;font-weight:700;color:' + (issues.length > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)') + ';">' + issues.length + '</div></div>';
        html += '<div class="score-card"><div class="score-label">OK</div><div style="font-size:1.3rem;font-weight:700;color:var(--accent-emerald);">' + ok.length + '</div></div>';
        html += '</div>';

        // Results
        results.forEach(function (r) {
            var cardClass = r.severity === 'pass' ? 'ok' : 'issue';
            html += '<div class="url-result-card ' + cardClass + '">';
            html += '  <div class="url-result-url">';
            html += '    <span class="severity-badge severity-' + r.severity + '">' + r.severity.toUpperCase() + '</span> ';
            html += '    ' + r.url;
            html += '  </div>';
            if (r.issue) {
                html += '  <div class="url-result-detail">⚠ ' + r.issue + '</div>';
            }
            if (r.suggestion) {
                html += '  <div class="url-result-detail" style="color:var(--accent-emerald);margin-top:4px;">✓ Correct URL: <code style="background:rgba(52,211,153,0.1);padding:2px 8px;border-radius:4px;">' + r.suggestion + '</code></div>';
            }
            if (r.severity === 'pass') {
                html += '  <div class="url-result-detail" style="color:var(--accent-emerald);">✓ URL structure is correct</div>';
            }
            html += '</div>';
        });

        container.innerHTML = html;
    },

    getFindings: function () {
        if (!this.results) return null;
        var issues = this.results.filter(function (r) { return r.severity !== 'pass'; });
        return {
            title: 'Shopify URL Structure',
            severity: issues.length > 0 ? 'critical' : 'pass',
            data: this.results
        };
    }
};
