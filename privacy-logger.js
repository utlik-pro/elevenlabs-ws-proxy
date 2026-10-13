"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeLogMetadata = sanitizeLogMetadata;
exports.installPrivacyLogger = installPrivacyLogger;
const installed = new WeakSet();
const components = new Set(['crm', 'webhook', 'phone', 'queue', 'worker', 'analyze', 'analyze/api', 'crm-queue', 'crm-worker', 'llm', 'security', 'widget-report', 'widget-health']);
const counters = new Set(['count', 'length', 'raw_length', 'rawLength', 'queue_size', 'pending', 'running', 'queued', 'executing', 'attempt', 'max_retries', 'delay_ms', 'next_attempt', 'statusCode', 'responseTimeMs', 'transcript_len', 'turn_count', 'system_prompt_length', 'user_prompt_length']);
const states = new Set(['success', 'error', 'pending', 'done', 'failed', 'healthy', 'unhealthy', 'unknown']);
// Allow only known technical fields. Bodies, headers, URLs, exception messages,
// contacts and model output are deliberately omitted rather than regex-masked.
function sanitizeLogMetadata(args) {
    const output = {};
    for (const arg of args) {
        if (!arg || typeof arg !== 'object' || Array.isArray(arg))
            continue;
        for (const [key, value] of Object.entries(arg)) {
            if (counters.has(key) && typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1e9)
                output[key] = value;
            if (['ok', 'inserted', 'configured'].includes(key) && typeof value === 'boolean')
                output[key] = value;
            if (key === 'status' && ((typeof value === 'number' && value >= 100 && value <= 599) || (typeof value === 'string' && states.has(value))))
                output[key] = value;
            if (key === 'event_id' && ((typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value < 1e9) || (typeof value === 'string' && /^[1-9]\d{0,8}$/.test(value))))
                output[key] = value;
            if (key === 'source' && ['bir.by', 'minskworld.by', 'healthcheck', 'unknown'].includes(String(value)))
                output[key] = value;
        }
    }
    return output;
}
function installPrivacyLogger(target = console) {
    if (installed.has(target))
        return;
    installed.add(target);
    for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
        if (typeof target[level] !== 'function')
            continue;
        const write = target[level].bind(target);
        target[level] = (...args) => {
            let metadata = {};
            try {
                metadata = sanitizeLogMetadata(args);
            }
            catch { /* Untrusted getters must not leak data. */ }
            const tag = typeof args[0] === 'string' ? /^\[([a-z][a-z0-9/-]*)\]/.exec(args[0])?.[1] : undefined;
            write(JSON.stringify({ level, component: tag && components.has(tag) ? tag : 'application', ...metadata }));
        };
    }
}
