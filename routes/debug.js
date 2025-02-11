const express = require('express');
const router = express.Router();
const Charger = require('../models/Charger');
const Transaction = require('../models/Transaction');

// Debug routes (only available in development)
router.get('/chargers', async (req, res) => {
    try {
        const chargers = await Charger.find().select('-__v');
        res.json({
            count: chargers.length,
            chargers: chargers.map(charger => ({
                ...charger.toObject(),
                lastHeartbeatAge: charger.lastHeartbeat ? 
                    Math.floor((new Date() - charger.lastHeartbeat) / 1000) : null
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/transactions', async (req, res) => {
    try {
        const transactions = await Transaction.find().populate('charger');
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 