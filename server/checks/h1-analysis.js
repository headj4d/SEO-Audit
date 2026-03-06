function analyzeH1Tags(pages) {
    const missing = [];
    const multiple = [];

    pages.forEach(page => {
        if (page.statusCode !== 200) return;

        if (page.h1s.length === 0) {
            missing.push({ url: page.url, h1: '(none)' });
        } else if (page.h1s.length > 1) {
            multiple.push({ url: page.url, count: page.h1s.length, h1s: page.h1s.join(' | ') });
        }
    });

    return { missing, multiple };
}

module.exports = { analyzeH1Tags };
