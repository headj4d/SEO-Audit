/* ============================================
   PAGESPEED MODULE
   Checks Google PageSpeed Insights score
   ============================================ */
var PageSpeedModule = {
    results: null,

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
            App.showToast('Please enter a URL', 'error');
            return;
        }
        if (!url.startsWith('http')) url = 'https://' + url;

        var self = this;
        var loading = document.getElementById('pagespeed-loading');
        var results = document.getElementById('pagespeed-results');
        var btn = document.getElementById('btn-pagespeed-run');

        loading.style.display = 'flex';
        results.innerHTML = '';
        btn.disabled = true;

        var completed = 0;
        var scores = { mobile: null, desktop: null };

        function fetchStrategy(strategy) {
            var apiUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url='
                + encodeURIComponent(url) + '&strategy=' + strategy;

            fetch(apiUrl)
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.lighthouseResult) {
                        scores[strategy] = Math.round(data.lighthouseResult.categories.performance.score * 100);
                    }
                })
                .catch(function (err) {
                    console.error('PageSpeed error (' + strategy + '):', err);
                })
                .finally(function () {
                    completed++;
                    if (completed === 2) {
                        self.displayResults(scores, url);
                        loading.style.display = 'none';
                        btn.disabled = false;
                    }
                });
        }

        fetchStrategy('mobile');
        fetchStrategy('desktop');
    },

    displayResults: function (scores, url) {
        this.results = { url: url, mobile: scores.mobile, desktop: scores.desktop };
        var container = document.getElementById('pagespeed-results');

        function scoreClass(s) {
            if (s === null) return 'score-fail';
            if (s < 50) return 'score-fail';
            if (s < 90) return 'score-avg';
            return 'score-good';
        }

        function scoreText(s) {
            return s !== null ? s : '?';
        }

        var severity = SEO_CONSTANTS.SEVERITY.PASS;
        var detail = 'Both scores above 50';
        if (scores.mobile !== null && scores.mobile < 50) {
            severity = SEO_CONSTANTS.SEVERITY.CRITICAL;
            detail = 'Mobile score below 50';
        }
        if (scores.desktop !== null && scores.desktop < 50) {
            severity = SEO_CONSTANTS.SEVERITY.CRITICAL;
            detail = severity === SEO_CONSTANTS.SEVERITY.CRITICAL ? 'Both scores below 50' : 'Desktop score below 50';
        }

        container.innerHTML = ''
            + '<div class="pagespeed-scores">'
            + '  <div class="score-card">'
            + '    <div class="score-label">📱 Mobile</div>'
            + '    <div class="score-circle ' + scoreClass(scores.mobile) + '">' + scoreText(scores.mobile) + '</div>'
            + '    <div class="score-label">' + (scores.mobile !== null && scores.mobile < 50 ? '<span class="severity-badge severity-critical">Critical</span>' : scores.mobile !== null && scores.mobile < 90 ? '<span class="severity-badge severity-warning">Needs Work</span>' : '<span class="severity-badge severity-pass">Good</span>') + '</div>'
            + '  </div>'
            + '  <div class="score-card">'
            + '    <div class="score-label">🖥️ Desktop</div>'
            + '    <div class="score-circle ' + scoreClass(scores.desktop) + '">' + scoreText(scores.desktop) + '</div>'
            + '    <div class="score-label">' + (scores.desktop !== null && scores.desktop < 50 ? '<span class="severity-badge severity-critical">Critical</span>' : scores.desktop !== null && scores.desktop < 90 ? '<span class="severity-badge severity-warning">Needs Work</span>' : '<span class="severity-badge severity-pass">Good</span>') + '</div>'
            + '  </div>'
            + '</div>'
            + '<p style="color:var(--text-secondary);font-size:0.85rem;">Tested URL: <a href="' + url + '" target="_blank">' + url + '</a></p>';

        // Update audit state
        AuditState.setCheck('pagespeed', severity, detail);
        App.showToast('PageSpeed test complete', 'success');
    },

    getFindings: function () {
        if (!this.results) return null;
        return {
            title: 'PageSpeed Insights',
            severity: (this.results.mobile < 50 || this.results.desktop < 50) ? 'critical' : 'pass',
            data: this.results
        };
    }
};
