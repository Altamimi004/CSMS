require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const io = require('socket.io');
const jwt = require('jsonwebtoken');

// Route imports
const { OCPPServer } = require('./ocpp/server');
const authRoutes = require('./routes/auth');
const chargerRoutes = require('./routes/chargers');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const ocppRoutes = require('./routes/ocpp');
const { router: transactionRoutes, init: initTransactions } = require('./routes/transactions');
const routes = require('./routes');

const app = express();

// Add SSL certificate configuration
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, process.env.SSL_KEY_PATH)),
    cert: fs.readFileSync(path.join(__dirname, process.env.SSL_CERT_PATH)),
    // Add these security options
    minVersion: 'TLSv1.2',
    ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256',
    honorCipherOrder: true
};

// Create both HTTP and HTTPS servers
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

// Create HTTP server that redirects to HTTPS
const httpServer = http.createServer((req, res) => {
    const httpsUrl = `https://${req.headers.host.split(':')[0]}:${HTTPS_PORT}${req.url}`;
    res.writeHead(301, { Location: httpsUrl });
    res.end();
});

const httpsServer = https.createServer(sslOptions, app);

// Before the WebSocket server initialization, add this helper function
function parseWebSocketKey(req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const segments = url.pathname.split('/');
    return segments[segments.length - 1];
}

// Add this before the WebSocket server initialization
const debugWebSocket = (req) => {
    console.log('WebSocket Debug:', {
        url: req.url,
        method: req.method,
        headers: req.headers,
        path: req.url.split('/'),
    });
};

// Update WebSocket server to use HTTPS
const wss = new WebSocket.Server({
    noServer: true,
    handleProtocols: (protocols, req) => {
        console.log('Handling protocols:', protocols);
        // Convert Set to Array for includes check
        const protocolArray = Array.from(protocols);
        console.log('Available protocols:', protocolArray);
        
        // Vector vSECC sometimes sends protocol differently
        if (protocolArray.includes('ocpp1.6') || protocolArray.includes('ocpp-1.6')) {
            console.log('Accepting OCPP 1.6 connection');
            return 'ocpp1.6';
        }
        if (protocolArray.includes('ocpp2.0.1') || protocolArray.includes('ocpp-2.0.1')) {
            console.log('Accepting OCPP 2.0.1 connection');
            return 'ocpp2.0.1';
        }
        
        // If no protocol specified but comes from Vector, assume 1.6
        if (req.headers['user-agent']?.includes('Vector')) {
            console.log('Vector charger detected, accepting as OCPP 1.6');
            return 'ocpp1.6';
        }
        
        console.log('No supported protocol found in:', protocolArray);
        return false;
    }
});

// First, initialize Socket.IO
const ioServer = io(httpsServer, {
    cors: {
        origin: "https://localhost:3001",
        methods: ["GET", "POST"],
        credentials: true
    },
    path: '/socket.io/',
    allowUpgrades: true,
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    serveClient: true
});

// Make Socket.IO available to the app
app.set('io', ioServer);

// Initialize OCPP Server with WebSocket server and Socket.IO
const ocppServer = new OCPPServer(wss, httpsServer, ioServer);

// Make OCPP server available to routes
app.set('ocppServer', ocppServer);

// Initialize Socket.IO connection handling
ioServer.on('connection', (socket) => {
    console.log('Client connected to Socket.IO');
    socket.on('disconnect', () => {
        console.log('Client disconnected from Socket.IO');
    });
});

// Update the WebSocket upgrade handling
httpsServer.on('upgrade', (request, socket, head) => {
    try {
        const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
        
        // Handle Socket.IO upgrades
        if (pathname.startsWith('/socket.io/')) {
            return;
        }

        // Handle OCPP upgrades
        if (pathname.startsWith('/ocpp/')) {
            const protocol = request.headers['sec-websocket-protocol'];
            if (!protocol || !protocol.includes('ocpp')) {
                console.log('Invalid OCPP protocol, rejecting');
                socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                socket.destroy();
                return;
            }

            wss.handleUpgrade(request, socket, head, (ws) => {
                console.log('OCPP WebSocket connection established');
                wss.emit('connection', ws, request);
            });
            return;
        }

        // Reject other WebSocket connections
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
    } catch (error) {
        console.error('Error handling WebSocket upgrade:', error);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Create HTTP server
const server = http.createServer(app);

// Make app available globally for socket.io initialization
global.app = app;

// Initialize transactions with existing Socket.IO instance
initTransactions(ioServer);

// Routes setup
app.use('/api/auth', authRoutes);
app.use('/api/chargers', chargerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ocpp', ocppRoutes);

// UI Routes
app.get('/', (req, res) => res.render('login'));
app.get('/dashboard', (req, res) => res.render('dashboard'));
app.get('/chargers', (req, res) => res.render('chargers'));
app.get('/users', (req, res) => res.render('users'));
app.get('/ocpp', (req, res) => res.render('ocpp'));
app.get('/transactions', (req, res) => res.render('transactions'));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('Connected to MongoDB');
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

mongoose.connection.on('error', err => {
    console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});

// Listen on both ports
httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP Server running on port ${HTTP_PORT}`);
});

httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Add Socket.IO authentication middleware
ioServer.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (err) {
        next(new Error('Authentication error'));
    }
});

module.exports = { app, wss };
