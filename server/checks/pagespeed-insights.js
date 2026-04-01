const fetch = require('node-fetch');

const PSI_API_BASE = 'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Fetch PageSpeed Insights data for a URL and strategy
 */
async function fetchPSI(url, strategy) {
    const apiKey = process.env.PSI_API_KEY || 'AIzaSyBqgnkTBRbS7wt5QeWnWFgWDB1iCTMShIk';
    const params = new URLSearchParams({
        url: url,
        strategy: strategy,
        category: 'performance'
    });
    if (apiKey) params.set('key', apiKey);

    const apiUrl = `${PSI_API_BASE}?${params.toString()}`;
    const res = await fetch(apiUrl, { timeout: 120000 });
    if (!res.ok) {
        let errMsg = `PageSpeed API error (${res.status})`;
        try {
            const errBody = await res.json();
            if (errBody.error && errBody.error.message) {
                const msg = errBody.error.message;
                if (res.status === 429 || msg.includes('Quota exceeded') || msg.includes('RATE_LIMIT')) {
                    errMsg = 'API quota exceeded. Please wait a few minutes and try again, or set a PSI_API_KEY environment variable.';
                } else if (res.status === 400) {
                    errMsg = 'Invalid URL. Please check the URL and try again.';
                } else {
                    errMsg = msg;
                }
            }
        } catch (_) { /* ignore parse errors */ }
        throw new Error(errMsg);
    }
    return res.json();
}

/**
 * Assess Core Web Vitals from loading experience data
 * Returns: 'passed' | 'not_passed' | 'unavailable'
 */
function assessCWV(loadingExperience) {
    if (!loadingExperience || !loadingExperience.metrics) return 'unavailable';

    const cwvMetrics = ['LARGEST_CONTENTFUL_PAINT_MS', 'INTERACTION_TO_NEXT_PAINT', 'CUMULATIVE_LAYOUT_SHIFT_SCORE'];
    const available = cwvMetrics.filter(m => loadingExperience.metrics[m]);

    if (available.length === 0) return 'unavailable';

    // Check overall_category on the loading experience itself (Google provides this)
    if (loadingExperience.overall_category) {
        return loadingExperience.overall_category === 'FAST' ? 'passed' :
               loadingExperience.overall_category === 'AVERAGE' ? 'not_passed' :
               'not_passed';
    }

    // Fallback: all CWV metrics must be FAST or AVERAGE to pass
    const allGood = available.every(m => {
        const cat = loadingExperience.metrics[m].category;
        return cat === 'FAST';
    });

    return allGood ? 'passed' : 'not_passed';
}

/**
 * Extract field data metrics from PSI response
 * Prefers page-level, falls back to origin-level
 */
function extractFieldData(data) {
    let source = null;
    let experience = null;

    if (data.loadingExperience && data.loadingExperience.metrics &&
        Object.keys(data.loadingExperience.metrics).length > 0) {
        experience = data.loadingExperience;
        source = 'page';
    } else if (data.originLoadingExperience && data.originLoadingExperience.metrics &&
               Object.keys(data.originLoadingExperience.metrics).length > 0) {
        experience = data.originLoadingExperience;
        source = 'origin';
    }

    if (!experience) {
        return { source: null, cwvAssessment: 'unavailable', metrics: {} };
    }

    const metricMap = {
        'LARGEST_CONTENTFUL_PAINT_MS': { key: 'lcp', label: 'Largest Contentful Paint (LCP)', unit: 'ms' },
        'INTERACTION_TO_NEXT_PAINT': { key: 'inp', label: 'Interaction to Next Paint (INP)', unit: 'ms' },
        'CUMULATIVE_LAYOUT_SHIFT_SCORE': { key: 'cls', label: 'Cumulative Layout Shift (CLS)', unit: '' },
        'FIRST_CONTENTFUL_PAINT_MS': { key: 'fcp', label: 'First Contentful Paint (FCP)', unit: 'ms' },
        'EXPERIMENTAL_TIME_TO_FIRST_BYTE': { key: 'ttfb', label: 'Time to First Byte (TTFB)', unit: 'ms' }
    };

    const metrics = {};
    for (const [apiKey, info] of Object.entries(metricMap)) {
        const m = experience.metrics[apiKey];
        if (m) {
            metrics[info.key] = {
                label: info.label,
                value: m.percentile,
                unit: info.unit,
                category: m.category, // FAST, AVERAGE, SLOW
                distributions: m.distributions || []
            };
        }
    }

    return {
        source,
        cwvAssessment: assessCWV(experience),
        metrics
    };
}

/**
 * Extract Lighthouse lab data
 */
function extractLabData(lighthouseResult) {
    if (!lighthouseResult || !lighthouseResult.audits) return null;

    const audits = lighthouseResult.audits;
    const perfScore = lighthouseResult.categories &&
                      lighthouseResult.categories.performance ?
                      Math.round(lighthouseResult.categories.performance.score * 100) : null;

    const labMetrics = [
        { id: 'first-contentful-paint', label: 'First Contentful Paint' },
        { id: 'largest-contentful-paint', label: 'Largest Contentful Paint' },
        { id: 'total-blocking-time', label: 'Total Blocking Time' },
        { id: 'cumulative-layout-shift', label: 'Cumulative Layout Shift' },
        { id: 'speed-index', label: 'Speed Index' },
        { id: 'interactive', label: 'Time to Interactive' }
    ];

    const metrics = [];
    labMetrics.forEach(function(m) {
        const audit = audits[m.id];
        if (audit) {
            metrics.push({
                id: m.id,
                label: m.label,
                displayValue: audit.displayValue || '',
                score: audit.score !== undefined ? audit.score : null,
                numericValue: audit.numericValue || null
            });
        }
    });

    return { performanceScore: perfScore, metrics };
}

/**
 * Extract meaningful performance opportunities
 */
function extractOpportunities(lighthouseResult) {
    if (!lighthouseResult || !lighthouseResult.audits) return [];

    const audits = lighthouseResult.audits;
    const opportunities = [];

    // Check the performance category audit refs for opportunity type
    const perfCategory = lighthouseResult.categories && lighthouseResult.categories.performance;
    const opportunityRefs = perfCategory && perfCategory.auditRefs ?
        perfCategory.auditRefs.filter(r => r.group === 'load-opportunities') : [];

    opportunityRefs.forEach(function(ref) {
        const audit = audits[ref.id];
        if (!audit || audit.score === 1 || audit.score === null) return;

        const savings = audit.details && audit.details.overallSavingsMs ?
            Math.round(audit.details.overallSavingsMs) : null;

        if (savings !== null && savings <= 0) return;

        opportunities.push({
            id: ref.id,
            title: audit.title || ref.id,
            description: audit.description || '',
            displayValue: audit.displayValue || '',
            score: audit.score,
            savings: savings,
            details: audit.details || null
        });
    });

    // Sort by savings descending
    opportunities.sort(function(a, b) {
        return (b.savings || 0) - (a.savings || 0);
    });

    return opportunities;
}

/**
 * Extract diagnostics and passed audits
 */
function extractDiagnostics(lighthouseResult) {
    if (!lighthouseResult || !lighthouseResult.audits) return { diagnostics: [], passedCount: 0 };

    const audits = lighthouseResult.audits;
    const perfCategory = lighthouseResult.categories && lighthouseResult.categories.performance;
    const diagnosticRefs = perfCategory && perfCategory.auditRefs ?
        perfCategory.auditRefs.filter(r => r.group === 'diagnostics') : [];

    const diagnostics = [];
    diagnosticRefs.forEach(function(ref) {
        const audit = audits[ref.id];
        if (!audit || audit.score === null) return;
        diagnostics.push({
            id: ref.id,
            title: audit.title || ref.id,
            description: audit.description || '',
            displayValue: audit.displayValue || '',
            score: audit.score
        });
    });

    // Count passed audits
    const allRefs = perfCategory && perfCategory.auditRefs ? perfCategory.auditRefs : [];
    let passedCount = 0;
    allRefs.forEach(function(ref) {
        const audit = audits[ref.id];
        if (audit && audit.score === 1) passedCount++;
    });

    return { diagnostics, passedCount };
}

/**
 * Full PSI analysis for a single strategy
 */
function processResult(data) {
    const fieldData = extractFieldData(data);
    const labData = extractLabData(data.lighthouseResult);
    const opportunities = extractOpportunities(data.lighthouseResult);
    const diagnosticsData = extractDiagnostics(data.lighthouseResult);

    return {
        fieldData,
        labData,
        opportunities,
        diagnostics: diagnosticsData.diagnostics,
        passedAudits: diagnosticsData.passedCount,
        finalUrl: data.lighthouseResult ? data.lighthouseResult.finalUrl : data.id,
        timestamp: data.analysisUTCTimestamp || new Date().toISOString()
    };
}

module.exports = { fetchPSI, processResult, assessCWV };
