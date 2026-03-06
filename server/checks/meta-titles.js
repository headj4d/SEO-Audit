function analyzeMetaTitles(pages) {
    const tooLong = [];
    const missing = [];

    pages.forEach(page => {
        if (page.statusCode !== 200) return;

        if (!page.title) {
            missing.push({ url: page.url });
        } else if (page.title.length > 60) {
            tooLong.push({ url: page.url, title: page.title, length: page.title.length });
        }
    });

    return { tooLong, missing };
}

module.exports = { analyzeMetaTitles };
