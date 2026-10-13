const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { parseSignedConversationUrl } = require('./signed-url');
const valid = 'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_synthetic&conversation_signature=synthetic-signature';
const denied = [null, [], {}, valid.repeat(50),
  'wss://internal.invalid/api/events?hint=elevenlabs.io',
  'wss://elevenlabs.io@127.0.0.1/api/events',
  'wss://api.elevenlabs.io.attacker.invalid/v1/convai/conversation?agent_id=agent_test&conversation_signature=x',
  valid.replace('wss:', 'ws:'), valid.replace('api.elevenlabs.io', 'api.elevenlabs.io:8443'),
  valid.replace('/v1/convai/conversation?', '/v1/convai/conversations/private-id?'),
  valid.split('&conversation_signature')[0], valid + '&agent_id=another',
  valid + '&conversation_signature=another', valid + '#fragment',
  valid.replace('api.elevenlabs.io', 'user:password@api.elevenlabs.io')];
for (const value of denied) assert.equal(parseSignedConversationUrl(value), null, String(value));
assert.equal(parseSignedConversationUrl(valid), valid);
assert.equal(parseSignedConversationUrl(valid.replace('api.elevenlabs.io', 'api.elevenlabs.io:443')), valid);

let connection, upstream = [], httpHandler;
class Socket extends EventEmitter {
  constructor(value) { super(); this.readyState = 1; upstream.push(value); }
  close(code) { this.closeCode = code; this.readyState = 3; }
  send() {} ping() {}
}
Socket.OPEN = 1;
Socket.Server = class { constructor() { this.clients = []; } on(name, callback) { if (name === 'connection') connection = callback; } };
const server = { listen() {}, close() {} };
const sandbox = {
  require: name => name === 'ws' ? Socket : name === 'http' ? { createServer: handler => { httpHandler = handler; return server; } }
    : name === './signed-url' ? { parseSignedConversationUrl } : require(name),
  console: { log() {}, error() {} }, Buffer, Date, process: { env: { VOICE_SESSIONS_ENABLED: 'true' }, on() {} },
  setInterval: () => 1, clearInterval() {},
};
vm.runInNewContext(fs.readFileSync(__dirname + '/server.js', 'utf8'), sandbox);
for (const value of denied.filter(v => typeof v === 'string')) {
  const client = new EventEmitter(); client.close = code => { client.closeCode = code; };
  const before = upstream.length;
  connection(client, { url: '/?url=' + encodeURIComponent(value) });
  assert.equal(client.closeCode, 1008); assert.equal(upstream.length, before, 'Rejected URL must never open an upstream socket');
}
const multiple = new EventEmitter(); multiple.close = code => { multiple.closeCode = code; };
connection(multiple, { url: '/?url=' + encodeURIComponent(valid) + '&url=' + encodeURIComponent(valid) });
assert.equal(multiple.closeCode, 1008);
const client = new EventEmitter(); client.readyState = 1; client.close = () => {}; client.send = () => {}; client.ping = () => {};
connection(client, { url: '/?url=' + encodeURIComponent(valid) });
assert.equal(upstream.at(-1), valid, 'Legitimate widget must still connect to ElevenLabs');
sandbox.process.env.VOICE_SESSIONS_ENABLED = 'false';
vm.runInNewContext(fs.readFileSync(__dirname + '/server.js', 'utf8'), { ...sandbox });
const off = new EventEmitter(); off.close = code => { off.closeCode = code; };
const countBefore = upstream.length;
connection(off, { url: '/?url=' + encodeURIComponent(valid) });
assert.equal(off.closeCode, 1008);
assert.equal(upstream.length, countBefore, 'Disabled proxy must reject even a valid signed session');
const response = { writeHead(code) { this.code = code; }, end(body) { this.body = body; } };
httpHandler({ url: '/' }, response);
assert.equal(response.code, 404);
assert.equal(response.body, 'Not Found');
console.log('PASS: exact upstream host/protocol/path, signed session parameters, credential smuggling, private paths, duplicate inputs and actual connection handler');
