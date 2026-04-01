/* ============================================
   PAGESPEED MODULE — Full PSI Integration
   Uses backend /api/pagespeed proxy
   ============================================ */
var PageSpeedModule = {
    results: null,
    activeStrategy: 'mobile',

    init: function () {
        var self = this;
        document.getElementById('btn-pagespeed-run').addEventListener('click', function () {
            self.runTest();
        });
        document.getElementById('pagespeed-url').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') self.runTest();
        });
    },

    runTest: function () {
        var url = document.getElementById('pagespeed-url').value.trim();
        if (!url) {
            App.showToast('Please enter a URL to analyze', 'error');
            return;
        }
        if (!url.startsWith('http')) url = 'https://' + url;

        var self = this;
        var loading = document.getElementById('pagespeed-loading');
        var results = document.getElementById('pagespeed-results');
        var btn = document.getElementById('btn-pagespeed-run');

        loading.style.display = 'block';
        results.innerHTML = '';
        btn.disabled = true;

        fetch('/api/pagespeed?url=' + encodeURIComponent(url))
            .then(function (res) {
                if (!res.ok) return res.json().then(function (e) { throw new Error(e.error || 'API request failed'); });
                return res.json();
            })
            .then(function (data) {
                self.results = data;
                self.activeStrategy = 'mobile';
                self.renderResults(data);
                self.updateAuditState(data);
                App.showToast('PageSpeed analysis complete', 'success');
            })
            .catch(function (err) {
                results.innerHTML = self.renderError(err.message);
                App.showToast('PageSpeed analysis failed', 'error');
            })
            .finally(function () {
                loading.style.display = 'none';
                btn.disabled = false;
            });
    },

    // ——— SVG GAUGE ———
    buildGauge: function (score, size) {
        size = size || 120;
        var radius = (size / 2) - 8;
        var circumference = 2 * Math.PI * radius;
        var offset = circumference - (score / 100) * circumference;
        var color = score >= 90 ? 'var(--accent-emerald)' : score >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)';
        var bgColor = score >= 90 ? 'var(--accent-emerald-dim)' : score >= 50 ? 'var(--accent-amber-dim)' : 'var(--accent-red-dim)';
        var label = score >= 90 ? 'Good' : score >= 50 ? 'Needs Improvement' : 'Poor';

        return '<div class="psi-gauge-wrap">'
            + '<svg class="psi-gauge" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">'
            + '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + radius + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>'
            + '<circle class="psi-gauge-ring" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="6" stroke-linecap="round"'
            + ' stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 ' + (size/2) + ' ' + (size/2) + ')"/>'
            + '</svg>'
            + '<div class="psi-gauge-score" style="color:' + color + '">' + score + '</div>'
            + '<div class="psi-gauge-label" style="color:' + color + '">' + label + '</div>'
            + '</div>';
    },

    // ——— CWV ASSESSMENT BANNER ———
    buildCWVBanner: function (assessment, source) {
        var cls, icon, text;
        if (assessment === 'passed') {
            cls = 'psi-cwv-passed';
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>';
            text = 'Core Web Vitals Assessment: <strong>Passed</strong>';
        } else if (assessment === 'not_passed') {
            cls = 'psi-cwv-failed';
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
            text = 'Core Web Vitals Assessment: <strong>Not Passed</strong>';
        } else {
            cls = 'psi-cwv-na';
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
            text = 'Core Web Vitals Assessment: <strong>Not Available</strong>';
        }

        var sourceLabel = source ? ' <span class="psi-source-badge">' + (source === 'page' ? 'Page data' : 'Origin data') + '</span>' : '';

        return '<div class="psi-cwv-banner ' + cls + '">'
            + icon + ' <span>' + text + sourceLabel + '</span>'
            + '</div>';
    },

    // ——— FIELD DATA METRICS ———
    buildFieldMetrics: function (fieldData) {
        if (!fieldData || !fieldData.metrics || Object.keys(fieldData.metrics).length === 0) {
            return '<div class="psi-empty-section"><p>Field data (CrUX) is not available for this URL. This typically means the page does not have enough real-user traffic in the Chrome UX Report.</p></div>';
        }

        var html = '<div class="psi-metrics-section">';
        var metricOrder = ['lcp', 'inp', 'cls', 'fcp', 'ttfb'];
        var self = this;

        metricOrder.forEach(function (key) {
            var m = fieldData.metrics[key];
            if (!m) return;

            var catClass = m.category === 'FAST' ? 'good' : m.category === 'AVERAGE' ? 'avg' : 'poor';
            var catLabel = m.category === 'FAST' ? 'Good' : m.category === 'AVERAGE' ? 'Needs Improvement' : 'Poor';
            var displayVal = self.formatMetricValue(m.value, m.unit);

            // Build distribution bar
            var distHtml = '';
            if (m.distributions && m.distributions.length === 3) {
                var good = Math.round(m.distributions[0].proportion * 100);
                var avg = Math.round(m.distributions[1].proportion * 100);
                var poor = Math.round(m.distributions[2].proportion * 100);
                distHtml = '<div class="psi-dist-bar">'
                    + '<div class="psi-dist-seg psi-dist-good" style="width:' + good + '%">' + (good > 8 ? good + '%' : '') + '</div>'
                    + '<div class="psi-dist-seg psi-dist-avg" style="width:' + avg + '%">' + (avg > 8 ? avg + '%' : '') + '</div>'
                    + '<div class="psi-dist-seg psi-dist-poor" style="width:' + poor + '%">' + (poor > 8 ? poor + '%' : '') + '</div>'
                    + '</div>';
            }

            html += '<div class="psi-metric-row">'
                + '<div class="psi-metric-header">'
                + '  <span class="psi-metric-name">' + m.label + '</span>'
                + '  <span class="psi-metric-value psi-cat-' + catClass + '">' + displayVal + '</span>'
                + '</div>'
                + distHtml
                + '<div class="psi-metric-footer">'
                + '  <span class="severity-badge severity-' + (catClass === 'good' ? 'pass' : catClass === 'avg' ? 'warning' : 'critical') + '">' + catLabel + '</span>'
                + '</div>'
                + '</div>';
        });

        html += '</div>';
        return html;
    },

    formatMetricValue: function (value, unit) {
        if (unit === 'ms') {
            if (value >= 1000) return (value / 1000).toFixed(1) + ' s';
            return value + ' ms';
        }
        if (value !== undefined && value !== null) {
            // CLS is unitless, show 2 decimal places
            if (typeof value === 'number' && value < 1) return value.toFixed(2);
            return String(value);
        }
        return '—';
    },

    // ——— LAB DATA ———
    buildLabData: function (labData) {
        if (!labData || !labData.metrics || labData.metrics.length === 0) {
            return '<div class="psi-empty-section"><p>Lab data is not available.</p></div>';
        }

        var html = '<div class="psi-lab-grid">';
        labData.metrics.forEach(function (m) {
            var scoreClass = m.score === null ? '' : m.score >= 0.9 ? 'good' : m.score >= 0.5 ? 'avg' : 'poor';
            var dotColor = m.score === null ? 'var(--text-muted)' : m.score >= 0.9 ? 'var(--accent-emerald)' : m.score >= 0.5 ? 'var(--accent-amber)' : 'var(--accent-red)';

            html += '<div class="psi-lab-card">'
                + '<div class="psi-lab-dot" style="background:' + dotColor + '"></div>'
                + '<div class="psi-lab-info">'
                + '  <span class="psi-lab-label">' + m.label + '</span>'
                + '  <span class="psi-lab-value psi-cat-' + scoreClass + '">' + (m.displayValue || '—') + '</span>'
                + '</div>'
                + '</div>';
        });
        html += '</div>';
        return html;
    },

    // ——— OPPORTUNITIES ———
    buildOpportunities: function (opportunities) {
        if (!opportunities || opportunities.length === 0) {
            return '<div class="psi-empty-section"><p>No performance opportunities detected. Great job!</p></div>';
        }

        var html = '<div class="psi-opportunities-list">';
        opportunities.forEach(function (opp, idx) {
            var savingsText = opp.savings ? '<span class="psi-opp-savings">' + (opp.savings >= 1000 ? (opp.savings / 1000).toFixed(1) + ' s' : opp.savings + ' ms') + '</span>' : '';
            var scoreColor = opp.score !== null && opp.score !== undefined ?
                (opp.score >= 0.9 ? 'var(--accent-emerald)' : opp.score >= 0.5 ? 'var(--accent-amber)' : 'var(--accent-red)') : 'var(--text-muted)';

            html += '<div class="psi-opp-row" onclick="this.classList.toggle(\'expanded\')">'
                + '<div class="psi-opp-header">'
                + '  <div class="psi-opp-indicator" style="background:' + scoreColor + '"></div>'
                + '  <span class="psi-opp-title">' + opp.title + '</span>'
                + savingsText
                + '  <svg class="psi-opp-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg>'
                + '</div>'
                + '<div class="psi-opp-details">'
                + '  <p>' + (opp.displayValue || '') + '</p>'
                + '</div>'
                + '</div>';
        });
        html += '</div>';
        return html;
    },

    // ——— DIAGNOSTICS ———
    buildDiagnostics: function (diagnostics, passedCount) {
        var html = '';

        if (diagnostics && diagnostics.length > 0) {
            html += '<div class="psi-diagnostics-list">';
            diagnostics.forEach(function (d) {
                var scoreColor = d.score >= 0.9 ? 'var(--accent-emerald)' : d.score >= 0.5 ? 'var(--accent-amber)' : 'var(--accent-red)';
                html += '<div class="psi-diag-row">'
                    + '<div class="psi-opp-indicator" style="background:' + scoreColor + '"></div>'
                    + '<span class="psi-diag-title">' + d.title + '</span>'
                    + (d.displayValue ? '<span class="psi-diag-value">' + d.displayValue + '</span>' : '')
                    + '</div>';
            });
            html += '</div>';
        }

        if (passedCount > 0) {
            html += '<div class="psi-passed-audits">'
                + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>'
                + ' <span>' + passedCount + ' audits passed</span>'
                + '</div>';
        }

        return html || '<div class="psi-empty-section"><p>No diagnostics available.</p></div>';
    },

    // ——— ERROR ———
    renderError: function (message) {
        return '<div class="card">'
            + '<div class="psi-error-banner">'
            + '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
            + '<div>'
            + '<strong>Could not fetch PageSpeed Insights data</strong>'
            + '<p style="margin-top:4px;color:var(--text-muted);font-size:0.85rem">' + message + '</p>'
            + '</div>'
            + '</div>'
            + '</div>';
    },

    // ——— MAIN RENDER ———
    renderResults: function (data) {
        var container = document.getElementById('pagespeed-results');
        var self = this;

        var mobileScore = data.mobile.labData ? data.mobile.labData.performanceScore : null;
        var desktopScore = data.desktop.labData ? data.desktop.labData.performanceScore : null;

        // Overview bar
        var timestamp = data.timestamp ? new Date(data.timestamp).toLocaleString() : '';
        var overviewHtml = '<div class="card psi-overview-bar">'
            + '<div class="psi-overview-info">'
            + '  <span class="psi-overview-url" title="' + data.url + '">Tested: <a href="' + data.url + '" target="_blank">' + data.url + '</a></span>'
            + (data.finalUrl && data.finalUrl !== data.url ? '  <span class="psi-overview-final">Resolved: <a href="' + data.finalUrl + '" target="_blank">' + data.finalUrl + '</a></span>' : '')
            + '</div>'
            + '<span class="psi-overview-time">' + timestamp + '</span>'
            + '</div>';

        // Score cards — side by side
        var scoresHtml = '<div class="psi-scores-row">'
            + '<div class="card psi-score-panel">'
            + '  <div class="psi-strategy-label">📱 Mobile</div>'
            + (mobileScore !== null ? self.buildGauge(mobileScore, 140) : '<div class="psi-gauge-wrap"><div class="psi-gauge-score" style="color:var(--text-muted)">—</div><div class="psi-gauge-label" style="color:var(--text-muted)">No data</div></div>')
            + '</div>'
            + '<div class="card psi-score-panel">'
            + '  <div class="psi-strategy-label">🖥️ Desktop</div>'
            + (desktopScore !== null ? self.buildGauge(desktopScore, 140) : '<div class="psi-gauge-wrap"><div class="psi-gauge-score" style="color:var(--text-muted)">—</div><div class="psi-gauge-label" style="color:var(--text-muted)">No data</div></div>')
            + '</div>'
            + '</div>';

        // Strategy tabs
        var tabsHtml = '<div class="psi-strategy-tabs">'
            + '<button class="psi-tab active" data-strategy="mobile" id="psi-tab-mobile">📱 Mobile</button>'
            + '<button class="psi-tab" data-strategy="desktop" id="psi-tab-desktop">🖥️ Desktop</button>'
            + '</div>';

        // Detail content — one panel per strategy, toggled
        var detailHtml = '<div id="psi-detail-mobile" class="psi-detail-panel active">'
            + self.buildStrategyDetail(data.mobile, 'Mobile')
            + '</div>'
            + '<div id="psi-detail-desktop" class="psi-detail-panel">'
            + self.buildStrategyDetail(data.desktop, 'Desktop')
            + '</div>';

        container.innerHTML = overviewHtml + scoresHtml + tabsHtml + detailHtml;

        // Tab click handlers
        container.querySelectorAll('.psi-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                var strategy = tab.getAttribute('data-strategy');
                container.querySelectorAll('.psi-tab').forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
                container.querySelectorAll('.psi-detail-panel').forEach(function (p) { p.classList.remove('active'); });
                document.getElementById('psi-detail-' + strategy).classList.add('active');
                self.activeStrategy = strategy;
            });
        });
    },

    buildStrategyDetail: function (strategyData, label) {
        var html = '';

        // CWV Assessment
        html += this.buildCWVBanner(
            strategyData.fieldData.cwvAssessment,
            strategyData.fieldData.source
        );

        // Field Data
        html += '<div class="card">'
            + '<h3 class="card-title">Discover what your real users are experiencing</h3>'
            + '<p class="card-desc">Field data from the Chrome UX Report (CrUX) — real-user metrics collected over the last 28 days.</p>'
            + this.buildFieldMetrics(strategyData.fieldData)
            + '</div>';

        // Lab Data
        html += '<div class="card">'
            + '<h3 class="card-title">Diagnose performance issues</h3>'
            + '<p class="card-desc">Lab data from Lighthouse — simulated performance analysis. Values may differ from real-user data.</p>'
            + this.buildLabData(strategyData.labData)
            + '</div>';

        // Opportunities
        html += '<div class="card">'
            + '<h3 class="card-title">Opportunities</h3>'
            + '<p class="card-desc">Suggestions to improve page load speed. Estimated savings are approximate.</p>'
            + this.buildOpportunities(strategyData.opportunities)
            + '</div>';

        // Diagnostics
        html += '<div class="card">'
            + '<h3 class="card-title">Diagnostics</h3>'
            + '<p class="card-desc">Additional information about your page performance.</p>'
            + this.buildDiagnostics(strategyData.diagnostics, strategyData.passedAudits)
            + '</div>';

        return html;
    },

    // ——— AUDIT STATE ———
    updateAuditState: function (data) {
        var mobileScore = data.mobile.labData ? data.mobile.labData.performanceScore : null;
        var desktopScore = data.desktop.labData ? data.desktop.labData.performanceScore : null;
        var mobileCWV = data.mobile.fieldData.cwvAssessment;
        var desktopCWV = data.desktop.fieldData.cwvAssessment;

        var severity = SEO_CONSTANTS.SEVERITY.PASS;
        var detail = 'Both scores in good range';

        // Check scores
        if ((mobileScore !== null && mobileScore < 50) || (desktopScore !== null && desktopScore < 50)) {
            severity = SEO_CONSTANTS.SEVERITY.CRITICAL;
            detail = 'Performance score below 50';
        } else if ((mobileScore !== null && mobileScore < 90) || (desktopScore !== null && desktopScore < 90)) {
            severity = SEO_CONSTANTS.SEVERITY.WARNING;
            detail = 'Performance needs improvement';
        }

        // Escalate if CWV fails
        if (mobileCWV === 'not_passed' || desktopCWV === 'not_passed') {
            if (severity !== SEO_CONSTANTS.SEVERITY.CRITICAL) {
                severity = SEO_CONSTANTS.SEVERITY.WARNING;
                detail = 'Core Web Vitals not passed';
            }
        }

        AuditState.setCheck('pagespeed', severity, detail);
    },

    getFindings: function () {
        if (!this.results) return null;
        var mobileScore = this.results.mobile && this.results.mobile.labData ? this.results.mobile.labData.performanceScore : null;
        var desktopScore = this.results.desktop && this.results.desktop.labData ? this.results.desktop.labData.performanceScore : null;
        return {
            title: 'PageSpeed Insights',
            severity: (mobileScore !== null && mobileScore < 50) || (desktopScore !== null && desktopScore < 50) ? 'critical' :
                     (mobileScore !== null && mobileScore < 90) || (desktopScore !== null && desktopScore < 90) ? 'warning' : 'pass',
            data: {
                url: this.results.url,
                mobile: mobileScore,
                desktop: desktopScore,
                mobileCWV: this.results.mobile ? this.results.mobile.fieldData.cwvAssessment : 'unavailable',
                desktopCWV: this.results.desktop ? this.results.desktop.fieldData.cwvAssessment : 'unavailable'
            }
        };
    }
};
