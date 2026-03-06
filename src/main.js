/* ============================================
   MAIN APP CONTROLLER
   Navigation, state management, initialization
   ============================================ */

// ===== AUDIT STATE =====
var AuditState = {
    checks: {},

    setCheck: function (id, severity, detail) {
        this.checks[id] = { severity: severity, detail: detail };
        App.updateDashboard();
    },

    getCheck: function (id) {
        return this.checks[id] || { severity: 'pending', detail: 'Not checked yet' };
    }
};

// ===== APP =====
var App = {
    currentView: 'dashboard',

    init: function () {
        this.initNavigation();
        this.initMobileMenu();
        this.initReportModal();
        this.initQuickActions();

        // Init all modules
        if (window.AutoAuditModule) AutoAuditModule.init();
        if (window.AuditFileParser) AuditFileParser.init();
        PageSpeedModule.init();
        H1CheckerModule.init();
        RobotsAIModule.init();
        MetaTitlesModule.init();
        DuplicateTitlesModule.init();
        ExternalDomainsModule.init();
        ShopifyUrlsModule.init();
        BrokenLinksModule.init();
        ScreenshotsModule.init();

        // Set default date
        var today = new Date().toISOString().split('T')[0];
        document.getElementById('report-date').value = today;

        // Initial dashboard render
        this.updateDashboard();
    },

    // ----- NAVIGATION -----
    initNavigation: function () {
        var self = this;
        var navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(function (item) {
            item.addEventListener('click', function () {
                var view = item.getAttribute('data-view');
                if (view) self.switchView(view);
            });
        });
    },

    switchView: function (viewId) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
        var activeNav = document.querySelector('.nav-item[data-view="' + viewId + '"]');
        if (activeNav) activeNav.classList.add('active');

        // Update views
        document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
        var targetView = document.getElementById('view-' + viewId);
        if (targetView) targetView.classList.add('active');

        // Update header
        var titles = {
            'auto-audit': ['Auto Audit', 'Automated site crawler & analyzer'],
            'dashboard': ['Dashboard', 'Overview of your technical SEO audit'],
            'pagespeed': ['PageSpeed Insights', 'Test page performance scores'],
            'h1-checker': ['H1 Tag Analysis', 'Check for missing or multiple H1 tags'],
            'robots-ai': ['AI Bots in robots.txt', 'Check if AI crawlers are blocked or allowed'],
            'meta-titles': ['Meta Titles', 'Analyze title tag length and optimization'],
            'duplicate-titles': ['Duplicated Page Titles', 'Check for repetitive titles across different pages'],
            'external-domains': ['External Domains', 'Review do-follow external links'],
            'shopify-urls': ['URL Structure', 'Check for Shopify URL pattern issues'],
            'broken-links': ['Broken Links', 'Analyze broken backlinks and 4xx pages'],
            'screenshots': ['Evidence Screenshots', 'Upload and categorize issue screenshots']
        };

        var t = titles[viewId] || ['Audit', ''];
        document.getElementById('page-title').textContent = t[0];
        document.getElementById('page-subtitle').textContent = t[1];

        this.currentView = viewId;

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
    },

    // ----- MOBILE MENU -----
    initMobileMenu: function () {
        document.getElementById('mobile-menu-btn').addEventListener('click', function () {
            document.getElementById('sidebar').classList.toggle('open');
        });
    },

    // ----- QUICK ACTIONS -----
    initQuickActions: function () {
        var self = this;
        document.querySelectorAll('.quick-action-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var view = btn.getAttribute('data-view');
                if (view) self.switchView(view);
            });
        });
    },

    // ----- REPORT MODAL -----
    initReportModal: function () {
        var modal = document.getElementById('report-modal');
        document.getElementById('btn-generate-report').addEventListener('click', function () {
            modal.style.display = 'flex';
        });
        document.getElementById('modal-close').addEventListener('click', function () {
            modal.style.display = 'none';
        });
        modal.addEventListener('click', function (e) {
            if (e.target === modal) modal.style.display = 'none';
        });
        document.getElementById('btn-download-docx').addEventListener('click', function () {
            ReportGenerator.generate();
            modal.style.display = 'none';
        });
    },

    // ----- DASHBOARD UPDATE -----
    updateDashboard: function () {
        var checks = AuditState.checks;
        var crit = 0, warn = 0, pass = 0;

        Object.keys(checks).forEach(function (k) {
            if (checks[k].severity === 'critical') crit++;
            else if (checks[k].severity === 'warning') warn++;
            else if (checks[k].severity === 'pass') pass++;
        });

        document.getElementById('stat-critical').textContent = crit;
        document.getElementById('stat-warnings').textContent = warn;
        document.getElementById('stat-passed').textContent = pass;
        document.getElementById('stat-screenshots').textContent = ScreenshotsModule.screenshots.length;

        // Render checks list
        this.renderChecksList();
        // Update nav badges
        this.updateNavBadges();
    },

    renderChecksList: function () {
        var container = document.getElementById('checks-list');
        var self = this;
        var html = '';

        SEO_CONSTANTS.CHECKS.forEach(function (check) {
            var state = AuditState.getCheck(check.id);
            var iconClass = state.severity;
            var iconContent = '';
            if (state.severity === 'pending') iconContent = '—';
            else if (state.severity === 'critical') iconContent = '✕';
            else if (state.severity === 'warning') iconContent = '!';
            else if (state.severity === 'pass') iconContent = '✓';
            else iconContent = 'i';

            html += '<div class="check-item" onclick="App.switchView(\'' + check.view + '\')">';
            html += '  <div class="check-status-icon ' + iconClass + '">' + iconContent + '</div>';
            html += '  <span class="check-name">' + check.name + '</span>';
            html += '  <span class="check-detail">' + state.detail + '</span>';
            html += '</div>';
        });

        container.innerHTML = html;
    },

    updateNavBadges: function () {
        // Remove existing badges
        document.querySelectorAll('.nav-item .badge').forEach(function (b) { b.remove(); });

        var checksByView = {};
        SEO_CONSTANTS.CHECKS.forEach(function (check) {
            var state = AuditState.getCheck(check.id);
            if (state.severity === 'pending') return;
            if (!checksByView[check.view]) checksByView[check.view] = { critical: 0, warning: 0, pass: 0 };
            checksByView[check.view][state.severity] = (checksByView[check.view][state.severity] || 0) + 1;
        });

        Object.keys(checksByView).forEach(function (view) {
            var nav = document.querySelector('.nav-item[data-view="' + view + '"]');
            if (!nav) return;
            var counts = checksByView[view];
            if (counts.critical > 0) {
                var badge = document.createElement('span');
                badge.className = 'badge badge-critical';
                badge.textContent = counts.critical;
                nav.appendChild(badge);
            } else if (counts.warning > 0) {
                var badge = document.createElement('span');
                badge.className = 'badge badge-warning';
                badge.textContent = counts.warning;
                nav.appendChild(badge);
            } else if (counts.pass > 0) {
                var badge = document.createElement('span');
                badge.className = 'badge badge-pass';
                badge.textContent = '✓';
                nav.appendChild(badge);
            }
        });
    },

    // ----- TOAST NOTIFICATIONS -----
    showToast: function (message, type) {
        var container = document.getElementById('toast-container');
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + (type || 'info');

        var icon = '';
        if (type === 'success') icon = '✓ ';
        else if (type === 'error') icon = '✕ ';
        else icon = 'ℹ ';

        toast.textContent = icon + message;
        container.appendChild(toast);

        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }
};

// ===== LAUNCH =====
document.addEventListener('DOMContentLoaded', function () {
    App.init();
});
