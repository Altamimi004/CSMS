const { RPCServer } = require('ocpp-rpc');
const Charger = require('../models/Charger');
const Transaction = require('../models/Transaction');

class OCPPServer {
    constructor(wss, httpsServer) {
        console.log('Initializing OCPP Server');
        this.chargers = new Map();
        this.chargePoints = new Map(); // Add this line to store socket handlers
        this.server = new RPCServer({
            protocols: ['ocpp1.6', 'ocpp2.0.1'],
            handler: this.handleOCPPRequest.bind(this)
        });
        this.socketIo = null; // Add this line
        this.pendingRequests = new Map();
        this.messageHandlers = new Map();
        this.transactionIds = new Set();
        this.currentTransactionId = 1;

        wss.on('connection', async (ws, req) => {
            const chargePointId = req.url.split('/').filter(Boolean).pop();
            this.currentChargePointId = chargePointId; // Add this line
            console.log('New OCPP connection details:', {
                chargePointId,
                protocol: ws.protocol,
                headers: req.headers,
                url: req.url,
                isSecure: req.socket.encrypted,
                remoteAddress: req.socket.remoteAddress,
                userAgent: req.headers['user-agent']
            });

            // Accept any protocol version (1.6 or 2.0.1)
            if (!ws.protocol) {
                console.warn(`No protocol specified for ${chargePointId}, defaulting to OCPP1.6`);
                ws.protocol = 'ocpp1.6';
            }

            try {
                let charger = await Charger.findOne({ chargePointId });
                if (!charger) {
                    charger = new Charger({
                        chargePointId,
                        name: `Charger ${chargePointId}`,
                        location: 'Unknown',
                        status: 'Available',
                        lastHeartbeat: new Date(),
                        protocol: ws.protocol,
                        connectors: [{ 
                            connectorId: 1,
                            status: 'Available',
                            errorCode: 'NoError',
                            lastUpdated: new Date()
                        }]
                    });
                    await charger.save();
                }

                this.chargers.set(chargePointId, {
                    ws,
                    protocol: ws.protocol,
                    status: charger.status,
                    lastHeartbeat: new Date()
                });

                ws.on('message', (message) => {
                    console.log(`Received ${ws.protocol} message from ${chargePointId}:`, message.toString());
                    try {
                        const data = JSON.parse(message);
                        if (ws.protocol === 'ocpp2.0.1') {
                            this.handleOCPP201Message(chargePointId, data);
                            
                        } else {
                            this.handleOCPP16Message(chargePointId, data);
                        }
                    } catch (error) {
                        console.error('Message handling error:', error);
                    }
                });

                ws.on('close', () => {
                    console.log(`${ws.protocol} connection closed for ${chargePointId}`);
                    this.chargers.delete(chargePointId);
                });

                ws.on('error', (error) => {
                    console.error(`WebSocket error for ${chargePointId}:`, error);
                    // Add proper error recovery
                });

            } catch (error) {
                console.error('Error in connection handler:', error);
                ws.close(1011, 'Internal server error');
            }
        });

        // Add error handler
        wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
            // Add error monitoring/metrics
        });
    }

    // Update the socket handler methods
    setSocketHandler(io) {
        this.socketIo = io;
    }

    emitChargerStatusUpdate(chargerId, connectorId, status, errorCode) {
        const socketHandler = this.getSocketHandler();
        if (socketHandler) {
            socketHandler.emit('chargerUpdate', {
                chargerId,
                connectorId,
                status,
                errorCode
            });
        }
    }

    async handleMessage(chargePointId, message) {
        try {
            const data = JSON.parse(message);
            const charger = this.chargers.get(chargePointId);
            
            if (charger.protocol === 'ocpp2.0.1') {
                await this.handleOCPP201Message(chargePointId, data);
            } else {
                await this.handleOCPP16Message(chargePointId, data);
            }
        } catch (error) {
            console.error('Message handling error:', error);
        }
    }

    async handleOCPP201Message(chargePointId, [messageTypeId, messageId, action, payload]) {
        const ws = this.chargers.get(chargePointId).ws;
        console.log('OCPP 2.0.1 message:', { 
            chargePointId,
            messageTypeId, 
            messageId, 
            action, 
            payload 
        });

        try {
            if (messageTypeId === 2) { // CALL
                switch(action) {
                    case 'GetConfiguration':
                        const response = {
                            configurationKey: [
                                {
                                    key: "AuthorizationCacheEnabled",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "AuthorizeRemoteTxRequests",
                                    readonly: false,
                                    value: "false"
                                },
                                {
                                    key: "ClockAlignedDataInterval",
                                    readonly: false,
                                    value: "0"
                                },
                                {
                                    key: "ConnectionTimeOut",
                                    readonly: false,
                                    value: "60"
                                },
                                {
                                    key: "GetConfigurationMaxKeys",
                                    readonly: true,
                                    value: "50"
                                },
                                {
                                    key: "HeartbeatInterval",
                                    readonly: false,
                                    value: "300"
                                },
                                {
                                    key: "LocalAuthorizeOffline",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "LocalPreAuthorize",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "MeterValuesAlignedData",
                                    readonly: false,
                                    value: "Power.Active.Import"
                                },
                                {
                                    key: "MeterValuesSampledData",
                                    readonly: false,
                                    value: "Energy.Active.Import.Register"
                                },
                                {
                                    key: "MeterValueSampleInterval",
                                    readonly: false,
                                    value: "60"
                                },
                                {
                                    key: "NumberOfConnectors",
                                    readonly: true,
                                    value: "1"
                                },
                                {
                                    key: "ResetRetries",
                                    readonly: false,
                                    value: "3"
                                },
                                {
                                    key: "StopTransactionOnEVSideDisconnect",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "StopTransactionOnInvalidId",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "StopTxnAlignedData",
                                    readonly: false,
                                    value: "Energy.Active.Import.Register"
                                },
                                {
                                    key: "StopTxnSampledData",
                                    readonly: false,
                                    value: "Energy.Active.Import.Register"
                                },
                                {
                                    key: "SupportedFeatureProfiles",
                                    readonly: true,
                                    value: "Core,FirmwareManagement,LocalAuthList,SmartCharging,Reservation"
                                },
                                {
                                    key: "TransactionMessageAttempts",
                                    readonly: false,
                                    value: "3"
                                },
                                {
                                    key: "TransactionMessageRetryInterval",
                                    readonly: false,
                                    value: "60"
                                },
                                {
                                    key: "UnlockConnectorOnEVSideDisconnect",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "WebSocketPingInterval",
                                    readonly: false,
                                    value: "60"
                                }
                            ],
                            unknownKey: []
                        };
                        ws.send(JSON.stringify([3, messageId, response]));
                        break;

                    case 'Heartbeat':
                        // Update the last heartbeat time for the charger
                        const charger = await Charger.findOne({ chargePointId });
                        if (charger) {
                            charger.lastHeartbeat = new Date();
                            await charger.save();
                            console.log(`Charger ${chargePointId} heartbeat received and updated.`);
                            
                            // Update to use direct emit method
                            this.emitChargerStatusUpdate(chargePointId, 0, charger.status, null);
                        }
                        ws.send(JSON.stringify([3, messageId, {}])); // Acknowledge the heartbeat
                        break;

                    case 'BootNotification':
                        ws.send(JSON.stringify([3, messageId, {
                            currentTime: new Date().toISOString(),
                            interval: 300,
                            status: 'Accepted',
                            statusInfo: {
                                reasonCode: 'OK',
                                additionalInfo: ''
                            }
                        }]));
                        break;

                    case 'StatusNotification':
                        ws.send(JSON.stringify([3, messageId, {}]));
                        break;

                    case 'RemoteStartTransaction':
                        ws.send(JSON.stringify([3, messageId, {
                            status: "Accepted",
                            statusInfo: {
                                reasonCode: "OK",
                                additionalInfo: ""
                            }
                        }]));
                        break;

                    case 'RemoteStopTransaction':
                        ws.send(JSON.stringify([3, messageId, {
                            status: "Accepted",
                            statusInfo: {
                                reasonCode: "OK",
                                additionalInfo: ""
                            }
                        }]));
                        break;

                    case 'Authorize':
                        // Authorize the charging session
                        ws.send(JSON.stringify([3, messageId, {
                            idTokenInfo: {
                                status: "Accepted"
                            }
                        }]));

                        // Start transaction after authorization using correct OCPP 2.0.1 format
                        const startTransactionRequest = {
                            idToken: payload.idToken,
                            remoteStartId: Date.now(),
                            // Updated EVSE format
                            "evse": {
                                "connectorId": 1,
                                "id": 2
                            }
                        };

                        // Send RemoteStartTransaction request
                        const startMsgId = Date.now().toString();
                        ws.send(JSON.stringify([2, startMsgId, "RemoteStartTransaction", startTransactionRequest]));
                        break;

                    case 'ChangeConfiguration':
                        if (!payload || !payload.key || !payload.value) {
                            ws.send(JSON.stringify([4, messageId, "FormationViolation", {
                                reasonCode: "PayloadFormatError",
                                additionalInfo: "Missing required fields"
                            }]));
                            return;
                        }
                        // Store configuration change
                        await Charger.findOneAndUpdate(
                            { chargePointId },
                            { $set: { [`configuration.${payload.key}`]: payload.value } }
                        );
                        ws.send(JSON.stringify([3, messageId, {
                            status: "Accepted",
                            statusInfo: {
                                reasonCode: "OK",
                                additionalInfo: ""
                            }
                        }]));
                        break;

                    case 'Reset':
                        // OCPP 2.0.1 expects lowercase type
                        if (!payload || !payload.type || !['soft', 'hard'].includes(payload.type.toLowerCase())) {
                            ws.send(JSON.stringify([4, messageId, "FormationViolation", {
                                reasonCode: "PayloadFormatError",
                                additionalInfo: "Invalid reset type. Must be 'soft' or 'hard'"
                            }]));
                            return;
                        }
                        ws.send(JSON.stringify([3, messageId, {
                            status: "Accepted",
                            statusInfo: {
                                reasonCode: "OK",
                                additionalInfo: ""
                            }
                        }]));
                        break;

                    case 'StartTransaction':
                        const transaction = new Transaction({
                            transactionId: Date.now().toString(),
                            chargerId: chargePointId,
                            idTag: payload.idTag,
                            startTime: new Date(),
                            status: 'In Progress'
                        });
                        await transaction.save();
                        ws.send(JSON.stringify([3, messageId, {
                            transactionId: transaction.transactionId,
                            idTagInfo: { status: "Accepted" }
                        }]));
                        break;

                    case 'StopTransaction':
                        const transactionToUpdate = await Transaction.findOneAndUpdate(
                            { transactionId: payload.transactionId },
                            { endTime: new Date(), status: 'Completed', energy: payload.energy },
                            { new: true }
                        );
                        ws.send(JSON.stringify([3, messageId, {
                            idTagInfo: { status: "Accepted" }
                        }]));
                        break;

                    case 'UnlockConnector':
                        if (!payload || !payload.connectorId) {
                            ws.send(JSON.stringify([4, messageId, "FormationViolation", {
                                reasonCode: "PayloadFormatError",
                                additionalInfo: "Missing required field: connectorId"
                            }]));
                            return;
                        }
                        ws.send(JSON.stringify([3, messageId, {
                            status: "Accepted",
                            statusInfo: {
                                reasonCode: "OK",
                                additionalInfo: ""
                            }
                        }]));
                        break;

                    case 'NotifyEvent':
                        // Handle NotifyEvent
                        await this.handleNotifyEvent(payload);
                        ws.send(JSON.stringify([3, messageId, { status: "Accepted" }]));
                        break;

                    case 'TransactionEvent':
                        // Handle TransactionEvent
                        await this.handleTransactionEvent(payload);
                        ws.send(JSON.stringify([3, messageId, { status: "Accepted" }]));
                        break;

                    default:
                        console.log('Unhandled OCPP 2.0.1 message:', action);
                        ws.send(JSON.stringify([4, messageId, "NotImplemented", {
                            reasonCode: "OperationNotSupported",
                            additionalInfo: "This action is not supported"
                        }]));
                }
            }
            // If this is a CALLRESULT (messageTypeId === 3)
            else if (messageTypeId === 3) {
                console.log('Received CALLRESULT for message:', messageId);
            }
            // If this is a CALLERROR (messageTypeId === 4)
            else if (messageTypeId === 4) {
                console.error('Received CALLERROR for message:', messageId);
            }

        } catch (error) {
            console.error('OCPP 2.0.1 error:', error);
            ws.send(JSON.stringify([4, messageId, "InternalError", {
                reasonCode: "GenericError",
                additionalInfo: error.message
            }]));
        }
    }

    async handleOCPPRequest(client, command, payload) {
        console.log(`Received ${command} from ${client.id}:`, payload);

        switch (command) {
            case 'BootNotification':
                return this.handleBootNotification(payload);
            case 'Heartbeat':
                return this.handleHeartbeat();
            case 'StatusNotification':
                return this.handleStatusNotification(client.id, payload);
            case 'Authorize':
                return this.handleAuthorize(payload);
            case 'StartTransaction':
                return this.handleStartTransaction(client.id, payload);
            case 'StopTransaction':
                return this.handleStopTransaction(client.id, payload);
            default:
                console.warn(`Unhandled command: ${command}`);
                return { status: 'Rejected' };
        }
    }

    async handleBootNotification(payload) {
        return {
            status: 'Accepted',
            currentTime: new Date().toISOString(),
            interval: 300
        };
    }

    async handleHeartbeat() {
        return {
            currentTime: new Date().toISOString()
        };
    }

    async handleStatusNotification(chargerId, payload) {
        // Update charger status in database
        return {};
    }

    async handleAuthorize(payload) {
        // Implement authorization logic
        return {
            idTagInfo: {
                status: 'Accepted'
            }
        };
    }

    async handleStartTransaction(chargerId, payload) {
        // Implement transaction start logic
        return {
            transactionId: Date.now(),
            idTagInfo: {
                status: 'Accepted'
            }
        };
    }

    async handleStopTransaction(chargerId, payload) {
        // Implement transaction stop logic
        return {
            idTagInfo: {
                status: 'Accepted'
            }
        };
    }

    // Helper method to get charger status
    getChargerStatus(chargePointId) {
        const charger = this.chargers.get(chargePointId);
        if (!charger) return null;

        return {
            id: chargePointId,
            status: charger.status,
            lastHeartbeat: charger.lastHeartbeat,
            connectors: Array.from(charger.connectors.entries()).map(([id, data]) => ({
                id,
                ...data
            }))
        };
    }

    // Helper method to get all chargers
    getAllChargers() {
        return Array.from(this.chargers.keys()).map(id => this.getChargerStatus(id));
    }

    async handleOCPP16Message(chargePointId, [messageTypeId, messageId, action, payload]) {
        const ws = this.chargers.get(chargePointId).ws;
        console.log('OCPP 1.6 message:', { 
            chargePointId,
            messageTypeId, 
            messageId, 
            action, 
            payload 
        });

        try {
            if (messageTypeId === 2) { // CALL
                switch(action) {
                    case 'GetConfiguration':
                        // Vector vSECC specific format
                        const response = {
                            configurationKey: [
                                {
                                    key: "AuthorizationCacheEnabled",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "AuthorizeRemoteTxRequests",
                                    readonly: false,
                                    value: "false"
                                },
                                {
                                    key: "ClockAlignedDataInterval",
                                    readonly: false,
                                    value: "0"
                                },
                                {
                                    key: "ConnectionTimeOut",
                                    readonly: false,
                                    value: "60"
                                },
                                {
                                    key: "GetConfigurationMaxKeys",
                                    readonly: true,
                                    value: "50"
                                },
                                {
                                    key: "HeartbeatInterval",
                                    readonly: false,
                                    value: "300"
                                },
                                {
                                    key: "LocalAuthorizeOffline",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "LocalPreAuthorize",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "MeterValuesAlignedData",
                                    readonly: false,
                                    value: "Power.Active.Import"
                                },
                                {
                                    key: "MeterValuesSampledData",
                                    readonly: false,
                                    value: "Energy.Active.Import.Register"
                                },
                                {
                                    key: "MeterValueSampleInterval",
                                    readonly: false,
                                    value: "60"
                                },
                                {
                                    key: "NumberOfConnectors",
                                    readonly: true,
                                    value: "1"
                                },
                                {
                                    key: "ResetRetries",
                                    readonly: false,
                                    value: "3"
                                },
                                {
                                    key: "StopTransactionOnEVSideDisconnect",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "StopTransactionOnInvalidId",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "StopTxnAlignedData",
                                    readonly: false,
                                    value: "Energy.Active.Import.Register"
                                },
                                {
                                    key: "StopTxnSampledData",
                                    readonly: false,
                                    value: "Energy.Active.Import.Register"
                                },
                                {
                                    key: "SupportedFeatureProfiles",
                                    readonly: true,
                                    value: "Core,FirmwareManagement,LocalAuthList,SmartCharging"
                                },
                                {
                                    key: "TransactionMessageAttempts",
                                    readonly: false,
                                    value: "3"
                                },
                                {
                                    key: "TransactionMessageRetryInterval",
                                    readonly: false,
                                    value: "60"
                                },
                                {
                                    key: "UnlockConnectorOnEVSideDisconnect",
                                    readonly: false,
                                    value: "true"
                                },
                                {
                                    key: "WebSocketPingInterval",
                                    readonly: false,
                                    value: "60"
                                }
                            ],
                            unknownKey: []
                        };
                        ws.send(JSON.stringify([3, messageId, response]));
                        break;

                    case 'Heartbeat':
                        ws.send(JSON.stringify([3, messageId, {
                            currentTime: new Date().toISOString()
                        }]));
                        break;

                    case 'BootNotification':
                        ws.send(JSON.stringify([3, messageId, {
                            status: "Accepted",
                            currentTime: new Date().toISOString(),
                            interval: 300
                        }]));
                        break;

                    case 'StatusNotification':
                        ws.send(JSON.stringify([3, messageId, {}]));
                        break;

                    case 'ChangeConfiguration':
                        if (!payload || !payload.key || !payload.value) {
                            ws.send(JSON.stringify([4, messageId, "FormationViolation", "Missing required fields", {}]));
                            return;
                        }
                        // Store configuration change
                        await Charger.findOneAndUpdate(
                            { chargePointId },
                            { $set: { [`configuration.${payload.key}`]: payload.value } }
                        );
                        ws.send(JSON.stringify([3, messageId, {
                            status: "Accepted"
                        }]));
                        break;

                    case 'Reset':
                        // Vector vSECC expects lowercase type
                        if (!payload || !payload.type || !['soft', 'hard'].includes(payload.type.toLowerCase())) {
                            ws.send(JSON.stringify([4, messageId, "FormationViolation", "Invalid reset type", {}]));
                            return;
                        }
                        ws.send(JSON.stringify([3, messageId, {
                            status: "Accepted"
                        }]));
                        break;

                    case 'StartTransaction':
                        const transaction = new Transaction({
                            transactionId: Date.now().toString(),
                            chargerId: chargePointId,
                            idTag: payload.idTag,
                            startTime: new Date(),
                            status: 'In Progress'
                        });
                        await transaction.save();
                        ws.send(JSON.stringify([3, messageId, {
                            transactionId: transaction.transactionId,
                            idTagInfo: { status: "Accepted" }
                        }]));
                        break;

                    case 'StopTransaction':
                        const transactionToUpdate = await Transaction.findOneAndUpdate(
                            { transactionId: payload.transactionId },
                            { endTime: new Date(), status: 'Completed', energy: payload.energy },
                            { new: true }
                        );
                        ws.send(JSON.stringify([3, messageId, {
                            idTagInfo: { status: "Accepted" }
                        }]));
                        break;

                    case 'UnlockConnector':
                        if (!payload || !payload.connectorId) {
                            ws.send(JSON.stringify([4, messageId, "FormationViolation", "Missing required field: connectorId", {}]));
                            return;
                        }
                        ws.send(JSON.stringify([3, messageId, {
                            status: "Accepted"
                        }]));
                        break;

                    default:
                        console.log('Unhandled OCPP 1.6 message:', action);
                        ws.send(JSON.stringify([4, messageId, "NotImplemented", "Requested action is not known by receiver", {}]));
                }
            }
            // If this is a CALLRESULT (messageTypeId === 3)
            else if (messageTypeId === 3) {
                console.log('Received CALLRESULT for message:', messageId);
            }
            // If this is a CALLERROR (messageTypeId === 4)
            else if (messageTypeId === 4) {
                console.error('Received CALLERROR for message:', messageId);
            }

        } catch (error) {
            console.error('OCPP 1.6 error:', error);
            ws.send(JSON.stringify([4, messageId, "InternalError", error.message, {}]));
        }
    }

    async sendCommand(chargePointId, command, params) {
        const charger = this.chargers.get(chargePointId);
        if (!charger) {
            throw new Error('Charger not found or not connected');
        }

        // Format parameters based on command
        let formattedParams = { ...params };
        
        switch (command) {
            case 'Reset':
                formattedParams = {
                    type: params.type.toLowerCase() // Ensure type is lowercase
                };
                break;
            case 'UnlockConnector':
                formattedParams = {
                    connectorId: parseInt(params.connectorId) || 1
                };
                break;
            // Add other command-specific formatting as needed
        }

        const messageId = Date.now().toString();
        const message = [2, messageId, command, formattedParams];

        return new Promise((resolve, reject) => {
            try {
                // Set up response handler
                const responseHandler = (data) => {
                    try {
                        const [messageTypeId, responseId, payload] = JSON.parse(data);
                        if (responseId === messageId) {
                            charger.ws.removeListener('message', responseHandler);
                            resolve(payload);
                        }
                    } catch (error) {
                        console.error('Error parsing response:', error);
                    }
                };

                charger.ws.on('message', responseHandler);
                
                // Send command
                charger.ws.send(JSON.stringify(message));
                
                // Set timeout
                setTimeout(() => {
                    charger.ws.removeListener('message', responseHandler);
                    reject(new Error('Command timeout'));
                }, 30000);
            } catch (error) {
                reject(error);
            }
        });
    }

    // New method to handle NotifyEvent
    async handleNotifyEvent(payload) {
        const { eventData, generatedAt } = payload;

        for (const event of eventData) {
            const { actualValue, component, eventId, eventNotificationType, variable } = event;

            // Log the event for debugging
            console.log(`Received NotifyEvent: ${eventId}, Type: ${eventNotificationType}, Value: ${actualValue}`);

            try {
                // Use the websocket connection ID instead of EVSE ID
                const charger = await Charger.findOne({ 
                    chargePointId: this.currentChargePointId // We'll add this in constructor
                });

                if (charger) {
                    // Store EVSE status in charger's connectors array
                    const connectorStatus = {
                        connectorId: component.evse.connectorId,
                        evseId: component.evse.id,
                        status: actualValue,
                        lastUpdated: new Date()
                    };

                    // Update charger status
                    await Charger.findOneAndUpdate(
                        { chargePointId: this.currentChargePointId },
                        { 
                            $set: {
                                status: actualValue === "Occupied" ? "Charging" : "Available",
                                isInUse: actualValue === "Occupied",
                                [`connectors.${component.evse.id-1}`]: connectorStatus
                            },
                            lastHeartbeat: new Date()
                        }
                    );

                    console.log(`Charger ${this.currentChargePointId} EVSE ${component.evse.id} status updated to ${actualValue}`);
                } else {
                    console.warn(`Charger ${this.currentChargePointId} not found`);
                }
            } catch (error) {
                console.error('Error handling NotifyEvent:', error);
            }
        }
    }

    async handleTransactionEvent(payload) {
        const { eventType, evse, idToken, transactionInfo } = payload;
        console.log(`Received TransactionEvent: ${eventType}, EVSE ID: ${evse.id}`);

        try {
            const chargerId = this.currentChargePointId;

            if (eventType === 'Started') {
                // Create new transaction
                const transaction = new Transaction({
                    transactionId: transactionInfo.transactionId,
                    chargerId: chargerId,
                    evseId: evse.id,
                    connectorId: evse.connectorId,
                    idToken: idToken?.idToken || 'ANONYMOUS',
                    startTime: new Date(payload.timestamp),
                    status: 'In Progress',
                    energy: 0
                });
                
                const savedTransaction = await transaction.save();
                console.log(`Transaction started: ${savedTransaction.transactionId}`);

                // Update charger status
                await Charger.findOneAndUpdate(
                    { chargePointId: chargerId },
                    { 
                        status: 'Charging',
                        isInUse: true,
                        currentTransaction: savedTransaction._id
                    }
                );

                // Emit socket event if socket handler exists
                if (this.socketIo) {
                    this.socketIo.emit('transactionUpdate', {
                        type: 'Started',
                        transaction: savedTransaction
                    });
                }
            } else if (eventType === 'Ended') {
                // Update transaction
                const updatedTransaction = await Transaction.findOneAndUpdate(
                    { transactionId: transactionInfo.transactionId },
                    { 
                        endTime: new Date(payload.timestamp), 
                        status: 'Completed',
                        energy: transactionInfo.energy || 0
                    },
                    { new: true }
                );

                console.log(`Transaction ended: ${transactionInfo.transactionId}`);

                // Update charger status
                await Charger.findOneAndUpdate(
                    { chargePointId: chargerId },
                    { 
                        status: 'Available',
                        isInUse: false,
                        currentTransaction: null
                    }
                );

                // Emit socket event if socket handler exists
                if (this.socketIo) {
                    this.socketIo.emit('transactionUpdate', {
                        type: 'Ended',
                        transaction: updatedTransaction
                    });
                }
            }
        } catch (error) {
            console.error('Error handling transaction event:', error);
        }
    }

    async updateChargerStatus(chargerId, connectorId, status, errorCode) {
        try {
            // Find the charger
            const charger = await Charger.findOne({ chargePointId: chargerId });
            if (!charger) {
                console.error(`Charger ${chargerId} not found`);
                return;
            }

            // Update the specific connector
            if (connectorId > 0) {
                // Ensure connectors array exists and has enough elements
                while (charger.connectors.length < connectorId) {
                    charger.connectors.push({
                        connectorId: charger.connectors.length + 1,
                        status: 'Available',
                        errorCode: 'NoError',
                        lastUpdated: new Date()
                    });
                }

                // Update the specific connector
                const connectorIndex = connectorId - 1;
                charger.connectors[connectorIndex] = {
                    ...charger.connectors[connectorIndex],
                    connectorId,
                    status,
                    errorCode: errorCode || 'NoError',
                    lastUpdated: new Date()
                };
            }

            // Update overall charger status if needed
            if (status === 'Faulted' || errorCode !== 'NoError') {
                charger.status = 'Faulted';
            } else {
                // Update overall status based on connector statuses
                const allConnectorStatuses = charger.connectors.map(c => c.status);
                if (allConnectorStatuses.includes('Charging')) {
                    charger.status = 'Charging';
                } else if (allConnectorStatuses.includes('Preparing')) {
                    charger.status = 'Preparing';
                } else if (allConnectorStatuses.every(s => s === 'Available')) {
                    charger.status = 'Available';
                }
            }

            await charger.save();

            // Emit the update through Socket.IO
            this.emitChargerStatusUpdate(chargerId, connectorId, status, errorCode);

        } catch (error) {
            console.error('Error updating charger status:', error);
        }
    }

    getSocketHandler(chargePointId) {
        return this.chargePoints.get(chargePointId);
    }

    async sendRemoteStartTransaction(chargePointId, evseId) {
        const charger = this.chargers.get(chargePointId);
        if (!charger) {
            throw new Error('Charger not connected');
        }

        const messageId = Date.now().toString();
        // Updated OCPP 2.0.1 RemoteStartRequest format
        const request = {
            "idToken": {
                "idToken": "REMOTE_START_TOKEN",
                "type": "Central"
            },
            "remoteStartId": parseInt(messageId),
            "chargingProfile": {
                "id": 1,
                "stackLevel": 0,
                "chargingProfilePurpose": "TxProfile",
                "chargingProfileKind": "Absolute",
                "chargingSchedule": {
                    "id": 1,
                    "startSchedule": new Date().toISOString(),
                    "duration": 3600,
                    "chargingRateUnit": "W",
                    "chargingSchedulePeriod": [
                        {
                            "startPeriod": 0,
                            "limit": 11000,
                            "numberPhases": 3
                        }
                    ]
                }
            }
        };

        // Only add evse if evseId is provided
        if (evseId) {
            request.evse = {
                "id": parseInt(evseId),
                "connectorId": 1
            };
        }

        try {
            console.log('Sending RemoteStartTransaction request:', JSON.stringify(request, null, 2));
            const result = await this.sendCommand(chargePointId, "RemoteStartTransaction", request);
            console.log('RemoteStartTransaction response:', result);
            return true;
        } catch (error) {
            console.error('Remote start failed:', error);
            return false;
        }
    }

    // Add this method to help with debugging
    logChargerState(chargePointId) {
        const charger = this.chargers.get(chargePointId);
        console.log('Current charger state:', {
            chargePointId,
            connected: !!charger,
            protocol: charger?.protocol,
            status: charger?.status,
            isInUse: charger?.isInUse,
            lastHeartbeat: charger?.lastHeartbeat
        });
    }

    handleOCPP201CallResult(chargePointId, messageId, payload) {
        console.log(`Received OCPP 2.0.1 CallResult from ${chargePointId}:`, payload);
    }

    handleOCPP201CallError(chargePointId, messageId, payload) {
        console.error(`Received OCPP 2.0.1 CallError from ${chargePointId}:`, payload);
    }

    async handleOCPP201Call(chargePointId, messageId, action, payload, ws) {
        console.log(`Received OCPP 2.0.1 Call from ${chargePointId}:`, action, payload);
        
        try {
            switch(action) {
                case 'Authorize':
                    ws.send(JSON.stringify([3, messageId, {
                        idTokenInfo: {
                            status: "Accepted",
                            roamingRestriction: "Accepted"
                        }
                    }]));

                    // Wait a bit before sending the start request
                    setTimeout(async () => {
                        try {
                            await this.sendRemoteStartTransaction(chargePointId);
                        } catch (error) {
                            console.error('Error sending remote start:', error);
                        }
                    }, 1000);
                    break;

                // ...existing cases...
            }
        } catch (error) {
            console.error('Error handling OCPP 2.0.1 call:', error);
            ws.send(JSON.stringify([4, messageId, "InternalError", {
                reasonCode: "GenericError",
                additionalInfo: error.message
            }]));
        }
    }
}

module.exports = { OCPPServer };