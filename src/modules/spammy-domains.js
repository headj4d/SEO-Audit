/* ============================================
   SPAMMY DOMAINS MODULE
   Reads Ahrefs Backlink exports and identifies
   spammy or low-quality referring domains.
   ============================================ */

var SpammyDomainsModule = {
    results: null,

    // Ahrefs column mapping priorities
    AHREFS_COLS: {
        referringPageUrl: ["Referring page URL", "Referring page", "Ref. page URL", "URL"],
        referringPageTitle: ["Referring page title", "Title"],
        targetUrl: ["Target URL", "Target"],
        domainRating: ["Domain rating", "DR"],
        keywords: ["Keywords", "Kw."],
        domainTraffic: ["Domain traffic"],
        linkedDomains: ["Linked domains"],
        referringDomains: ["Referring domains"],
        pageTraffic: ["Page traffic"],
        anchor: ["Anchor", "Anchor and target URL"],
        pageHttpCode: ["Referring page HTTP code", "HTTP status code", "Status code"],
        firstSeen: ["First seen"],
        lastSeen: ["Last seen"],
        isSpam: ["Is spam", "Is Spam"],
        nofollow: ["Nofollow"],
        ugc: ["UGC"],
        sponsored: ["Sponsored"],
        pageType: ["Page type", "Type", "Backlink type"],
        pageCategory: ["Page category"],
        platform: ["Platform"],
        language: ["Language"]
    },

    init: function () {
        var self = this;
        var zone = document.getElementById('spammy-domains-upload-zone');
        var input = document.getElementById('spammy-domains-file-input');
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
            if (e.target.closest('.spammy-url-list-toggle')) {
                var btn = e.target.closest('.spammy-url-list-toggle');
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
                        textSpan.textContent = 'Show all ' + btn.getAttribute('data-count') + ' backlinks';
                        btn.classList.remove('expanded');
                    }
                }
            }
            
            // Handle copy buttons
            if (e.target.closest('.spammy-copy-btn')) {
                var btn = e.target.closest('.spammy-copy-btn');
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
        var zone = document.getElementById('spammy-domains-upload-zone');
        if (!zone) return; 
        
        // Reset UI
        self.showStatus('Analyzing file...', 'info');

        // Robust UTF-16 / UTF-8 detection via ArrayBuffer
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var buffer = e.target.result;
                var view = new Uint8Array(buffer);
                
                // Detect BOM for UTF-16 LE
                var isUtf16LE = view.length >= 2 && view[0] === 0xFF && view[1] === 0xFE;
                // Detect BOM for UTF-16 BE
                var isUtf16BE = view.length >= 2 && view[0] === 0xFE && view[1] === 0xFF;
                // Detect BOM for UTF-8
                var isUtf8BOM = view.length >= 3 && view[0] === 0xEF && view[1] === 0xBB && view[2] === 0xBF;

                var decoder;
                if (isUtf16LE) decoder = new TextDecoder('utf-16le');
                else if (isUtf16BE) decoder = new TextDecoder('utf-16be');
                else decoder = new TextDecoder('utf-8');

                var text = decoder.decode(buffer);

                // Strip UTF-8 BOM if accidentally decoded as string text
                if (text.charCodeAt(0) === 0xFEFF) {
                    text = text.slice(1);
                }

                // Detect delimiter: Ahrefs heavily uses tabs for exported data
                var delimiter = text.indexOf('\t') !== -1 ? '\t' : ',';
                
                Papa.parse(text, {
                    delimiter: delimiter,
                    header: true,
                    skipEmptyLines: 'greedy', // Skip completely empty lines
                    complete: function(parsed) {
                        if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
                            console.error('[Spammy Domains] Parse errors:', parsed.errors);
                            self.showError('Could not parse the Ahrefs report file. Ensure it is a valid format.');
                            return;
                        }
                        self.processParsedData(parsed.data, parsed.meta.fields, file.name);
                    },
                    error: function(err) {
                        self.showError('Error parsing file: ' + err.message);
                    }
                });
            } catch (err) {
                self.showError('File read error: ' + err.message);
            }
        };
        
        reader.onerror = function() {
            self.showError('Could not read the uploaded file.');
        };
        
        reader.readAsArrayBuffer(file); 
    },
    
    findColumn: function(fields, candidates) {
        if (!fields || !candidates) return null;
        // Normalize CSV headers (e.g., remove surrounding quotes, trim whitespace, ignore case)
        var fLower = fields.map(f => {
            if (!f) return '';
            return f.replace(/^"|"$/g, '').trim().toLowerCase();
        });
        
        for (var i = 0; i < candidates.length; i++) {
            var cLower = candidates[i].trim().toLowerCase();
            var index = fLower.indexOf(cLower);
            if (index !== -1) return fields[index]; // Return original case-sensitive field name map
        }
        return null;
    },

    extractDomain: function(url) {
        try {
            var input = String(url).trim().replace(/^"|"$/g, '');
            if (!/^https?:\/\//i.test(input)) {
                input = 'http://' + input; 
            }
            var hn = new URL(input).hostname;
            return hn.replace(/^www\./i, '').toLowerCase();
        } catch(e) {
            return null;
        }
    },

    parseNum: function(str) {
        if (str === null || str === undefined || str === '') return null;
        var stripped = String(str).replace(/^"|"$/g, '').replace(/,/g, '').trim();
        if (stripped === '') return null;
        var val = parseFloat(stripped);
        return isNaN(val) ? null : val;
    },

    parseBool: function(str) {
        if (!str) return false;
        var clean = String(str).replace(/^"|"$/g, '').trim().toUpperCase();
        return clean === 'TRUE' || clean === 'YES' || clean === '1';
    },

    processParsedData: function(data, fields, fileName) {
        var self = this;
        var zone = document.getElementById('spammy-domains-upload-zone');
        if(zone) zone.classList.add('uploaded');
        self.clearStatus();
        
        // Find main columns
        var colRefPage = self.findColumn(fields, self.AHREFS_COLS.referringPageUrl);
        
        if (!colRefPage) {
            self.showError('Could not find "Referring page URL" column in the Ahrefs export.');
            return;
        }

        // Gather optimal columns
        var cRefTitle = self.findColumn(fields, self.AHREFS_COLS.referringPageTitle);
        var cDR = self.findColumn(fields, self.AHREFS_COLS.domainRating);
        var cTraffic = self.findColumn(fields, self.AHREFS_COLS.domainTraffic);
        var cKw = self.findColumn(fields, self.AHREFS_COLS.keywords);
        var cLinkedDomains = self.findColumn(fields, self.AHREFS_COLS.linkedDomains);
        var cTargetUrl = self.findColumn(fields, self.AHREFS_COLS.targetUrl);
        var cAnchor = self.findColumn(fields, self.AHREFS_COLS.anchor);
        var cHttpCode = self.findColumn(fields, self.AHREFS_COLS.pageHttpCode);
        var cIsSpam = self.findColumn(fields, self.AHREFS_COLS.isSpam);
        var cNofollow = self.findColumn(fields, self.AHREFS_COLS.nofollow);
        var cUgc = self.findColumn(fields, self.AHREFS_COLS.ugc);
        var cSponsored = self.findColumn(fields, self.AHREFS_COLS.sponsored);
        var cPageType = self.findColumn(fields, self.AHREFS_COLS.pageType);
        var cFirstSeen = self.findColumn(fields, self.AHREFS_COLS.firstSeen);
        
        var domainsMap = {};
        
        data.forEach(function(row) {
            var refUrl = String(row[colRefPage] || '').replace(/^"|"$/g, '').trim();
            if (!refUrl) return; 

            var domainName = self.extractDomain(refUrl);
            if (!domainName) return;

            if (!domainsMap[domainName]) {
                domainsMap[domainName] = {
                    domain: domainName,
                    backlinks: [],
                    dr: cDR ? self.parseNum(row[cDR]) : null,
                    traffic: cTraffic ? self.parseNum(row[cTraffic]) : null,
                    keywords: cKw ? self.parseNum(row[cKw]) : null,
                    linkedDomains: cLinkedDomains ? self.parseNum(row[cLinkedDomains]) : null,
                    score: 0,
                    riskLevel: 'Looks OK',
                    reasons: [],
                    explanation: ''
                };
            }

            var tags = [];
            if (cNofollow && self.parseBool(row[cNofollow])) tags.push('Nofollow');
            if (cUgc && self.parseBool(row[cUgc])) tags.push('UGC');
            if (cSponsored && self.parseBool(row[cSponsored])) tags.push('Sponsored');
            if (tags.length === 0) tags.push('Dofollow');

            var bl = {
                sourceUrl: refUrl,
                sourceTitle: cRefTitle ? row[cRefTitle] : '',
                targetUrl: cTargetUrl ? String(row[cTargetUrl]).replace(/^"|"$/g, '').trim() : '',
                anchor: cAnchor ? row[cAnchor] : '',
                httpCode: cHttpCode ? row[cHttpCode] : '',
                isSpam: cIsSpam ? self.parseBool(row[cIsSpam]) : false,
                type: cPageType ? row[cPageType] : '',
                tags: tags,
                firstSeen: cFirstSeen ? row[cFirstSeen] : ''
            };
            
            // Deduplicate exact row URLs in case Ahrefs includes duplicate paths
            var exists = domainsMap[domainName].backlinks.find(b => b.sourceUrl === bl.sourceUrl && b.targetUrl === bl.targetUrl);
            if (!exists) {
                domainsMap[domainName].backlinks.push(bl);
            }
        });

        var analyzedDomains = Object.keys(domainsMap).length;
        var flaggedDomainsCount = 0;
        var highRiskCount = 0;
        var totalSuspiciousBacklinks = 0;
        var resultsList = [];

        Object.values(domainsMap).forEach(function(d) {
            var score = 0;
            var reasons = [];
            
            var has1000Outlinks = (d.linkedDomains !== null && d.linkedDomains >= 1000);
            var isDrZero = (d.dr !== null && d.dr === 0);
            var isKwZero = (d.keywords !== null && d.keywords === 0);
            var isTrafficZero = (d.traffic !== null && d.traffic === 0);
            var isSpamTagged = d.backlinks.some(b => b.isSpam);
            var patternLooksMassGen = d.backlinks.some(b => /\/(directory|listings|index|search|profile|tags|feed)\//i.test(b.sourceUrl));

            // Accumulate explicit score
            if (has1000Outlinks) { score += 3; reasons.push("1,000+ outlinks"); }
            if (isDrZero) { score += 2; reasons.push("DR 0"); }
            if (isKwZero) { score += 2; reasons.push("0 keywords"); }
            if (isTrafficZero) { score += 1; reasons.push("0 traffic"); }
            if (isSpamTagged) { score += 1; reasons.push("Is spam flag"); }
            if (patternLooksMassGen) { score += 1; reasons.push("Mass-generated pattern"); }

            d.score = score;
            
            // Assign Risk Levels
            if (score >= 4 || has1000Outlinks) {
                d.riskLevel = 'High Risk';
            } else if (score >= 2 || (isDrZero && isKwZero) || (isDrZero && isTrafficZero)) {
                d.riskLevel = 'Low Quality';
            } else {
                d.riskLevel = 'Looks OK';
            }

            if (d.riskLevel !== 'Looks OK') {
                if (has1000Outlinks && isDrZero && isKwZero && isTrafficZero) {
                    d.explanation = "Flagged because it shows several weak signals at once: very high linked domains, Domain Rating 0, no keywords, and no measurable traffic.";
                } else if (has1000Outlinks) {
                    d.explanation = "Flagged because this domain links out to more than 1,000 domains, which is often a sign of low-quality or spam-like outbound linking.";
                } else if (isDrZero && isKwZero) {
                    d.explanation = "Flagged because the domain has Domain Rating 0 and 0 keywords, which suggests very weak authority and little SEO value.";
                } else {
                    d.explanation = "Flagged because it shows weak signals: " + reasons.join(", ");
                }
                
                flaggedDomainsCount++;
                totalSuspiciousBacklinks += d.backlinks.length;
                if (d.riskLevel === 'High Risk') highRiskCount++;
                
                // Sort backlinks by spam flag to surface suspicious ones immediately
                d.backlinks.sort((a,b) => (b.isSpam ? 1 : 0) - (a.isSpam ? 1 : 0));
                resultsList.push(d);
            }
        });

        // Sort by risk (High Risk first, then by backlinks count descending)
        resultsList.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.backlinks.length - a.backlinks.length;
        });

        self.results = {
            domains: resultsList,
            analyzedDomains: analyzedDomains,
            flaggedDomains: flaggedDomainsCount,
            highRiskDomains: highRiskCount,
            totalSuspiciousBacklinks: totalSuspiciousBacklinks,
            fileName: fileName
        };

        self.renderResults();

        if (zone) {
            var p = zone.querySelector('p');
            if (p) p.innerHTML = '✓ ' + self._escapeHtml(fileName) + ' <br><span style="font-size:0.8em;opacity:0.8">' + flaggedDomainsCount + ' flagged domains out of ' + analyzedDomains + ' analyzed.</span>';
        }

        if (flaggedDomainsCount > 0) {
            AuditState.setCheck('spammy-domains', SEO_CONSTANTS.SEVERITY.WARNING, flaggedDomainsCount + ' spammy/low-quality domains found');
            App.showToast(flaggedDomainsCount + ' suspicious domains detected', 'warning');
        } else {
            AuditState.setCheck('spammy-domains', SEO_CONSTANTS.SEVERITY.PASS, 'No spammy domains found');
            if (analyzedDomains > 0) {
                App.showToast('No spammy or clearly low-quality domains were found in the uploaded report.', 'success');
            }
        }
    },

    clearStatus: function() {
        var errBox = document.getElementById('spammy-domains-results');
        if (errBox) errBox.innerHTML = '';
    },

    showStatus: function(msg, type) {
        var container = document.getElementById('spammy-domains-results');
        var emptyState = document.getElementById('spammy-domains-empty');
        if (emptyState) emptyState.style.display = 'none';
        if (container) {
            container.style.display = 'block';
            container.innerHTML = '<div style="background:rgba(255,255,255,0.05);border:1px dashed rgba(255,255,255,0.2);'
                + 'border-radius:8px;padding:16px 20px;color:var(--text-muted); text-align:center;">'
                + '<span style="font-size:0.875em;">' + msg + '</span></div>';
        }
    },

    showError: function(msg) {
        var container = document.getElementById('spammy-domains-results');
        var emptyState = document.getElementById('spammy-domains-empty');
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
        var container = document.getElementById('spammy-domains-results');
        var emptyState = document.getElementById('spammy-domains-empty');
        if (!container) return;

        if (emptyState) emptyState.style.display = 'none';
        container.style.display = 'block';

        if (!this.results) {
            if (emptyState) emptyState.style.display = '';
            container.style.display = 'none';
            return;
        }

        var domains = this.results.domains;
        if (domains.length === 0) {
            container.innerHTML = this._noIssuesHTML();
            return;
        }

        var html = '';

        // Summary Cards
        html += '<div class="stats-grid" style="margin-bottom: 24px;">'
            + this._statCard('Domains Analyzed', this.results.analyzedDomains, 'info')
            + this._statCard('Flagged Domains', this.results.flaggedDomains, this.results.highRiskDomains > 0 ? 'critical' : 'warning')
            + this._statCard('Suspicious Backlinks', this.results.totalSuspiciousBacklinks, 'warning')
            + this._statCard('High Risk Domains', this.results.highRiskDomains, 'critical')
            + '</div>';

        // Filters and actions
        var copyAllText = domains.map(d => d.domain).join('\\n');
        html += '<div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">'
             + '  <h3 class="sub-title" style="margin:0;">Flagged Domains</h3>'
             + '  <div style="display:flex; gap: 8px;">'
             + '    <button class="btn-secondary spammy-copy-btn" data-copy="' + this._escapeHtml(copyAllText) + '">Copy All Flagged Domains</button>'
             + '  </div>'
             + '</div>';

        // Results Table
        html += '<div class="results-table-container" style="overflow-x:auto;">'
            + '<table class="result-table" style="width:100%; text-align:left;">'
            + '<thead><tr>'
            + '<th style="width:250px;">Referring Domain</th>'
            + '<th style="width:180px;">Risk Level</th>'
            + '<th style="width:130px;">Metrics</th>'
            + '<th>Backlinks Found (' + this.results.totalSuspiciousBacklinks + ' total)</th>'
            + '</tr></thead><tbody>';

        var self = this;
        domains.forEach(function (d, i) {
            html += '<tr>'
                + '<td style="vertical-align:top;">'
                + '<div style="display:flex; align-items:center; gap:6px; font-weight:600;">'
                + '<span style="word-break:break-all;">' + self._sanitize(d.domain) + '</span>'
                + self._copyBtn(d.domain, 'Copy Domain')
                + '</div>'
                + '<div style="font-size:0.7em; color:var(--text-muted); opacity: 0.6; margin-top:4px;">Score: ' + d.score + '</div>'
                + '</td>';
            
            var riskBadge = d.riskLevel === 'High Risk' ? 'severity-critical' : 'severity-warning';
            html += '<td style="vertical-align:top;">'
                 + '<div style="margin-bottom:6px;"><span class="severity-badge ' + riskBadge + '">' + d.riskLevel + '</span></div>'
                 + '<div style="font-size:0.85em; color:var(--text-muted);">'
                 + self._sanitize(d.explanation)
                 + '</div>'
                 + '</td>';

            // Metrics Column
            var metricsArr = [];
            if(d.dr !== null) metricsArr.push('DR: ' + d.dr);
            if(d.keywords !== null) metricsArr.push('Kw: ' + d.keywords);
            if(d.traffic !== null) metricsArr.push('Traffic: ' + d.traffic);
            if(d.linkedDomains !== null) metricsArr.push('Outlinks: ' + d.linkedDomains);

            html += '<td style="vertical-align:top; font-size:0.85em; color:var(--text-muted); line-height:1.4;">'
                 + (metricsArr.length > 0 ? metricsArr.join('<br>') : '<em>No data</em>')
                 + '</td>';

            // Backlinks Column
            html += '<td style="vertical-align:top;">' + self._renderBacklinkList(d.backlinks, 'spammy-bl-' + i) + '</td>';
            
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

    _renderBacklinkList: function(links, idPrefix) {
        if (!links || links.length === 0) return '';
        var displayLimit = 2; // Show fewer by default to save space
        
        var copyAllUrls = links.map(l => l.sourceUrl).join('\\n');
        var html = '<div style="margin-bottom:4px; display:flex; justify-content:space-between; align-items:flex-end;">'
                 + '  <span style="font-weight:600; font-size:0.85em;">' + links.length + ' backlinks</span>'
                 + '  ' + (links.length > 0 ? this._copyBtn(copyAllUrls, 'Copy URLs') : '')
                 + '</div>';
        
        var renderItem = (link) => {
            var metaArr = [];
            if (link.targetUrl) metaArr.push('<strong>Target:</strong> <span style="word-break:break-all;">' + this._sanitize(link.targetUrl) + '</span>');
            if (link.anchor) metaArr.push('<strong>Anchor:</strong> "' + this._sanitize(link.anchor).replace(/"/g, '') + '"');
            
            var line3Arr = [];
            if (link.tags.length > 0) line3Arr.push(link.tags.join(', '));
            if (link.httpCode) line3Arr.push('Code: ' + link.httpCode);
            if (link.type) line3Arr.push('Type: ' + link.type);
            if (link.firstSeen) line3Arr.push('Seen: ' + link.firstSeen.split(' ')[0]);

            var spamTag = link.isSpam ? '<span class="severity-badge severity-critical" style="font-size:0.6rem; padding:1px 4px; margin-left:6px;">Is Spam</span>' : '';
            var titleEl = link.sourceTitle 
               ? '<div style="font-size:0.8em; color:var(--text-color); font-weight:500; margin-bottom:2px; word-break:break-word;">' + this._sanitize(link.sourceTitle) + '</div>' 
               : '';
            
            return '<div style="margin-bottom:6px; padding:8px; background:var(--bg-lighter); border-radius:4px; font-size:0.85em; line-height:1.4;">'
                 + titleEl
                 + '<div style="display:flex; justify-content:space-between; gap:8px;">'
                 + '<div><strong style="color:var(--text-muted);">Source:</strong> <span style="word-break:break-all;">' + this._sanitize(link.sourceUrl) + '</span>' + spamTag + '</div>'
                 + this._copyBtn(link.sourceUrl, 'Copy Source URL')
                 + '</div>'
                 + '<div style="color:var(--text-muted); margin-top:4px;">' + metaArr.join('<br>') + '</div>'
                 + (line3Arr.length > 0 ? '<div style="color:var(--text-muted); margin-top:4px; font-size:0.9em; border-top:1px solid rgba(255,255,255,0.05); padding-top:4px;">' + this._sanitize(line3Arr.join('  •  ')) + '</div>' : '')
                 + '</div>';
        };

        html += '<div class="link-list">';
        for (var i = 0; i < Math.min(links.length, displayLimit); i++) {
            html += renderItem(links[i]);
        }
        html += '</div>';

        if (links.length > displayLimit) {
            html += '<div id="' + idPrefix + '" style="display:none; margin-top:6px;">';
            for (var i = displayLimit; i < links.length; i++) {
                html += renderItem(links[i]);
            }
            html += '</div>';
            
            html += '<div style="display:flex; align-items:center; justify-content:center; margin-top:6px;">'
                 + '<button class="spammy-url-list-toggle btn-secondary" style="padding:4px 12px; font-size:0.8em; width:100%; border-style:dashed; opacity:0.8;" data-target="' + idPrefix + '" data-count="' + links.length + '">'
                 + '<span class="toggle-text">Show all ' + links.length + ' backlinks</span>'
                 + '</button>'
                 + '</div>';
        }
        
        return html;
    },

    _copyBtn: function(text, title) {
        var cleanText = this._escapeHtml(text);
        return '<button class="spammy-copy-btn" data-copy="' + cleanText + '" title="' + this._sanitize(title) + '" style="background:none; border:none; cursor:pointer; color:var(--text-muted); display:inline-flex; padding:2px;">'
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
            + '<div><strong>No Spammy Domains Found</strong>'
            + '<br><span style="font-size:0.875em;opacity:0.85;">No spammy or clearly low-quality domains were found in the uploaded Ahrefs report.</span></div>'
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
        if (!this.results || !this.results.domains || this.results.domains.length === 0) return null;
        return {
            spammyDomains: { 
                title: 'Spammy Domains', 
                severity: this.results.highRiskDomains > 0 ? 'critical' : 'warning', 
                data: this.results.domains,
                summary: 'Found ' + this.results.flaggedDomains + ' suspicious referring domains.'
            }
        };
    }
};
