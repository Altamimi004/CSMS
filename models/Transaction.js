const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    chargerId: {
        type: String,
        required: true
    },
    evseId: {
        type: Number,
        required: true
    },
    connectorId: {
        type: Number,
        required: true
    },
    idToken: {
        type: String,
        default: 'ANONYMOUS'
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: Date,
    energy: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['In Progress', 'Completed', 'Error'],
        default: 'In Progress'
    }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);