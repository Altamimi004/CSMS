const mongoose = require('mongoose');

const connectorSchema = new mongoose.Schema({
    connectorId: Number,
    status: {
        type: String,
        default: 'Available'
    },
    errorCode: {
        type: String,
        default: 'NoError'
    },
    lastUpdated: Date
});

const chargerSchema = new mongoose.Schema({
    chargePointId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    location: String,
    status: {
        type: String,
        default: 'Available'
    },
    protocol: {
        type: String,
        enum: ['ocpp1.6', 'ocpp2.0.1'],
        required: true
    },
    lastHeartbeat: Date,
    connectors: [connectorSchema],
    isInUse: {
        type: Boolean,
        default: false
    },
    currentTransaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Charger', chargerSchema);