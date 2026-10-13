const fs=require("node:fs");const assert=require("node:assert/strict");const {installPrivacyLogger,sanitizeLogMetadata}=require("./privacy-logger");
const output = [];
const target = Object.fromEntries(['log','info','warn','error','debug'].map(level => [level, (...args) => output.push(args.join(' '))]));
installPrivacyLogger(target);
installPrivacyLogger(target);
const secret = 'SYNTHETIC_PRIVATE_CANARY';
for (const level of Object.keys(target)) {
  target[level](secret, { password: secret, authorization: secret, phone: secret, transcript: secret, status: 200, event_id: 42, source: 'bir.by', responseTimeMs: 30 });
  target[level]('[crm] ' + secret, new Error(secret), { payload: { token: secret }, body_preview: secret, error: secret });
  target[level]('[SYNTHETIC_PRIVATE_CANARY]');
}
target.error({ get password() { throw new Error(secret); } });
assert.ok(output.length > 0);
assert.ok(!output.join('\n').includes(secret), 'Raw strings, headers, contacts, errors and model output must not appear');
const record = JSON.parse(output[0]);
assert.equal(record.status, 200);
assert.equal(record.event_id, 42);
assert.equal(record.responseTimeMs, 30);
assert.equal(record.source, 'bir.by');
assert.equal(record.password, undefined);
assert.equal(record.phone, undefined);
assert.equal(Object.keys(sanitizeLogMetadata([{ source: secret, status: secret, event_id: secret, count: secret }])).length, 0);
console.log('PASS: privacy logger drops passwords, contacts, transcripts, URLs, errors and nested payloads; retains technical metadata');
