/* ============================================
   CONSTANTS — AI bots, thresholds, config
   ============================================ */
var SEO_CONSTANTS = {
    // Known AI / LLM crawler user-agent tokens
    AI_BOTS: [
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
        { id: 'fourxx-pages', name: '4xx Broken Pages', view: '4xx-issues' },
        { id: 'missing-alt', name: 'Images with Missing Alt', view: 'missing-alt' },
        { id: 'schema-validation', name: 'Schema Validation', view: 'schema-checker' },
        { id: 'spammy-domains', name: 'Spammy Referring Domains', view: 'spammy-domains' },
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
        { id: 'missing-alt', label: 'Images Missing Alt Text' },
        { value: 'duplicate-titles', label: 'Duplicate Titles' },
        { value: 'schema', label: 'Schema Validation' },
        { value: 'spammy-domains', label: 'Spammy Domains' },
        { value: 'other', label: 'Other' },
    ],
};
