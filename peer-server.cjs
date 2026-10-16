const { PeerServer } = require('peer');

const port = process.env.PORT || 9000;
const peerServer = PeerServer({
  port: port,
  path: '/myapp',
  allow_discovery: true
});

console.log(`PeerServer running on port ${port}`);