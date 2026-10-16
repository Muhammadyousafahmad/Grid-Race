// Map to track active client connections and room registrations
const clients = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. PeerJS ID Generation Endpoint
    if (path.endsWith('/id')) {
      const randomId = 'grid-race-' + Math.random().toString(36).substring(2, 9);
      return new Response(randomId, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain',
        },
      });
    }

    // 2. Handle WebSocket Connection Handshakes
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      // Extract client peer ID from query string: ?id=xxx
      const peerId = url.searchParams.get('id');

      server.accept();

      if (peerId) {
        clients.set(peerId, server);
        // Send OPEN heartbeats back to confirm registration
        server.send(JSON.stringify({ type: 'OPEN' }));
      }

      server.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          // Relay signaling messages (OFFER, ANSWER, CANDIDATE) to the target peer
          if (message.dst && clients.has(message.dst)) {
            const recipientSocket = clients.get(message.dst);
            recipientSocket.send(JSON.stringify(message));
          }
        } catch (e) {
          console.error('Error parsing PeerJS signal:', e);
        }
      });

      server.addEventListener('close', () => {
        if (peerId) {
          clients.delete(peerId);
        }
      });

      server.addEventListener('error', () => {
        if (peerId) {
          clients.delete(peerId);
        }
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Default status route
    return new Response('PeerJS Cloudflare Signaling Worker Active', {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  },
};