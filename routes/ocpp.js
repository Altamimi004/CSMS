const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Charger = require('../models/Charger');

// Send OCPP command to charger
router.post('/:chargerId/:command', async (req, res) => {
    try {
        const { chargerId, command } = req.params;
        const params = req.body;
        
        // Get OCPP server instance
        const ocppServer = req.app.get('ocppServer');
        if (!ocppServer) {
            return res.status(500).json({ message: 'OCPP server not initialized' });
        }
        
        // Get charger
        const charger = ocppServer.chargers.get(chargerId);
        if (!charger) {
            return res.status(404).json({ message: 'Charger not found or not connected' });
        }
        
        // Send command and wait for response
        const response = await ocppServer.sendCommand(chargerId, command, params);
        res.json(response);
    } catch (error) {
        console.error('Error sending OCPP command:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 