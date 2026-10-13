'use strict';

// Only relay new authenticated ElevenLabs conversations, never arbitrary URLs.
function parseSignedConversationUrl(value) {
  if (typeof value !== 'string' || value.length > 8192) return null;
  try {
    const target = new URL(value);
    if (target.protocol !== 'wss:' || target.hostname !== 'api.elevenlabs.io'
      || target.port || target.username || target.password
      || target.pathname !== '/v1/convai/conversation' || target.hash) return null;
    const agents = target.searchParams.getAll('agent_id');
    const signatures = target.searchParams.getAll('conversation_signature');
    if (agents.length !== 1 || !/^[A-Za-z0-9_-]{1,128}$/.test(agents[0])
      || signatures.length !== 1 || !signatures[0] || signatures[0].length > 4096) return null;
    return target.toString();
  } catch { return null; }
}

module.exports = { parseSignedConversationUrl };
