const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { isAuthenticated } = require('../middleware/auth');

// Initialize Socket.io
let io;
function init(ioServer) {
    io = ioServer;
    
    io.on('connection', (socket) => {
        console.log('Client connected to transactions namespace');
        
        socket.on('disconnect', () => {
            console.log('Client disconnected from transactions namespace');
        });
    });

    // Get the OCPP server instance and set the socket handler
    const ocppServer = global.app.get('ocppServer');
    if (ocppServer) {
        ocppServer.setSocketHandler(io);
    }

    return io;
}

// Render transactions page
router.get('/', (req, res) => {
    res.render('transactions', { title: 'Transactions' });
});

// Get all transactions API endpoint
router.get('/api', async (req, res) => {
    try {
        const transactions = await Transaction.find()
            .sort({ startTime: -1 })
            .populate('chargerId', 'name chargePointId')
            .lean();

        const formattedTransactions = transactions.map(t => ({
            transactionId: t.transactionId || 'N/A',
            charger: t.chargerId || 'Unknown',
            idTag: t.idTag || t.evseId ||'N/A',
            startTime: t.startTime,
            endTime: t.endTime,
            energy: t.energy || 0,
            status: t.status
        }));

        res.json(formattedTransactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get transaction by ID
router.get('/:id', async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('charger', 'name location');
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get transactions by charger
router.get('/charger/:chargerId', async (req, res) => {
    try {
        const transactions = await Transaction.find({ charger: req.params.chargerId })
            .populate('charger', 'name location')
            .sort('-createdAt');
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Export both router and io initialization
module.exports = { router, init };