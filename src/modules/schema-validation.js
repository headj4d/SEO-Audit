/* ============================================
   SCHEMA VALIDATION MODULE
   Uses Google Rich Results Test via backend API
   ============================================ */
var SchemaValidationModule = {
    homepageResult: null,
    productResults: [],
    discoveredUrls: [], // Store all discovered URLs from any crawl
    
    init: function () {
        var self = this;
        
        var btnHome = document.getElementById('btn-schema-home-run');
        if (btnHome) {
            btnHome.addEventListener('click', function () {
                self.runHomepageTest();
            });
        }

        var btnProducts = document.getElementById('btn-schema-products-run');
        if (btnProducts) {
            btnProducts.addEventListener('click', function () {
                self.runAllProductTests();
            });
        }
        
        var btnRetry = document.getElementById('btn-schema-products-retry');
        if (btnRetry) {
            btnRetry.addEventListener('click', function () {
                self.retryFailedProductTests();
            });
        }

        // Listen for any crawler/CSV parser events to collect URLs
        document.addEventListener('auditFileParserReady', function (e) {
             // In case AuditFileParser or AutoAudit pushes full URLs here
        });

        // Whenever the domain input changes, update the homepage input
        var domainInput = document.getElementById('audit-domain');
        if (domainInput) {
            domainInput.addEventListener('change', function() {
                var url = domainInput.value.trim();
                if(url && !url.startsWith('http')) url = 'https://' + url;
                var homeInput = document.getElementById('schema-home-url');
                if(homeInput && !homeInput.value) {
                    homeInput.value = url;
                }
            });
        }
    },

    // A helper to gather URLs from anywhere in the app
    // Currently, we might not have a global store, so we'll look for input values
    // or simulate discovery.
    gatherProductUrls: function() {
        var urls = [];
        
        // 1. Check Shopify module text area
        var shopifyInput = document.getElementById('shopify-urls-input');
        if (shopifyInput && shopifyInput.value) {
            var shopifyUrls = shopifyInput.value.split('\n').map(u => u.trim()).filter(u => u);
            urls = urls.concat(shopifyUrls);
        }

        // We filter for product heuristics
        var productHeuristics = /\/(product|products|shop|item|p)\//i;
        var finalUrls = urls.filter(u => productHeuristics.test(u));

        // 2. Check the manual product URL textarea (bypass heuristics)
        var manualInput = document.getElementById('schema-products-urls');
        if (manualInput && manualInput.value) {
            var manualUrls = manualInput.value.split('\n').map(u => u.trim()).filter(u => u);
            manualUrls = manualUrls.map(u => u.startsWith('http') ? u : 'https://' + u);
            finalUrls = finalUrls.concat(manualUrls);
        }
        
        // Return unique
        return [...new Set(finalUrls)];
    },

    runHomepageTest: function() {
        var self = this;
        var urlInput = document.getElementById('schema-home-url');
        var url = urlInput ? urlInput.value.trim() : '';

        if (!url) {
            App.showToast('Please enter a homepage URL to test', 'error');
            return;
        }
        if (!url.startsWith('http')) {
            url = 'https://' + url;
            urlInput.value = url;
        }

        var btn = document.getElementById('btn-schema-home-run');
        var resultsCont = document.getElementById('schema-home-results');

        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:8px;"></div> Running...';
        }
        
        resultsCont.style.display = 'block';
        resultsCont.innerHTML = '<div class="loading-indicator" style="display:flex; padding: 20px; align-items:center; gap:10px;"><div class="spinner"></div><span>Validating Schema via Google Rich Results Test (may take 30-60s)...</span></div>';

        document.getElementById('schema-stat-homepage').textContent = 'Testing...';

        fetch('/api/check-schema', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        })
        .then(res => res.json())
        .then(data => {
            self.homepageResult = data;
            self.renderHomepageResult(data);
            self.updateDashboard();
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = 'Run Homepage Test';
            }
        })
        .catch(err => {
            App.showToast('Homepage Schema Test failed: ' + err.message, 'error');
            resultsCont.innerHTML = '<div class="error-banner">Test failed: ' + err.message + '</div>';
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = 'Run Homepage Test';
            }
            document.getElementById('schema-stat-homepage').textContent = 'Error';
            self.updateDashboard();
        });
    },

    renderHomepageResult: function(data) {
        var resultsCont = document.getElementById('schema-home-results');
        if(!resultsCont) return;

        var statEl = document.getElementById('schema-stat-homepage');

        if(data.testStatus === 'Failed') {
            resultsCont.innerHTML = '<div class="error-banner" style="background:var(--accent-red-transparent); padding:15px; border-radius:6px; color:var(--accent-red);">' +
                '<strong>Status:</strong> Test failed or timed out.<br><br>' + data.message + '</div>';
            if(statEl) statEl.textContent = 'Failed';
            return;
        }

        var orgStatus = data.organizationPresent ? 'Present' : (data.detectedTypes.length > 0 ? 'Missing' : 'Could not confirm');
        var webStatus = data.websitePresent ? 'Present' : (data.detectedTypes.length > 0 ? 'Missing' : 'Could not confirm');

        var orgColor = data.organizationPresent ? 'var(--accent-emerald)' : 'var(--accent-red)';
        var webColor = data.websitePresent ? 'var(--accent-emerald)' : 'var(--accent-red)';
        
        if(orgStatus === 'Could not confirm') orgColor = 'var(--text-muted)';
        if(webStatus === 'Could not confirm') webColor = 'var(--text-muted)';

        var finalMessage = 'Homepage has necessary schemas';
        if (!data.organizationPresent && !data.websitePresent) finalMessage = 'Homepage is missing Organization and WebSite schema';
        else if (!data.organizationPresent) finalMessage = 'Homepage is missing Organization schema';
        else if (!data.websitePresent) finalMessage = 'Homepage is missing WebSite schema';
        
        if(data.detectedTypes.length === 0 && data.testStatus !== 'Failed') {
            finalMessage = 'Could not confirm all homepage schema types from Rich Results Test output';
        }

        if(statEl) statEl.textContent = data.organizationPresent && data.websitePresent ? 'Pass' : 'Warning/Fail';

        var html = '<div style="margin-top: 15px;">';
        html += '<p><strong>URL:</strong> <a href="' + data.url + '" target="_blank" style="color:var(--accent-blue)">' + data.url + '</a></p>';
        html += '<div style="display:flex; gap: 20px; margin: 15px 0;">';
        html += '<div style="flex:1; padding: 15px; background:var(--bg-card-hover); border-radius:6px; border-left: 4px solid ' + orgColor + '">';
        html += '<h4 style="margin:0 0 5px 0; font-size:14px; color:var(--text-muted);">Organization Schema</h4>';
        html += '<strong style="font-size:16px; color:' + orgColor + '">' + orgStatus + '</strong>';
        html += '</div>';
        
        html += '<div style="flex:1; padding: 15px; background:var(--bg-card-hover); border-radius:6px; border-left: 4px solid ' + webColor + '">';
        html += '<h4 style="margin:0 0 5px 0; font-size:14px; color:var(--text-muted);">WebSite Schema</h4>';
        html += '<strong style="font-size:16px; color:' + webColor + '">' + webStatus + '</strong>';
        html += '</div>';
        html += '</div>';

        html += '<div style="padding: 12px; background:var(--bg-dark); border-radius:4px; font-weight:500;">' +
                '<strong>Final Result:</strong> ' + finalMessage + 
                '</div>';
        
        html += '</div>';

        resultsCont.innerHTML = html;
        this.updateDashboard();
    },

    runAllProductTests: function() {
        var urls = this.gatherProductUrls();
        if(urls.length === 0) {
            // Just simulate one so they have something if domain is entered
            var domainInput = document.getElementById('audit-domain');
            var domain = domainInput ? domainInput.value.trim() : '';
            if(domain) {
                if(!domain.startsWith('http')) domain = 'https://' + domain;
                if(!domain.endsWith('/')) domain += '/';
                urls.push(domain + 'products/example-product');
            } else {
                App.showToast('No product URLs found in the app. Paste Shopify URLs or run an audit first.', 'warning');
                return;
            }
        }

        var btn = document.getElementById('btn-schema-products-run');
        if(btn) btn.disabled = true;

        document.getElementById('schema-products-empty').style.display = 'none';
        var resultsCont = document.getElementById('schema-products-results');
        resultsCont.style.display = 'block';

        // Initialize queue
        var self = this;
        
        urls.forEach(u => {
            var existing = self.productResults.find(r => r.url === u);
            if(!existing) {
                self.productResults.push({
                    url: u,
                    pageType: 'Product Page',
                    testStatus: 'Pending',
                    productPresent: false,
                    message: 'Waiting...',
                    testedAt: null
                });
            } else if (existing.testStatus === 'Failed') {
                existing.testStatus = 'Pending';
                existing.message = 'Waiting...';
            }
        });

        this.renderProductTable();
        this.processProductQueue();
    },

    retryFailedProductTests: function() {
        var hasFailed = false;
        this.productResults.forEach(r => {
            if(r.testStatus === 'Failed') {
                r.testStatus = 'Pending';
                r.message = 'Waiting...';
                hasFailed = true;
            }
        });
        
        if(hasFailed) {
            this.renderProductTable();
            var btn = document.getElementById('btn-schema-products-run');
            if(btn) btn.disabled = true;
            document.getElementById('btn-schema-products-retry').style.display = 'none';
            this.processProductQueue();
        } else {
            App.showToast('No failed tests to retry.', 'info');
        }
    },

    processProductQueue: function() {
        var self = this;
        var pendingIndex = this.productResults.findIndex(r => r.testStatus === 'Pending');
        
        if (pendingIndex === -1) {
            var btn = document.getElementById('btn-schema-products-run');
            if(btn) btn.disabled = false;
            
            var hasFailed = this.productResults.some(r => r.testStatus === 'Failed');
            if(hasFailed) {
                document.getElementById('btn-schema-products-retry').style.display = 'inline-block';
            } else {
                document.getElementById('btn-schema-products-retry').style.display = 'none';
            }
            
            this.updateDashboard();
            return;
        }

        var item = this.productResults[pendingIndex];
        item.testStatus = 'Testing...';
        item.message = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;"></div> Running...';
        this.renderProductTable();

        fetch('/api/check-schema', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url })
        })
        .then(res => res.json())
        .then(data => {
            item.testStatus = data.testStatus;
            item.productPresent = data.productPresent;
            item.detectedTypes = data.detectedTypes;
            
            if(data.testStatus === 'Failed') {
                item.message = 'Rich Results Test could not be completed for this URL';
            } else if (item.productPresent) {
                item.message = 'Product schema present';
                item.testStatus = 'Completed';
            } else if (data.detectedTypes.length > 0) {
                item.message = 'Product schema missing';
                item.testStatus = 'Completed';
            } else {
                item.message = 'Could not confirm schema types';
                item.testStatus = 'Warning';
            }
            item.testedAt = new Date().toISOString();
            self.renderProductTable();
            self.processProductQueue(); // next
        })
        .catch(err => {
            item.testStatus = 'Failed';
            item.message = 'Fatal error: ' + err.message;
            self.renderProductTable();
            self.processProductQueue(); // next
        });
    },

    renderProductTable: function() {
        var resultsCont = document.getElementById('schema-products-results');
        if(!resultsCont) return;

        var html = '<table class="result-table"><thead><tr>';
        html += '<th>URL</th><th>Page Type</th><th>Product Schema</th><th>Message</th><th>Test Status</th>';
        html += '</tr></thead><tbody>';

        var passCount = 0;
        var failCount = 0;

        this.productResults.forEach(r => {
            var schemaBadge = '';
            if (r.testStatus === 'Pending' || r.testStatus === 'Testing...') {
                schemaBadge = '<span class="severity-badge severity-info">Testing...</span>';
            } else if (r.testStatus === 'Failed') {
                schemaBadge = '<span class="severity-badge severity-critical">Unknown</span>';
            } else if (r.productPresent) {
                schemaBadge = '<span class="severity-badge severity-pass">Present</span>';
                passCount++;
            } else if (r.testStatus === 'Warning') {
                 schemaBadge = '<span class="severity-badge severity-warning">Unknown</span>';
            } else {
                schemaBadge = '<span class="severity-badge severity-critical">Missing</span>';
                failCount++;
            }

            html += '<tr>';
            html += '<td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="'+r.url+'">';
            html += '<a href="'+r.url+'" target="_blank" style="color:var(--text-primary); text-decoration:none;">'+r.url+'</a></td>';
            html += '<td>' + r.pageType + '</td>';
            html += '<td>' + schemaBadge + '</td>';
            html += '<td style="font-size: 13px;">' + r.message + '</td>';
            html += '<td>' + r.testStatus + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        resultsCont.innerHTML = html;

        // Update stats
        document.getElementById('schema-stat-products-total').textContent = this.productResults.length;
        document.getElementById('schema-stat-products-pass').textContent = passCount;
        document.getElementById('schema-stat-products-fail').textContent = failCount;
    },

    updateDashboard: function() {
        // Evaluate overall pass/warning/fail
        var isPass = true;
        var isWarning = false;

        // Check homepage
        if (this.homepageResult) {
            if (!this.homepageResult.organizationPresent || !this.homepageResult.websitePresent) {
                isPass = false;
                isWarning = true;
            }
            if (this.homepageResult.testStatus === 'Failed') {
                isPass = false;
                isWarning = true;
            }
        } else {
            // Not tested yet
            isPass = false;
        }

        // Check products
        var productTested = false;
        if(this.productResults && this.productResults.length > 0) {
            productTested = true;
            this.productResults.forEach(r => {
                if (r.testStatus === 'Completed' && !r.productPresent) {
                    isPass = false;
                    isWarning = true;
                }
                if (r.testStatus === 'Failed' || r.testStatus === 'Warning') {
                    isPass = false;
                    isWarning = true;
                }
            });
        }
        
        var message = '';
        var severity = SEO_CONSTANTS.SEVERITY.PENDING;

        if (!this.homepageResult && !productTested) {
            severity = SEO_CONSTANTS.SEVERITY.PENDING;
            message = 'Not tested yet';
        } else if (isPass) {
            severity = SEO_CONSTANTS.SEVERITY.PASS;
            if(productTested && this.homepageResult) message = 'All essential schemas present';
            else if (this.homepageResult) message = 'Homepage schemas present';
            else message = 'Product schemas present';
        } else if (isWarning) {
            severity = SEO_CONSTANTS.SEVERITY.WARNING;  // Do not use critical for now as per instructions
            message = 'Some schemas are missing or tests failed';
        }

        AuditState.setCheck('schema-validation', severity, message);
    }
};
