const cheerio = require('cheerio');
const fetch = require('node-fetch');

/**
 * Validates structured data (JSON-LD, Microdata) on a given URL.
 * Directly fetches the page HTML and parses it — no external service dependency.
 *
 * @param {string} url - The URL to test
 * @returns {Promise<Object>} Schema validation results
 */
async function validateSchema(url) {
    try {
        // Normalise URL
        if (!url.startsWith('http')) url = 'https://' + url;

        // Fetch the page HTML
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 15000,
            redirect: 'follow'
        });

        if (!response.ok) {
            return {
                url,
                testStatus: 'Failed',
                detectedTypes: [],
                organizationPresent: false,
                websitePresent: false,
                productPresent: false,
                schemas: [],
                message: `HTTP ${response.status}: Could not fetch the page.`
            };
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // ---- 1. Extract JSON-LD structured data ----
        const jsonLdSchemas = [];
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const raw = $(el).html();
                if (!raw) return;
                let parsed = JSON.parse(raw);

                // Handle @graph arrays
                if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
                    parsed['@graph'].forEach(item => jsonLdSchemas.push(item));
                } else if (Array.isArray(parsed)) {
                    parsed.forEach(item => jsonLdSchemas.push(item));
                } else {
                    jsonLdSchemas.push(parsed);
                }
            } catch (e) {
                // Ignore malformed JSON-LD blocks
            }
        });

        // ---- 2. Extract Microdata types ----
        const microdataTypes = new Set();
        $('[itemtype]').each((i, el) => {
            const itemtype = $(el).attr('itemtype') || '';
            // e.g. "https://schema.org/Organization"
            const match = itemtype.match(/schema\.org\/(\w+)/i);
            if (match) microdataTypes.add(match[1]);
        });

        // ---- 3. Collect all detected @type values ----
        const detectedTypes = new Set();

        // From JSON-LD
        jsonLdSchemas.forEach(schema => {
            const types = extractTypes(schema);
            types.forEach(t => detectedTypes.add(t));
        });

        // From Microdata
        microdataTypes.forEach(t => detectedTypes.add(t));

        const typesArray = [...detectedTypes];

        // ---- 4. Build detailed schema info ----
        const schemas = jsonLdSchemas.map(schema => {
            const types = extractTypes(schema);
            return {
                types,
                name: schema.name || schema.legalName || null,
                url: schema.url || null,
                description: schema.description ? schema.description.substring(0, 120) + '...' : null
            };
        });

        // ---- 5. Determine presence of key schema types ----
        const organizationPresent = typesArray.some(t =>
            /^(Organization|Corporation|LocalBusiness|Store|OnlineStore|AutoDealer|MedicalOrganization|NGO|EducationalOrganization|GovernmentOrganization|SportsOrganization)$/i.test(t)
        );
        const websitePresent = typesArray.some(t => /^WebSite$/i.test(t));
        const productPresent = typesArray.some(t =>
            /^(Product|ProductGroup|IndividualProduct|ProductModel|Vehicle)$/i.test(t)
        );

        // Also check for BreadcrumbList, FAQPage, Article, etc. as bonus info
        const breadcrumbPresent = typesArray.some(t => /^BreadcrumbList$/i.test(t));
        const faqPresent = typesArray.some(t => /^FAQPage$/i.test(t));

        // ---- 6. Determine overall status ----
        let status = 'Completed';
        let message = 'Test completed';

        if (typesArray.length === 0) {
            status = 'Warning';
            message = 'No structured data (JSON-LD or Microdata) found on this page.';
        }

        return {
            url,
            testStatus: status,
            detectedTypes: typesArray,
            organizationPresent,
            websitePresent,
            productPresent,
            breadcrumbPresent,
            faqPresent,
            schemas,
            message
        };

    } catch (error) {
        return {
            url,
            testStatus: 'Failed',
            detectedTypes: [],
            organizationPresent: false,
            websitePresent: false,
            productPresent: false,
            schemas: [],
            message: 'Could not validate schema: ' + error.message
        };
    }
}

/**
 * Recursively extract @type values from a JSON-LD object.
 */
function extractTypes(obj) {
    const types = new Set();
    if (!obj || typeof obj !== 'object') return types;

    if (obj['@type']) {
        const t = obj['@type'];
        if (Array.isArray(t)) {
            t.forEach(v => types.add(v));
        } else {
            types.add(t);
        }
    }

    // Recurse into nested objects/arrays
    for (const key of Object.keys(obj)) {
        if (key === '@type') continue;
        const val = obj[key];
        if (Array.isArray(val)) {
            val.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    extractTypes(item).forEach(t => types.add(t));
                }
            });
        } else if (typeof val === 'object' && val !== null) {
            extractTypes(val).forEach(t => types.add(t));
        }
    }

    return types;
}

module.exports = { validateSchema };
