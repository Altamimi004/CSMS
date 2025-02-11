const jwt = require('jsonwebtoken');
const User = require('../models/User');

class SocketHandler {
    constructor(io) {
        this.io = io;
        this.setupMiddleware();
        this.setupEventHandlers();
    }

    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Authentication error'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);
                
                if (!user) {
                    return next(new Error('Authentication error'));
                }

                socket.user = user;
                next();
            } catch (error) {
                next(new Error('Authentication error'));
            }
        });
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.user.username}`);

            socket.on('disconnect', () => {
                console.log(`User disconnected: ${socket.user.username}`);
            });
        });
    }

    // Emit events to all connected clients
    emitChargerStatusUpdate(chargerId, status) {
        this.io.emit('charger_status_update', { chargerId, status });
    }

    emitNewTransaction(transaction) {
        this.io.emit('new_transaction', transaction);
    }

    emitTransactionEvent(transactionId, eventType) {
        this.io.emit('transaction_event', { transactionId, eventType });
    }
}

module.exports = SocketHandler; 