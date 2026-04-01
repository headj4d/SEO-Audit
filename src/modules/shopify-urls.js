/* ============================================
   SHOPIFY URLS MODULE — Automatic Collection URL Checker
   Crawls site to find collection pages, detects
   unoptimized /collections/.../products/... patterns
   ============================================ */
var ShopifyUrlsModule = {
    results: null,
    isRunning: false,

    init: function () {
        var self = this;
        var btn = document.getElementById('btn-shopify-check');
        if (btn) {
            btn.addEventListener('click', function () {
                self.startScan();
            });
        }
    },

    getUrl: function () {
        // Try domain input first (main app audit domain)
        var domainInput = document.getElementById('audit-domain');
        var url = domainInput ? domainInput.value.trim() : '';

        // Fallback to dedicated input
        if (!url) {
            var shopifyInput = document.getElementById('shopify-scan-url');
            url = shopifyInput ? shopifyInput.value.trim() : '';
        }

        if (url && !url.startsWith('http')) url = 'https://' + url;
        return url;
    },

    startScan: function () {
        if (this.isRunning) return;

        var url = this.getUrl();
        if (!url) {
            App.showToast('Please enter a website URL in the domain field or URL input above', 'error');
            return;
        }

        // Also populate the dedicated input with the URL
        var shopifyInput = document.getElementById('shopify-scan-url');
        if (shopifyInput) shopifyInput.value = url;

        this.isRunning = true;
        var self = this;

        var btn = document.getElementById('btn-shopify-check');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:8px;"></div> Scanning...';
        }

        // Show progress area
        var progressEl = document.getElementById('shopify-progress');
        if (progressEl) {
            progressEl.style.display = 'block';
            progressEl.innerHTML = '<div class="loading-indicator" style="display:flex;padding:15px;align-items:center;gap:10px;">' +
                '<div class="spinner"></div><span id="shopify-progress-text">Starting scan...</span></div>';
        }

        // Hide previous results
        var resultsEl = document.getElementById('shopify-results');
        if (resultsEl) resultsEl.innerHTML = '';

        // Connect to SSE endpoint
        var evtSource = new EventSource('/api/check-shopify-urls?url=' + encodeURIComponent(url));

        evtSource.onmessage = function (event) {
            var data;
            try {
                data = JSON.parse(event.data);
            } catch (e) { return; }

            if (data.type === 'progress') {
                var progressText = document.getElementById('shopify-progress-text');
                if (progressText) progressText.textContent = data.message || 'Working...';
            }

            if (data.type === 'complete') {
                evtSource.close();
                self.isRunning = false;
                self.results = data.result;
                self.renderResults(data.result);
                self.updateDashboard(data.result);
                self.resetButton();
                if (progressEl) progressEl.style.display = 'none';
                App.showToast('Shopify URL structure check complete', 'success');
            }

            if (data.type === 'error') {
                evtSource.close();
                self.isRunning = false;
                self.resetButton();
                if (progressEl) progressEl.style.display = 'none';
                App.showToast('Scan failed: ' + (data.message || 'Unknown error'), 'error');
                var resultsEl = document.getElementById('shopify-results');
                if (resultsEl) {
                    resultsEl.innerHTML = '<div class="error-banner" style="background:rgba(239,68,68,0.1);color:var(--accent-red);padding:15px;border-radius:6px;margin-top:15px;">' +
                        '<strong>Error:</strong> ' + (data.message || 'Unknown error') + '</div>';
                }
            }
        };

        evtSource.onerror = function () {
            evtSource.close();
            self.isRunning = false;
            self.resetButton();
            if (progressEl) progressEl.style.display = 'none';
            App.showToast('Connection to server lost', 'error');
        };
    },

    resetButton: function () {
        var btn = document.getElementById('btn-shopify-check');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>' +
                '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>' +
                '</svg> Analyze URLs';
        }
    },

    renderResults: function (data) {
        var container = document.getElementById('shopify-results');
        if (!container) return;

        var html = '';

        // --- Handle non-Shopify / no-collections states ---
        if (data.status === 'not-shopify') {
            html = this.renderEmptyState('🔍', 'Shopify collection structure not detected',
                'The site at <strong>' + this.escapeHtml(data.url) + '</strong> does not appear to use Shopify collections. This check only applies to Shopify stores.');
            container.innerHTML = html;
            return;
        }

        if (data.status === 'no-collections') {
            html = this.renderEmptyState('📂', 'No collection pages detected',
                'Shopify signals were detected, but no collection pages could be found on the site.');
            container.innerHTML = html;
            return;
        }

        if (data.status === 'error') {
            html = '<div class="error-banner" style="background:rgba(239,68,68,0.1);color:var(--accent-red);padding:15px;border-radius:6px;margin-top:15px;">' +
                '<strong>Error:</strong> ' + this.escapeHtml(data.message) + '</div>';
            container.innerHTML = html;
            return;
        }

        // --- Summary cards ---
        var issueColor = data.uniqueProblematicUrls > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)';
        html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0;">';
        html += this.renderStatCard('Collection Pages Checked', data.collectionPagesChecked, 'var(--text-primary)');
        html += this.renderStatCard('Problematic URLs Found', data.uniqueProblematicUrls, issueColor);
        html += this.renderStatCard('OK Collection Pages', data.collectionPagesClean, 'var(--accent-emerald)');
        html += this.renderStatCard('Pages with Issues', data.collectionPagesWithIssues, data.collectionPagesWithIssues > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)');
        html += '</div>';

        // --- Shopify detection info ---
        if (data.shopifySignals && data.shopifySignals.length > 0) {
            html += '<div style="padding:10px 14px;background:rgba(96,165,250,0.08);border-radius:6px;font-size:13px;color:var(--text-muted);margin-bottom:16px;">';
            html += '🏪 Shopify detected via: ' + data.shopifySignals.join(', ');
            html += '</div>';
        }

        // --- PASS state ---
        if (data.status === 'pass') {
            html += '<div style="padding:20px;background:rgba(5,150,105,0.1);border-radius:8px;text-align:center;margin-bottom:20px;">';
            html += '<div style="font-size:28px;margin-bottom:8px;">✓</div>';
            html += '<strong style="color:var(--accent-emerald);font-size:16px;">No unoptimized Shopify URL structure found</strong>';
            html += '<p style="color:var(--text-muted);margin-top:8px;font-size:14px;">All checked collection pages use the correct /products/ URL structure.</p>';
            html += '</div>';
        }

        // --- Result table ---
        if (data.collectionResults && data.collectionResults.length > 0) {
            html += '<h3 style="font-size:15px;font-weight:600;margin-bottom:12px;color:var(--text-primary);">Collection Page Results</h3>';

            data.collectionResults.forEach(function (cr) {
                var isIssue = cr.status === 'issue';
                var borderColor = isIssue ? 'var(--accent-red)' : 'var(--accent-emerald)';
                var statusBadge = isIssue
                    ? '<span class="severity-badge severity-critical">ISSUE</span>'
                    : '<span class="severity-badge severity-pass">PASS</span>';

                html += '<div style="border:1px solid var(--border-subtle);border-left:4px solid ' + borderColor + ';border-radius:6px;padding:14px;margin-bottom:12px;background:var(--bg-card);">';

                // Collection page header
                html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">';
                html += statusBadge;
                html += '<a href="' + cr.collectionUrl + '" target="_blank" style="color:var(--text-primary);font-weight:500;text-decoration:none;word-break:break-all;">' + cr.collectionUrl + '</a>';
                html += '</div>';
                html += '<p style="font-size:13px;color:var(--text-muted);margin:0 0 8px 0;">' + cr.message + '</p>';

                // Problematic URLs
                if (isIssue && cr.problematicUrls.length > 0) {
                    html += '<div style="margin-top:10px;">';
                    html += '<p style="font-size:12px;font-weight:600;color:var(--accent-red);margin-bottom:6px;">⚠ ' + cr.problematicUrls.length + ' Problematic URL(s):</p>';

                    cr.problematicUrls.forEach(function (pUrl, idx) {
                        var copyId = 'copy-url-' + cr.collectionHandle + '-' + idx;
                        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-dark);border-radius:4px;margin-bottom:4px;font-size:13px;">';
                        html += '<code style="flex:1;word-break:break-all;color:var(--accent-red);background:transparent;">' + pUrl + '</code>';
                        html += '<button class="btn-copy-url" data-url="' + pUrl + '" id="' + copyId + '" style="flex-shrink:0;padding:4px 10px;background:rgba(96,165,250,0.15);color:var(--accent-blue);border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;" title="Copy URL">Copy</button>';
                        html += '</div>';
                    });

                    html += '</div>';
                }

                html += '</div>';
            });
        }

        container.innerHTML = html;

        // Attach copy button handlers
        container.querySelectorAll('.btn-copy-url').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var urlToCopy = btn.getAttribute('data-url');
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(urlToCopy).then(function () {
                        btn.textContent = '✓ Copied';
                        btn.style.background = 'rgba(5,150,105,0.2)';
                        btn.style.color = 'var(--accent-emerald)';
                        setTimeout(function () {
                            btn.textContent = 'Copy';
                            btn.style.background = 'rgba(96,165,250,0.15)';
                            btn.style.color = 'var(--accent-blue)';
                        }, 2000);
                    });
                } else {
                    // Fallback for older browsers
                    var ta = document.createElement('textarea');
                    ta.value = urlToCopy;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    btn.textContent = '✓ Copied';
                    setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
                }
            });
        });
    },

    renderStatCard: function (label, value, color) {
        return '<div class="score-card">' +
            '<div class="score-label">' + label + '</div>' +
            '<div style="font-size:1.3rem;font-weight:700;color:' + color + ';">' + value + '</div>' +
            '</div>';
    },

    renderEmptyState: function (icon, title, description) {
        return '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);">' +
            '<div style="font-size:40px;margin-bottom:12px;">' + icon + '</div>' +
            '<h3 style="color:var(--text-primary);font-size:16px;margin-bottom:8px;">' + title + '</h3>' +
            '<p style="font-size:14px;max-width:400px;margin:0 auto;">' + description + '</p>' +
            '</div>';
    },

    escapeHtml: function (str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    },

    updateDashboard: function (data) {
        if (!data) return;
        if (data.status === 'pass' || data.status === 'not-shopify' || data.status === 'no-collections') {
            AuditState.setCheck('shopify-urls', SEO_CONSTANTS.SEVERITY.PASS,
                data.status === 'pass' ? 'URL structure looks correct' : data.message);
        } else if (data.status === 'warning') {
            AuditState.setCheck('shopify-urls', SEO_CONSTANTS.SEVERITY.WARNING,
                data.uniqueProblematicUrls + ' unoptimized URL(s) found');
        } else {
            AuditState.setCheck('shopify-urls', SEO_CONSTANTS.SEVERITY.PENDING, 'Check error');
        }
    },

    getFindings: function () {
        if (!this.results) return null;
        return {
            title: 'Shopify URL Structure',
            severity: this.results.status === 'warning' ? 'critical' : 'pass',
            data: this.results
        };
    }
};
