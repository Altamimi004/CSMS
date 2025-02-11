const https = require('https');
const fs = require('fs');
const WebSocket = require('ws');
const OCPPServer = require('./ocpp/server');

// ... other imports ...

const options = {
    key: fs.readFileSync('path/to/your/key.pem'),
    cert: fs.readFileSync('path/to/your/cert.pem'),
    rejectUnauthorized: false,
    requestCert: false,
    secureProtocol: 'TLS_method',
    ciphers: 'ALL',
    secureOptions: require('constants').SSL_OP_NO_TLSv1 | require('constants').SSL_OP_NO_TLSv1_1
};

const server = https.createServer(options, app);

// Create WebSocket server with relaxed SSL settings
const wss = new WebSocket.Server({
    server,
    handleProtocols: (protocols, req) => {
        if (protocols.includes('ocpp1.6')) return 'ocpp1.6';
        if (protocols.includes('ocpp2.0.1')) return 'ocpp2.0.1';
        return false;
    },
    clientTracking: true,
    perMessageDeflate: false,
    verifyClient: (info, callback) => {
        // Accept all connections for testing
        callback(true);
    }
});

// Initialize OCPP server
const ocppServer = new OCPPServer(wss, server);
app.set('ocppServer', ocppServer);

// ... rest of your server setup ... 