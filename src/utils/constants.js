/* ============================================
   CONSTANTS — AI bots, thresholds, config
   ============================================ */
var SEO_CONSTANTS = {
    // Known AI / LLM crawler user-agent tokens
    AI_BOTS: [
        { name: 'Googlebot', label: 'Google Search' },
        { name: 'AdsBot-Google', label: 'AdsBot-Google' },
        { name: 'Bingbot', label: 'Bingbot' },
        { name: 'ChatGPT', label: 'ChatGPT' },
        { name: 'OpenAI', label: 'OpenAI' },
    ],

    // Meta title thresholds
    TITLE_MAX_LENGTH: 60,
    TITLE_MIN_LENGTH: 10,

    // PageSpeed threshold
    PAGESPEED_FAIL_THRESHOLD: 50,

    // Shopify URL patterns
    SHOPIFY_COLLECTION_PRODUCT_REGEX: /\/collections\/[^\/]+\/products\//i,
    SHOPIFY_CORRECT_PRODUCT_REGEX: /\/products\/[^\/]+\/?$/i,

    // Audit check definitions
    CHECKS: [
        { id: 'pagespeed', name: 'PageSpeed Score', view: 'pagespeed' },
        { id: 'h1-missing', name: 'Missing H1 Tags', view: 'h1-checker' },
        { id: 'h1-multiple', name: 'Multiple H1 Tags', view: 'h1-checker' },
        { id: 'robots-ai', name: 'AI Bots in robots.txt', view: 'robots-ai' },
        { id: 'external-domains', name: 'Irrelevant External Domains', view: 'external-domains' },
        { id: 'meta-titles', name: 'Meta Titles Too Long', view: 'meta-titles' },
        { id: 'duplicate-titles', name: 'Duplicate Page Titles', view: 'duplicate-titles' },
        { id: 'shopify-urls', name: 'Shopify URL Structure', view: 'shopify-urls' },
        { id: 'broken-backlinks', name: 'Broken Backlinks', view: 'broken-links' },
        { id: 'fourxx-pages', name: '4xx Broken Pages', view: 'broken-links' },
    ],

    SEVERITY: {
        CRITICAL: 'critical',
        WARNING: 'warning',
        PASS: 'pass',
        INFO: 'info',
        PENDING: 'pending',
    },

    // Categories for screenshot association
    CATEGORIES: [
        { value: 'pagespeed', label: 'PageSpeed Issues' },
        { value: 'h1', label: 'H1 Tag Issues' },
        { value: 'robots', label: 'AI Bots / robots.txt' },
        { value: 'external', label: 'External Domains' },
        { value: 'meta', label: 'Meta Titles' },
        { value: 'shopify', label: 'Shopify URL Structure' },
        { value: 'backlinks', label: 'Broken Backlinks' },
        { value: 'fourxx', label: '4xx Pages' },
        { value: 'duplicate-titles', label: 'Duplicate Titles' },
        { value: 'other', label: 'Other' },
    ],
};
