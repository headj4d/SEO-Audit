var MissingAltModule = {
    activeSource: null,

    init: function () {
        var btn = document.getElementById('btn-missing-alt-check');
        if (btn) {
            btn.addEventListener('click', this.runCheck.bind(this));
        }

        // Auto-fill from Auto Audit domain if available
        var autoAuditUrl = document.getElementById('auto-audit-url');
        var myUrl = document.getElementById('missing-alt-scan-url');
        if (autoAuditUrl && myUrl && autoAuditUrl.value && !myUrl.value) {
            // Wait a tick for user typing or pasting
            setTimeout(function() {
                if(!myUrl.value) myUrl.value = autoAuditUrl.value;
            }, 500);
        }
    },

    runCheck: function () {
        var urlInput = document.getElementById('missing-alt-scan-url');
        var url = urlInput.value.trim();

        if (!url) {
            App.showToast('Please enter a valid URL', 'error');
            return;
        }

        // Reset UI
        this.resetUI();
        var btn = document.getElementById('btn-missing-alt-check');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:8px;display:inline-block"></span> Analyzing...';

        var progressDiv = document.getElementById('missing-alt-progress');
        progressDiv.style.display = 'block';
        progressDiv.textContent = 'Starting check...';

        if (this.activeSource) {
            this.activeSource.close();
        }

        this.activeSource = new EventSource('/api/check-missing-alt?url=' + encodeURIComponent(url));
        var self = this;

        this.activeSource.addEventListener('message', function (e) {
            var data = JSON.parse(e.data);
            self.handleEvent(data);
        });

        this.activeSource.addEventListener('error', function (e) {
            if (e.target.readyState !== EventSource.CLOSED) {
                progressDiv.textContent = 'Connection error. Check server console.';
                self.finishCheck();
            }
        });
    },

    resetUI: function() {
        document.getElementById('missing-alt-stat-pages').textContent = '0';
        document.getElementById('missing-alt-stat-total').textContent = '0';
        document.getElementById('missing-alt-stat-issues').textContent = '0';
        document.getElementById('missing-alt-stat-affected').textContent = '0';
        
        document.getElementById('missing-alt-empty').style.display = 'none';
        document.getElementById('missing-alt-results').style.display = 'none';
        document.getElementById('missing-alt-results').innerHTML = '';
    },

    finishCheck: function () {
        var btn = document.getElementById('btn-missing-alt-check');
        btn.disabled = false;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Analyze Images';
        if (this.activeSource) {
            this.activeSource.close();
            this.activeSource = null;
        }
    },

    handleEvent: function (data) {
        var progressDiv = document.getElementById('missing-alt-progress');

        if (data.type === 'started') {
            progressDiv.textContent = data.message;
            AuditState.setCheck('missing-alt', SEO_CONSTANTS.SEVERITY.PENDING, 'Running check...');
        } else if (data.type === 'progress') {
            progressDiv.textContent = data.message;
        } else if (data.type === 'complete') {
            progressDiv.style.display = 'none';
            this.renderResults(data.result);
            this.finishCheck();
        } else if (data.type === 'error') {
            progressDiv.textContent = 'Error: ' + data.message;
            progressDiv.style.color = '#ef4444';
            AuditState.setCheck('missing-alt', SEO_CONSTANTS.SEVERITY.CRITICAL, 'Check failed');
            this.finishCheck();
            App.showToast('Check failed', 'error');
        }
    },

    renderResults: function (result) {
        // Update stats
        document.getElementById('missing-alt-stat-pages').textContent = result.pagesChecked || 0;
        document.getElementById('missing-alt-stat-total').textContent = result.totalImages || 0;
        document.getElementById('missing-alt-stat-issues').textContent = result.missingAltCount || 0;
        document.getElementById('missing-alt-stat-affected').textContent = result.affectedPagesCount || 0;

        var container = document.getElementById('missing-alt-results');
        container.style.display = 'block';

        if (!result.groupedIssues || result.groupedIssues.length === 0) {
            container.innerHTML = '<div class="success-banner" style="background:rgba(5, 150, 105, 0.1); color:#10b981; padding:15px; border-radius:8px;">' +
                '<strong>Pass:</strong> No images with missing alt text were found on the crawled pages.</div>';
            AuditState.setCheck('missing-alt', SEO_CONSTANTS.SEVERITY.PASS, 'No missing alt text found');
            return;
        }

        AuditState.setCheck('missing-alt', SEO_CONSTANTS.SEVERITY.WARNING, result.affectedPagesCount + ' pages with missing alt images');

        var html = '<div class="issue-table-wrap" style="overflow-x:auto;">';
        html += '<table class="issue-table">';
        html += '<thead><tr>' +
            '<th>Page URL</th>' +
            '<th>Linked Images Without Alt Attribute</th>' +
            '<th style="text-align:center;">No. of Linked Images</th>' +
            '<th style="text-align:center;">Status</th>' +
            '<th style="width:100px; text-align:center;">Actions</th>' +
            '</tr></thead><tbody>';

        result.groupedIssues.forEach(function (group, groupIdx) {
            var statusBadge = '<span class="status-badge status-critical" style="margin:0 auto; display:table;">ISSUE</span>';
            var safePageUrl = group.pageUrl.replace(/"/g, '&quot;');

            var imageListHtml = '<ul style="margin:0; padding-left:20px; font-size: 0.9em; color:#94a3b8;">';
            var allImageUrls = [];
            group.affectedImages.forEach(function(img, imgIdx) {
                var safeImgUrl = img.imageUrl.replace(/"/g, '&quot;');
                allImageUrls.push(safeImgUrl);
                var displayStyle = (imgIdx >= 3) ? 'display:none;' : '';
                var itemClass = (imgIdx >= 3) ? 'hidden-img-' + groupIdx : '';
                imageListHtml += '<li class="' + itemClass + '" style="' + displayStyle + ' word-break: break-all; margin-bottom: 4px;">';
                imageListHtml += '<a href="' + safeImgUrl + '" target="_blank" style="color:#60a5fa; text-decoration:none;">' + safeImgUrl + '</a>';
                imageListHtml += ' <span style="opacity:0.7">(' + img.details + ')</span>';
                imageListHtml += '</li>';
            });
            imageListHtml += '</ul>';

            if (group.imageCount > 3) {
                imageListHtml += '<div style="margin-top:8px;">' + 
                    '<button class="btn-secondary btn-sm toggle-imgs-btn" data-group="' + groupIdx + '" style="font-size:0.8em; padding: 4px 8px;">' +
                    'Show all ' + group.imageCount + ' images</button></div>';
            }

            var allUrlsData = allImageUrls.join(',');

            html += '<tr>' +
                '<td style="vertical-align:top;"><a href="' + safePageUrl + '" target="_blank" class="table-link" style="word-break: break-all; font-weight:600;">' + safePageUrl + '</a></td>' +
                '<td style="vertical-align:top;">' + imageListHtml + '</td>' +
                '<td style="vertical-align:top; text-align:center; font-weight:bold; font-size:1.1em;">' + group.imageCount + '</td>' +
                '<td style="vertical-align:top;">' + statusBadge + '</td>' +
                '<td style="text-align:center; vertical-align:top;">' +
                '<div style="display:flex; flex-direction:column; gap:6px;">' +
                '<button class="btn-secondary copy-page-btn" title="Copy Page URL" data-url="' + safePageUrl + '" style="padding:4px 8px; font-size:0.8em;">Copy Page</button>' +
                '<button class="btn-secondary copy-imgs-btn" title="Copy All Image URLs" data-urls="' + allUrlsData + '" style="padding:4px 8px; font-size:0.8em;">Copy Images</button>' +
                '</div></td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        // Bind copy buttons
        container.querySelectorAll('.copy-page-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var url = this.getAttribute('data-url');
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(url).then(function() { App.showToast('Page URL copied', 'success'); });
                }
            });
        });
        container.querySelectorAll('.copy-imgs-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var urls = this.getAttribute('data-urls').split(',').join('\n');
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(urls).then(function() { App.showToast('Image URLs copied', 'success'); });
                }
            });
        });

        // Bind toggle buttons
        container.querySelectorAll('.toggle-imgs-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var gid = this.getAttribute('data-group');
                var hiddenItems = container.querySelectorAll('.hidden-img-' + gid);
                var isExpanded = this.getAttribute('data-expanded') === 'true';

                if (isExpanded) {
                    hiddenItems.forEach(function(item) { item.style.display = 'none'; });
                    this.textContent = 'Show all ' + (hiddenItems.length + 3) + ' images';
                    this.setAttribute('data-expanded', 'false');
                } else {
                    hiddenItems.forEach(function(item) { item.style.display = 'list-item'; });
                    this.textContent = 'Hide extra images';
                    this.setAttribute('data-expanded', 'true');
                }
            });
        });
    }
};
