const { PeerServer } = require('peer');

const server = PeerServer({
  port: 9000,
  path: '/myapp'
});

console.log('[PeerServer] Local PeerJS signaling server running on port 9000 at path /myapp');

server.on('connection', (client) => {
  console.log(`[PeerServer] Client connected: ${client.getId()}`);
});

server.on('disconnect', (client) => {
  console.log(`[PeerServer] Client disconnected: ${client.getId()}`);
});

