const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Charger = require('../models/Charger');
const { isAuthenticated } = require('../middleware/auth');

// Get all chargers
router.get('/', async (req, res) => {
    try {
        console.log('Fetching all chargers...');
        const chargers = await Charger.find()
            .sort({ createdAt: -1 })
            .lean();

        console.log('Found chargers:', chargers);

        // Transform the data to include additional info
        const formattedChargers = chargers.map(charger => ({
            _id: charger._id,
            name: charger.name || `Charger ${charger.chargePointId}`,
            chargePointId: charger.chargePointId,
            location: charger.location || 'Not specified',
            status: charger.status || 'Unknown',
            protocol: charger.protocol,
            lastHeartbeat: charger.lastHeartbeat,
            connectors: charger.connectors || [],
            isInUse: charger.isInUse || false,
            currentTransaction: charger.currentTransaction
        }));

        res.json(formattedChargers);
    } catch (error) {
        console.error('Error fetching chargers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug route - Must be before /:id route
router.get('/debug', async (req, res) => {
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

// Get single charger
router.get('/:id', async (req, res) => {
    try {
        const charger = await Charger.findById(req.params.id);
        if (!charger) {
            return res.status(404).json({ message: 'Charger not found' });
        }
        res.json(charger);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add new charger
router.post('/', isAuthenticated, [
    body('chargePointId').trim().escape().notEmpty(),
    body('name').trim().escape().notEmpty(),
    body('location').trim().escape().optional(),
    body('protocol').isIn(['ocpp1.6', 'ocpp2.0.1'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Check if charger already exists
        let existingCharger = await Charger.findOne({ chargePointId: req.body.chargePointId });
        if (existingCharger) {
            return res.status(400).json({ message: 'Charger with this ID already exists' });
        }

        // Create new charger with default connectors
        const charger = new Charger({
            chargePointId: req.body.chargePointId,
            name: req.body.name,
            location: req.body.location,
            protocol: req.body.protocol,
            status: 'Available',
            lastHeartbeat: null,
            connectors: [
                {
                    connectorId: 1,
                    status: 'Available',
                    errorCode: 'NoError',
                    lastUpdated: new Date()
                },
                {
                    connectorId: 2,
                    status: 'Available',
                    errorCode: 'NoError',
                    lastUpdated: new Date()
                },
                {
                    connectorId: 3,
                    status: 'Available',
                    errorCode: 'NoError',
                    lastUpdated: new Date()
                }
            ],
            isInUse: false,
            currentTransaction: null
        });

        const savedCharger = await charger.save();
        console.log('New charger created:', savedCharger);
        res.status(201).json(savedCharger);
    } catch (error) {
        console.error('Error adding charger:', error);
        res.status(500).json({ message: error.message });
    }
});

// Update charger
router.put('/:id', async (req, res) => {
    try {
        const charger = await Charger.findById(req.params.id);
        if (!charger) {
            return res.status(404).json({ message: 'Charger not found' });
        }

        if (req.body.name) charger.name = req.body.name;
        if (req.body.location) charger.location = req.body.location;

        await charger.save();
        res.json(charger);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete charger
router.delete('/:id', async (req, res) => {
    try {
        const charger = await Charger.findById(req.params.id);
        if (!charger) {
            return res.status(404).json({ message: 'Charger not found' });
        }

        await charger.remove();
        res.json({ message: 'Charger deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add this route to help debug charger connections
router.get('/connection-test/:chargerId', async (req, res) => {
    try {
        const { chargerId } = req.params;
        const wsUrl = `wss://10.10.1.2:3001/ocpp/`;
        
        res.json({
            message: 'Use these settings on your charger:',
            settings: {
                websocket_endpoint: wsUrl,
                protocols: ['ocpp1.6'],
                required_headers: {
                    'Sec-WebSocket-Protocol': 'ocpp1.6'
                }
            },
            notes: [
                'In Vector vSECC:',
                '1. Set CSMS URL to: wss://10.10.1.2:3001/ocpp/',
                '2. Set OCPP ID to: vectorTest2',
                '3. Select OCPP 1.6',
                '4. Disable "Multiple Connection Profiles"',
                '5. Disable "Basic Authentication"'
            ]
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add test endpoint
router.get('/test-connection', (req, res) => {
    const testUrl = `wss://10.10.1.2:3001/ocpp/`;
    const wscat = `wscat -c "${testUrl}vectorTest2" -s "ocpp1.6" --no-check`;
    
    const bootNotification = [2, "test-1", "BootNotification", {
        chargePointVendor: "Vector",
        chargePointModel: "vSECC",
        chargePointSerialNumber: "vectorTest2",
        firmwareVersion: "1.0.0"
    }];

    res.json({
        testCommands: {
            connect: wscat,
            bootNotification: JSON.stringify(bootNotification)
        },
        vectorConfig: {
            csmsUrl: testUrl,
            ocppId: "vectorTest2",
            protocol: "ocpp1.6",
            security: "Profile 0",
            multipleProfiles: false,
            basicAuth: false
        }
    });
});

// Add endpoint to get charger usage status
router.get('/status/:chargerId', async (req, res) => {
    try {
        const charger = await Charger.findOne({ chargePointId: req.params.chargerId })
            .populate('currentTransaction');
        
        if (!charger) {
            return res.status(404).json({ message: 'Charger not found' });
        }

        res.json({
            chargerId: charger.chargePointId,
            status: charger.status,
            isInUse: charger.isInUse,
            currentTransaction: charger.currentTransaction,
            lastHeartbeat: charger.lastHeartbeat
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add route to start charging
router.post('/:chargerId/start', async (req, res) => {
    try {
        const { chargerId } = req.params;
        const { evseId } = req.body;

        const ocppServer = req.app.get('ocppServer');
        const result = await ocppServer.sendRemoteStartTransaction(chargerId, evseId || 2);

        if (result) {
            res.json({ message: 'Start command sent successfully' });
        } else {
            res.status(500).json({ message: 'Failed to start charging' });
        }
    } catch (error) {
        console.error('Error starting charge:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;