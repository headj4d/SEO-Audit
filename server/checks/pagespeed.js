const fetch = require('node-fetch');

async function checkPageSpeed(url) {
    const strategies = ['mobile', 'desktop'];
    const results = { url, mobile: null, desktop: null };

    for (const strategy of strategies) {
        try {
            const apiKey = 'AIzaSyBqgnkTBRbS7wt5QeWnWFgWDB1iCTMShIk';
            const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${apiKey}`;
            const res = await fetch(apiUrl);
            const data = await res.json();

            if (data.lighthouseResult && data.lighthouseResult.categories.performance) {
                results[strategy] = Math.round(data.lighthouseResult.categories.performance.score * 100);
            } else {
                console.error(`PageSpeed ${strategy} no score for ${url}`, data.error);
            }
        } catch (err) {
            console.error(`PageSpeed ${strategy} failed for ${url}:`, err.message);
        }
    }

    return results;
}

module.exports = { checkPageSpeed };
