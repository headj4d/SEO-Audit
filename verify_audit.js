const fetch = require('node-fetch');

async function testAudit() {
    const domain = 'port80.ge';
    console.log(`Starting test audit for ${domain}...`);

    try {
        const response = await fetch(`http://localhost:3000/api/audit?domain=${domain}`);
        const reader = response.body;

        reader.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.type === 'result' && data.step === 'pagespeed') {
                            console.log('--- PageSpeed Result Received ---');
                            console.log(JSON.stringify(data.data, null, 2));
                            console.log('Severity:', data.severity);
                        } else if (data.type === 'complete') {
                            console.log('Audit Complete!');
                            process.exit(0);
                        } else if (data.type === 'progress') {
                            console.log('Progress:', data.message);
                        }
                    } catch (e) {
                        // Not JSON or partial
                    }
                }
            }
        });

    } catch (err) {
        console.error('Test failed:', err.message);
        process.exit(1);
    }
}

testAudit();
