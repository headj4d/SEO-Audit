/* ============================================
   SCREENSHOTS MODULE
   Upload, categorize, and annotate screenshots
   ============================================ */
var ScreenshotsModule = {
    screenshots: [],

    init: function () {
        var self = this;
        var zone = document.getElementById('screenshot-upload-zone');
        var input = document.getElementById('screenshot-file-input');

        zone.addEventListener('click', function (e) {
            if (e.target.tagName !== 'LABEL') input.click();
        });
        zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', function () { zone.classList.remove('dragover'); });
        zone.addEventListener('drop', function (e) {
            e.preventDefault(); zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) self.addFiles(e.dataTransfer.files);
        });
        input.addEventListener('change', function () {
            if (input.files.length) self.addFiles(input.files);
            input.value = '';
        });
    },

    addFiles: function (fileList) {
        var self = this;
        Array.from(fileList).forEach(function (file) {
            if (!file.type.startsWith('image/')) return;
            var reader = new FileReader();
            reader.onload = function (e) {
                self.screenshots.push({
                    id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: file.name,
                    dataUrl: e.target.result,
                    category: 'other',
                    notes: ''
                });
                self.renderGallery();
                App.updateDashboard();
            };
            reader.readAsDataURL(file);
        });
        App.showToast('Screenshot(s) added', 'success');
    },

    removeScreenshot: function (id) {
        this.screenshots = this.screenshots.filter(function (s) { return s.id !== id; });
        this.renderGallery();
        App.updateDashboard();
    },

    updateCategory: function (id, category) {
        var s = this.screenshots.find(function (s) { return s.id === id; });
        if (s) s.category = category;
    },

    updateNotes: function (id, notes) {
        var s = this.screenshots.find(function (s) { return s.id === id; });
        if (s) s.notes = notes;
    },

    renderGallery: function () {
        var container = document.getElementById('screenshots-gallery');
        var self = this;

        if (this.screenshots.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No screenshots uploaded yet.</p></div>';
            return;
        }

        var html = '';
        this.screenshots.forEach(function (s) {
            html += '<div class="screenshot-card" data-id="' + s.id + '">';
            html += '  <div class="screenshot-img-wrap">';
            html += '    <img src="' + s.dataUrl + '" alt="' + s.name + '">';
            html += '    <button class="screenshot-remove" onclick="ScreenshotsModule.removeScreenshot(\'' + s.id + '\')">&times;</button>';
            html += '  </div>';
            html += '  <div class="screenshot-meta">';
            html += '    <select onchange="ScreenshotsModule.updateCategory(\'' + s.id + '\', this.value)">';
            SEO_CONSTANTS.CATEGORIES.forEach(function (cat) {
                html += '      <option value="' + cat.value + '"' + (s.category === cat.value ? ' selected' : '') + '>' + cat.label + '</option>';
            });
            html += '    </select>';
            html += '    <textarea placeholder="Add notes about this issue..." onchange="ScreenshotsModule.updateNotes(\'' + s.id + '\', this.value)">' + (s.notes || '') + '</textarea>';
            html += '  </div>';
            html += '</div>';
        });

        container.innerHTML = html;
    },

    getFindings: function () {
        return this.screenshots.length > 0 ? this.screenshots : null;
    }
};
