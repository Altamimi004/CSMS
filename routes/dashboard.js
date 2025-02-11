const express = require('express');
const router = express.Router();
const Charger = require('../models/Charger');
const Transaction = require('../models/Transaction');
const { isAuthenticated } = require('../middleware/auth');

// Get dashboard stats
router.get('/stats', isAuthenticated, async (req, res) => {
    try {
        // Get charger stats
        const chargers = await Charger.find();
        const chargerStats = {
            total: chargers.length,
            active: chargers.filter(c => c.status === 'Available').length,
            charging: chargers.filter(c => c.status === 'Charging').length,
            faulted: chargers.filter(c => c.status === 'Faulted').length
        };

        // Get transaction stats
        const transactions = await Transaction.find();
        const activeTransactions = transactions.filter(t => !t.endTime);
        const completedTransactions = transactions.filter(t => t.endTime);
        
        // Calculate total energy from completed transactions
        const totalEnergy = completedTransactions.reduce((sum, t) => sum + (t.energy || 0), 0);

        // Get recent transactions (last 5)
        const recentTransactions = await Transaction.find()
            .sort({ startTime: -1 })
            .limit(5)
            .populate('chargerId', 'name')
            .lean();

        const formattedTransactions = recentTransactions.map(t => ({
            charger: t.chargerId?.name || 'Unknown',
            startTime: t.startTime,
            duration: t.endTime ? Math.round((new Date(t.endTime) - new Date(t.startTime)) / 60000) : null,
            energy: t.energy || 0,
            status: t.endTime ? 'Completed' : 'In Progress'
        }));

        res.json({
            chargerStats,
            transactionStats: {
                total: transactions.length,
                active: activeTransactions.length,
                completed: completedTransactions.length,
                totalEnergy
            },
            recentTransactions: formattedTransactions
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug route
router.get('/debug', async (req, res) => {
    try {
        const chargers = await Charger.find();
        const transactions = await Transaction.find();
        
        res.json({
            chargerCount: chargers.length,
            chargers: chargers,
            transactionCount: transactions.length,
            transactions: transactions
        });
    } catch (error) {
        console.error('Dashboard debug error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Add a debug endpoint
router.get('/debug/chargers', async (req, res) => {
    try {
        const chargers = await Charger.find().lean();
        const mongoStats = await Charger.collection.stats();
        
        res.json({
            count: chargers.length,
            chargers: chargers,
            collectionStats: mongoStats
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add this debug route
router.get('/debug/transactions', async (req, res) => {
    try {
        const transactions = await Transaction.find().sort('-startTime').lean();
        res.json({
            count: transactions.length,
            transactions: transactions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to calculate duration
function calculateDuration(transaction) {
    if (!transaction.startTime) return 0;
    const end = transaction.endTime || new Date();
    const start = new Date(transaction.startTime);
    return Math.floor((end - start) / (1000 * 60)); // Duration in minutes
}

module.exports = router;