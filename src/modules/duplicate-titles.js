/* ============================================
   DUPLICATE TITLES MODULE
   Finds and displays pages with non-unique titles
   ============================================ */
var DuplicateTitlesModule = {
    results: null,

    init: function () {
        // This module is mostly reactive to data from MetaTitlesModule or AutoAudit
    },

    setResults: function (duplicates) {
        this.results = duplicates;
        this.displayResults();
    },

    displayResults: function () {
        var container = document.getElementById('duplicate-titles-results');
        var empty = document.getElementById('duplicate-titles-empty');
        var r = this.results;

        if (!r || r.length === 0) {
            container.style.display = 'none';
            empty.style.display = 'block';
            empty.innerHTML = '<p style="color:var(--accent-emerald);font-weight:600;font-size:1.1rem;">✓ No duplicated page titles found</p>';
            return;
        }

        empty.style.display = 'none';
        container.style.display = 'block';

        var html = '';
        html += '<div class="score-card" style="margin-bottom:20px;">';
        html += '<div class="score-label">Duplicate Titles Found</div>';
        html += '<div style="font-size:1.5rem;font-weight:700;color:var(--accent-red);">' + r.length + '</div>';
        html += '</div>';

        html += '<table class="result-table"><thead><tr><th>#</th><th>Page Title</th><th>Occurrences</th><th>URLs</th></tr></thead><tbody>';
        r.forEach(function (item, i) {
            html += '<tr>';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td style="font-weight:600;">' + item.title + '</td>';
            html += '<td><span class="severity-badge severity-critical">' + item.urls.length + '</span></td>';
            html += '<td style="font-size:0.8rem;max-width:300px;overflow-wrap:break-word;">' + item.urls.join('<br>') + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';

        container.innerHTML = html;
    }
};
