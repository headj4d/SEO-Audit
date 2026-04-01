/* ============================================
   4XX ISSUES MODULE
   Reads Ahrefs Site Audit issue exports and
   extracts internal and external broken links.
   ============================================ */
var FourxxIssuesModule = {
    results: null,

    // Ahrefs column candidates
    AHREFS_COLS: {
        url: ['URL'],
        title: ['Title'],
        statusCode: ['HTTP status code', 'Status code'],
        organicTraffic: ['Organic traffic'],
        depth: ['Depth'],
        internalOutlinks: ['Internal outlinks to 4xx'],
        internalOutlinkCodes: ['Internal outlinks codes (4xx)', 'Internal outlinks codes'],
        externalOutlinks: ['External outlinks to 4xx'],
        externalOutlinkCodes: ['External outlinks codes (4xx)', 'External outlinks codes']
    },

    init: function () {
        var self = this;
        var zone = document.getElementById('fourxx-issues-upload-zone');
        var input = document.getElementById('fourxx-issues-file-input');
        if (!zone || !input) return;

        zone.addEventListener('click', function (e) {
            if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT') return;
            input.click();
        });
        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', function () {
            zone.classList.remove('dragover');
        });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) self.processFile(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', function () {
            if (input.files.length) self.processFile(input.files[0]);
        });
        
        // Listen for expand/collapse clicks
        document.addEventListener('click', function(e) {
            if (e.target.closest('.url-list-toggle')) {
                var btn = e.target.closest('.url-list-toggle');
                var targetId = btn.getAttribute('data-target');
                var list = document.getElementById(targetId);
                var textSpan = btn.querySelector('.toggle-text');
                if (list) {
                    if (list.style.display === 'none') {
                        list.style.display = 'block';
                        textSpan.textContent = 'Collapse';
                        btn.classList.add('expanded');
                    } else {
                        list.style.display = 'none';
                        textSpan.textContent = 'Show all ' + btn.getAttribute('data-count') + ' links';
                        btn.classList.remove('expanded');
                    }
                }
            }
            
            // Handle copy buttons
            if (e.target.closest('.copy-btn')) {
                var btn = e.target.closest('.copy-btn');
                var text = btn.getAttribute('data-copy');
                if (text) {
                    navigator.clipboard.writeText(text).then(function() {
                        var originalHtml = btn.innerHTML;
                        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                        setTimeout(function() { btn.innerHTML = originalHtml; }, 2000);
                    });
                }
            }
        });
    },

    processFile: function (file) {
        var self = this;
        var zone = document.getElementById('fourxx-issues-upload-zone');

        // Defensive encoding check and parse
        var reader = new FileReader();
        
        reader.onload = function(e) {
            var content = e.target.result;
            
            Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                complete: function(parsed) {
                    if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
                        console.error('[4xx Issues] Parse errors:', parsed.errors);
                        self.showError('Could not parse the Ahrefs report file. Please ensure it is a valid CSV/TSV format.');
                        return;
                    }
                    
                    self.processParsedData(parsed.data, parsed.meta.fields, file.name);
                },
                error: function(err) {
                    self.showError('Error parsing file: ' + err.message);
                }
            });
        };
        
        reader.onerror = function() {
            self.showError('Could not read the uploaded file.');
        };
        
        // If file ends in .csv, read as text. For Ahrefs, they normally use UTF-16 LE for Windows. 
        // We'll read as UTF-16 if it's tab separated (often .csv extension but actually TSV for Ahrefs).
        // Let's use readAsText, browser typically handles BOMs. We will fallback if needed.
        reader.readAsText(file, 'UTF-8'); 
    },
    
    // helper to find case-insensitive column
    findColumn: function(fields, candidates) {
        if (!fields || !candidates) return null;
        var fLower = fields.map(f => f.trim().toLowerCase());
        for (var i = 0; i < candidates.length; i++) {
            var cLower = candidates[i].toLowerCase();
            var index = fLower.indexOf(cLower);
            if (index !== -1) return fields[index];
        }
        return null;
    },

    processParsedData: function(data, fields, fileName) {
        var self = this;
        var zone = document.getElementById('fourxx-issues-upload-zone');
        
        // Find columns
        var colUrl = self.findColumn(fields, self.AHREFS_COLS.url);
        var colTitle = self.findColumn(fields, self.AHREFS_COLS.title);
        var colStatus = self.findColumn(fields, self.AHREFS_COLS.statusCode);
        var colTraffic = self.findColumn(fields, self.AHREFS_COLS.organicTraffic);
        var colDepth = self.findColumn(fields, self.AHREFS_COLS.depth);
        var colIntOutlinks = self.findColumn(fields, self.AHREFS_COLS.internalOutlinks);
        var colIntOutCodes = self.findColumn(fields, self.AHREFS_COLS.internalOutlinkCodes);
        var colExtOutlinks = self.findColumn(fields, self.AHREFS_COLS.externalOutlinks);
        var colExtOutCodes = self.findColumn(fields, self.AHREFS_COLS.externalOutlinkCodes);
        
        if (!colUrl) {
            self.showError('Could not find a URL column in the uploaded file. Is this an Ahrefs Site Audit export?');
            return;
        }

        var pages = [];
        var totalInternal = 0;
        var totalExternal = 0;
        
        var parseMultilineList = function(text) {
            if (!text) return [];
            return text.toString().split(/\r?\n/).map(s => s.trim()).filter(s => s);
        };

        data.forEach(function(row) {
            var pageUrl = String(row[colUrl] || '').trim();
            if (!pageUrl) return; // Skip empty rows

            // Parse internal 
            var intLinksStr = colIntOutlinks ? row[colIntOutlinks] : '';
            var intCodesStr = colIntOutCodes ? row[colIntOutCodes] : '';
            var intLinks = parseMultilineList(intLinksStr);
            var intCodes = parseMultilineList(intCodesStr);
            
            var internalBroken = [];
            var seenInt = {};
            for (var i = 0; i < intLinks.length; i++) {
                var l = intLinks[i];
                if (!seenInt[l]) {
                    seenInt[l] = true;
                    internalBroken.push({ url: l, status: intCodes[i] || '4xx' });
                }
            }

            // Parse external
            var extLinksStr = colExtOutlinks ? row[colExtOutlinks] : '';
            var extCodesStr = colExtOutCodes ? row[colExtOutCodes] : '';
            var extLinks = parseMultilineList(extLinksStr);
            var extCodes = parseMultilineList(extCodesStr);
            
            var externalBroken = [];
            var seenExt = {};
            for (var i = 0; i < extLinks.length; i++) {
                var l = extLinks[i];
                if (!seenExt[l]) {
                    seenExt[l] = true;
                    externalBroken.push({ url: l, status: extCodes[i] || '4xx' });
                }
            }

            if (internalBroken.length > 0 || externalBroken.length > 0) {
                totalInternal += internalBroken.length;
                totalExternal += externalBroken.length;
                
                pages.push({
                    url: pageUrl,
                    title: colTitle ? row[colTitle] : '',
                    status: colStatus ? row[colStatus] : '',
                    traffic: colTraffic ? row[colTraffic] : '',
                    depth: colDepth ? row[colDepth] : '',
                    internal: internalBroken,
                    external: externalBroken
                });
            }
        });

        console.log('[4xx Issues] Found', pages.length, 'pages with broken links');

        self.results = {
            pages: pages,
            totalInternal: totalInternal,
            totalExternal: totalExternal,
            fileName: fileName
        };

        self.renderResults();

        var issuesFound = pages.length > 0;
        zone.classList.add('uploaded');
        if (issuesFound) {
            zone.querySelector('p').textContent = '✓ ' + fileName + ' — ' + pages.length + ' page(s) with 4xx links';
            AuditState.setCheck('fourxx-pages', SEO_CONSTANTS.SEVERITY.WARNING, pages.length + ' pages with 4xx links found');
            App.showToast(pages.length + ' pages with 4xx links detected', 'warning');
        } else {
            zone.querySelector('p').textContent = '✓ ' + fileName + ' — No 4xx issues found';
            AuditState.setCheck('fourxx-pages', SEO_CONSTANTS.SEVERITY.PASS, 'No 4xx issues found');
            App.showToast('No broken internal or external 4xx links were found in the uploaded Ahrefs report.', 'success');
        }
    },

    showError: function(msg) {
        var container = document.getElementById('fourxx-issues-results');
        var emptyState = document.getElementById('fourxx-issues-empty');
        if (emptyState) emptyState.style.display = 'none';
        if (container) {
            container.style.display = 'block';
            container.innerHTML = '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);'
                + 'border-radius:8px;padding:16px 20px;color:var(--accent-red);">'
                + '<strong>Error</strong><br>'
                + '<span style="font-size:0.875em;opacity:0.85;">' + msg + '</span></div>';
        }
        App.showToast(msg, 'error');
    },

    renderResults: function () {
        var container = document.getElementById('fourxx-issues-results');
        var emptyState = document.getElementById('fourxx-issues-empty');
        if (!container) return;

        if (emptyState) emptyState.style.display = 'none';
        container.style.display = 'block';

        if (!this.results) {
            if (emptyState) emptyState.style.display = '';
            container.style.display = 'none';
            return;
        }

        var pages = this.results.pages;
        if (pages.length === 0) {
            container.innerHTML = this._noIssuesHTML();
            return;
        }

        var html = '';

        // 1. Summary Cards
        var totalBroken = this.results.totalInternal + this.results.totalExternal;
        html += '<div class="stats-grid" style="margin-bottom: 24px;">'
            + this._statCard('Pages with Issues', pages.length, 'critical')
            + this._statCard('Total Broken Links', totalBroken, 'warning')
            + this._statCard('Internal Broken', this.results.totalInternal)
            + this._statCard('External Broken', this.results.totalExternal)
            + '</div>';

        // 2. Results Table
        html += '<div class="results-table-container" style="overflow-x:auto;">'
            + '<table class="result-table" style="width:100%; text-align:left;">'
            + '<thead><tr>'
            + '<th style="width:250px;">Source Page</th>'
            + '<th>Internal Broken Links</th>'
            + '<th>External Broken Links</th>'
            + '</tr></thead><tbody>';

        var self = this;
        pages.forEach(function (page, i) {
            html += '<tr>'
                + '<td style="vertical-align:top; max-width: 250px;">'
                + '<div style="display:flex; align-items:flex-start; gap:6px;">'
                + '<div style="word-break:break-all; font-weight:500;">' + self._sanitize(page.url) + '</div>'
                + self._copyBtn(page.url, 'Copy Source URL')
                + '</div>';
            
            if (page.title) html += '<div style="font-size:0.8em; color:var(--text-muted); margin-top:4px;"><strong>Title:</strong> ' + self._sanitize(page.title) + '</div>';
            
            var metaArr = [];
            if (page.status) metaArr.push('Status: ' + page.status);
            if (page.traffic) metaArr.push('Traffic: ' + page.traffic);
            if (page.depth) metaArr.push('Depth: ' + page.depth);
            if (metaArr.length > 0) {
                html += '<div style="font-size:0.75em; color:var(--text-muted); margin-top:2px;">' + self._sanitize(metaArr.join(' | ')) + '</div>';
            }
            html += '</td>';

            // Internal Links Column
            html += '<td style="vertical-align:top;">' + self._renderLinkList(page.internal, 'int-' + i, 'internal') + '</td>';
            // External Links Column
            html += '<td style="vertical-align:top;">' + self._renderLinkList(page.external, 'ext-' + i, 'external') + '</td>';
            
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    _statCard: function(label, value, modifierClass) {
        var mod = modifierClass ? ' stat-' + modifierClass : '';
        return '<div class="stat-card' + mod + '" style="padding: 16px;">'
             + '<div class="stat-info" style="margin-left:0;">'
             + '<span class="stat-count" style="font-size: 1.5rem;">' + value + '</span>'
             + '<span class="stat-label">' + this._sanitize(label) + '</span>'
             + '</div></div>';
    },

    _renderLinkList: function(links, idPrefix, type) {
        if (!links || links.length === 0) {
            return '<span style="color:var(--text-muted); font-size:0.85em;">0 ' + type + '</span>';
        }
        
        var displayLimit = 3;
        var html = '<div style="margin-bottom:4px; font-weight:600; font-size:0.85em;">' + links.length + ' ' + type + ' broken:</div>';
        
        var renderItem = (link) => {
            return '<div style="margin-bottom:6px; padding:6px; background:var(--bg-lighter); border-radius:4px; font-size:0.85em;">'
                 + '<div style="display:flex; justify-content:space-between; gap:8px;">'
                 + '<span style="word-break:break-all;">' + this._sanitize(link.url) + '</span>'
                 + '<div style="display:flex; gap:6px; align-items:flex-start;">'
                 + '<span class="severity-badge severity-critical" style="padding:2px 4px; font-size:0.75em;">' + this._sanitize(link.status) + '</span>'
                 + this._copyBtn(link.url, 'Copy Broken URL')
                 + '</div></div></div>';
        };

        html += '<div class="link-list">';
        for (var i = 0; i < Math.min(links.length, displayLimit); i++) {
            html += renderItem(links[i]);
        }
        html += '</div>';

        if (links.length > displayLimit) {
            var allUrls = links.map(l => l.url).join('\\n');
            html += '<div id="' + idPrefix + '" style="display:none; margin-top:6px;">';
            for (var i = displayLimit; i < links.length; i++) {
                html += renderItem(links[i]);
            }
            html += '</div>';
            
            html += '<div style="display:flex; align-items:center; justify-content:space-between; margin-top:6px;">'
                 + '<button class="url-list-toggle btn-secondary" style="padding:4px 8px; font-size:0.8em;" data-target="' + idPrefix + '" data-count="' + links.length + '">'
                 + '<span class="toggle-text">Show all ' + links.length + ' links</span>'
                 + '</button>'
                 + this._copyBtn(allUrls, 'Copy All ' + type + ' Broken URLs')
                 + '</div>';
        } else {
            // just copy all if there are some
            if (links.length > 1) {
                var allUrls = links.map(l => l.url).join('\\n');
                html += '<div style="margin-top:6px; text-align:right;">' + this._copyBtn(allUrls, 'Copy All ' + type + ' Broken URLs') + '</div>';
            }
        }
        
        return html;
    },

    _copyBtn: function(text, title) {
        var cleanText = this._escapeHtml(text);
        return '<button class="copy-btn" data-copy="' + cleanText + '" title="' + this._sanitize(title) + '" style="background:none; border:none; cursor:pointer; color:var(--text-muted); display:inline-flex; padding:2px;">'
             + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'
             + '</button>';
    },

    _noIssuesHTML: function () {
        return '<div style="'
            + 'background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);'
            + 'border-radius:8px;padding:18px 22px;display:flex;align-items:center;gap:14px;color:var(--accent-emerald);">'
            + '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
            + '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>'
            + '<polyline points="22,4 12,14.01 9,11.01"/>'
            + '</svg>'
            + '<div><strong>No 4xx Issues Found</strong>'
            + '<br><span style="font-size:0.875em;opacity:0.85;">No broken internal or external 4xx links were found in the uploaded Ahrefs report. Great work!</span></div>'
            + '</div>';
    },

    _sanitize: function(str) {
        if (str === null || str === undefined) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    _escapeHtml: function(unsafe) {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    },

    getFindings: function () {
        if (!this.results || !this.results.pages || this.results.pages.length === 0) return null;
        return {
            fourxx: { 
                title: '4xx Issues', 
                severity: 'warning', 
                data: this.results.pages,
                summary: 'Found ' + this.results.pages.length + ' pages with broken links (' + this.results.totalInternal + ' internal, ' + this.results.totalExternal + ' external)'
            }
        };
    }
};
