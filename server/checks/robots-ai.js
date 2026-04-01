const fetch = require('node-fetch');

const AI_BOTS = [
    { name: 'GPTBot', label: 'OpenAI / ChatGPT' },
    { name: 'ChatGPT-User', label: 'ChatGPT Browse' },
    { name: 'OAI-SearchBot', label: 'OpenAI Search' },
    { name: 'anthropic-ai', label: 'Anthropic / Claude' },
    { name: 'ClaudeBot', label: 'Claude AI' },
    { name: 'Claude-Web', label: 'Claude Web' },
    { name: 'Google-Extended', label: 'Google Gemini / Bard' },
    { name: 'Googlebot', label: 'Google Search' },
    { name: 'Bingbot', label: 'Bing / Copilot' },
    { name: 'PerplexityBot', label: 'Perplexity AI' },
    { name: 'YouBot', label: 'You.com AI' },
    { name: 'CCBot', label: 'Common Crawl (AI Training)' },
    { name: 'cohere-ai', label: 'Cohere AI' },
    { name: 'FacebookBot', label: 'Meta AI' },
    { name: 'Diffbot', label: 'Diffbot AI' },
    { name: 'Bytespider', label: 'ByteDance / TikTok AI' },
    { name: 'PetalBot', label: 'Huawei AI' },
    { name: 'Applebot-Extended', label: 'Apple AI Training' },
    { name: 'Applebot', label: 'Apple Search' },
    { name: 'ImagesiftBot', label: 'ImageSift AI' },
    { name: 'Omgilibot', label: 'Meltwater AI' },
];

async function checkRobotsAI(siteUrl) {
    // Build robots.txt URL from any site URL input
    let robotsUrl = siteUrl.trim();
    if (!robotsUrl.startsWith('http')) robotsUrl = 'https://' + robotsUrl;

    // Strip to origin then append /robots.txt
    try {
        const parsed = new URL(robotsUrl);
        robotsUrl = parsed.origin + '/robots.txt';
    } catch (e) {
        // If URL parsing fails, do best-effort
        if (!robotsUrl.includes('robots.txt')) {
            if (!robotsUrl.endsWith('/')) robotsUrl += '/';
            robotsUrl += 'robots.txt';
        }
    }

    let content;
    try {
        const res = await fetch(robotsUrl, {
            headers: { 'User-Agent': 'SEO-Audit-Tool/1.0' },
            timeout: 10000
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        content = await res.text();
    } catch (err) {
        throw new Error(`Could not fetch ${robotsUrl}: ${err.message}`);
    }

    // Parse blocks: { agentName -> [directives] }
    const blocks = {};
    let currentAgents = [];
    const lines = content.split('\n');

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            // A blank line ends the current block
            currentAgents = [];
            continue;
        }
        const uaMatch = line.match(/^user-agent:\s*(.+)/i);
        if (uaMatch) {
            const agent = uaMatch[1].trim();
            currentAgents.push(agent);
            if (!blocks[agent]) blocks[agent] = [];
            continue;
        }
        // directive line
        for (const agent of currentAgents) {
            if (!blocks[agent]) blocks[agent] = [];
            blocks[agent].push(line);
        }
    }

    const wildcardBlock = blocks['*'] || [];
    const wildcardDisallowAll = wildcardBlock.some(d => /^disallow:\s*\/\s*$/i.test(d));
    const wildcardAllowAll = wildcardBlock.some(d => /^allow:\s*\/\s*$/i.test(d)) ||
        wildcardBlock.every(d => /^allow:/i.test(d));

    const results = AI_BOTS.map(bot => {
        // Find bot block (case-insensitive)
        const botKey = Object.keys(blocks).find(
            k => k.toLowerCase() === bot.name.toLowerCase()
        );
        const botBlock = botKey ? blocks[botKey] : null;

        let status, reason;

        if (botBlock) {
            // Bot has its own explicit block
            const hasDisallowRoot = botBlock.some(d => /^disallow:\s*\//i.test(d));
            const hasDisallowAll = botBlock.some(d => /^disallow:\s*\/\s*$/i.test(d));
            const hasAllowAll = botBlock.some(d => /^allow:\s*\/\s*$/i.test(d));
            const hasEmptyDisallow = botBlock.some(d => /^disallow:\s*$/i.test(d));

            if (hasDisallowAll && !hasAllowAll) {
                status = 'blocked';
                reason = `Explicitly blocked — User-agent: ${bot.name} / Disallow: /`;
            } else if (hasDisallowRoot && !hasAllowAll) {
                // Partial disallow
                const disallows = botBlock
                    .filter(d => /^disallow:/i.test(d))
                    .map(d => d.replace(/^disallow:\s*/i, '').trim())
                    .join(', ');
                status = 'blocked';
                reason = `Partially blocked — Disallow: ${disallows}`;
            } else if (hasEmptyDisallow || hasAllowAll) {
                status = 'allowed';
                reason = `Explicitly allowed — User-agent: ${bot.name}`;
            } else {
                status = 'allowed';
                reason = `Mentioned in robots.txt — allowed`;
            }
        } else if (wildcardDisallowAll && !wildcardAllowAll) {
            // Wildcard blocks everything and bot has no override
            status = 'blocked';
            reason = 'Blocked by wildcard rule — User-agent: * / Disallow: /';
        } else {
            // Not mentioned at all, no blanket block
            status = 'allowed';
            reason = 'Not mentioned in robots.txt (assumed allowed)';
        }

        return {
            name: bot.name,
            label: bot.label,
            status,
            reason,
            robotsUrl
        };
    });

    return { results, robotsUrl, rawContent: content };
}

module.exports = { checkRobotsAI };
