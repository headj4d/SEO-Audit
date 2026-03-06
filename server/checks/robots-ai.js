const fetch = require('node-fetch');

async function checkRobotsAI(url) {
    // Construct robots.txt URL
    let robotsUrl = url;
    if (!robotsUrl.endsWith('/robots.txt')) {
        if (!robotsUrl.endsWith('/')) robotsUrl += '/';
        robotsUrl += 'robots.txt';
    }

    try {
        const res = await fetch(robotsUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const content = await res.text();

        const expectedBots = [
            'Googlebot',
            'AdsBot-Google',
            'Bingbot',
            'ChatGPT',
            'OpenAI'
        ];

        // Extract all unique User-agent values
        const allAgents = [...new Set(
            content
                .split('\n')
                .map(line => line.trim())
                .filter(line => /^user-agent:/i.test(line))
                .map(line => line.split(':')[1].trim())
        )];

        // 1) Show everything
        console.log('\n--- robots.txt Check ---');
        console.log(' Found User-agents:');
        allAgents.forEach(agent => console.log(`• ${agent}`));

        // 2) Determine which expected bots are missing
        const missing = [];
        expectedBots.forEach(bot => {
            const hasSpecific = allAgents.some(a => a.toLowerCase() === bot.toLowerCase());
            const hasWildcard = allAgents.includes('*');

            if (bot.toLowerCase() === 'googlebot' && !hasSpecific && hasWildcard) {
                console.log(
                    ` Note: You don't have a "User-agent: Googlebot" block, but ` +
                    `"User-agent: *" will apply to Googlebot (it's a wildcard).`
                );
            } else if (!hasSpecific) {
                missing.push(bot);
            }
        });

        // 3) Report
        console.log('\n AI User-Agents Missing:');
        if (missing.length) {
            missing.forEach(bot =>
                console.log(` Missing: User-agent: ${bot}`)
            );
        } else {
            console.log(' All expected AI user-agents are present!');
        }
        console.log('------------------------\n');

        return expectedBots.map(bot => {
            return {
                name: bot,
                label: bot,
                // Status blocked visually represents "Missing" in the UI
                status: missing.includes(bot) ? 'blocked' : 'allowed' 
            };
        });

    } catch (err) {
        throw new Error('Could not fetch robots.txt: ' + err.message);
    }
}

module.exports = { checkRobotsAI };
