/**
 * ElevenLabs WebSocket Proxy for Render
 *
 * This proxy allows users from sanctioned countries to connect to ElevenLabs
 * by routing WebSocket traffic through a US-based server.
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ElevenLabs WebSocket Proxy - Use WebSocket connection');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Track active connections for logging
let activeConnections = 0;

wss.on('connection', (clientWs, req) => {
  activeConnections++;
  const connectionId = Date.now().toString(36);

  console.log(`[${connectionId}] New client connected. Active: ${activeConnections}`);

  // Get signed_url from query parameter
  const params = url.parse(req.url, true).query;
  const signedUrl = params.url;

  if (!signedUrl) {
    console.log(`[${connectionId}] Missing signed URL, closing connection`);
    clientWs.close(1008, 'Missing signed URL parameter');
    activeConnections--;
    return;
  }

  // Validate URL is from ElevenLabs
  if (!signedUrl.includes('elevenlabs.io')) {
    console.log(`[${connectionId}] Invalid URL domain, closing connection`);
    clientWs.close(1008, 'Invalid URL domain');
    activeConnections--;
    return;
  }

  console.log(`[${connectionId}] Connecting to ElevenLabs...`);

  // Connect to ElevenLabs
  const elevenLabsWs = new WebSocket(signedUrl);

  let elevenLabsConnected = false;
  let clientConnected = true;

  // Buffer messages until ElevenLabs connection is ready
  const messageBuffer = [];

  elevenLabsWs.on('open', () => {
    elevenLabsConnected = true;
    console.log(`[${connectionId}] Connected to ElevenLabs`);

    // Send any buffered messages with correct binary flag
    while (messageBuffer.length > 0) {
      const { data, isBinary } = messageBuffer.shift();
      elevenLabsWs.send(data, { binary: isBinary });
    }
  });

  // Proxy messages: Client -> ElevenLabs
  // isBinary flag preserves message type (text vs binary)
  clientWs.on('message', (data, isBinary) => {
    if (elevenLabsConnected && elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.send(data, { binary: isBinary });
    } else {
      // Buffer message until connection is ready
      messageBuffer.push({ data, isBinary });
    }
  });

  // Proxy messages: ElevenLabs -> Client
  // isBinary flag preserves message type (text vs binary)
  elevenLabsWs.on('message', (data, isBinary) => {
    if (clientConnected && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });

  // Handle client close
  clientWs.on('close', (code, reason) => {
    clientConnected = false;
    console.log(`[${connectionId}] Client disconnected: ${code} ${reason || ''}`);

    if (elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
    activeConnections--;
  });

  // Handle ElevenLabs close
  elevenLabsWs.on('close', (code, reason) => {
    elevenLabsConnected = false;
    console.log(`[${connectionId}] ElevenLabs disconnected: ${code} ${reason || ''}`);

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code, reason);
    }
  });

  // Handle client errors
  clientWs.on('error', (err) => {
    console.error(`[${connectionId}] Client error:`, err.message);
    clientConnected = false;

    if (elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.close();
    }
  });

  // Handle ElevenLabs errors
  elevenLabsWs.on('error', (err) => {
    console.error(`[${connectionId}] ElevenLabs error:`, err.message);
    elevenLabsConnected = false;

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'ElevenLabs connection error');
    }
  });

  // Ping/pong for keepalive
  const pingInterval = setInterval(() => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.ping();
    }
    if (elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.ping();
    }
  }, 30000);

  clientWs.on('close', () => clearInterval(pingInterval));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');

  wss.clients.forEach((client) => {
    client.close(1001, 'Server shutting down');
  });

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`WebSocket proxy running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
