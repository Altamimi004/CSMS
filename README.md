
# Charging Station Management System (CSMS)

A web-based management system for electric vehicle charging stations supporting OCPP 1.6 and 2.0.1 protocols.

## Features

- Real-time charging station monitoring
- OCPP 1.6 and 2.0.1 protocol support
- Multi-connector charger management
- Transaction tracking and history
- User authentication
- Real-time WebSocket updates
- Secure HTTPS/WSS connections

## Quick Start

### Prerequisites

- Node.js (v14+)
- MongoDB (v4.4+)
- OpenSSL

### Installation

1. Clone and install dependencies:

```bash
git clone https://github.com/yourusername/csms.git
cd csms
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

3. Create `.env` file:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/csms
JWT_SECRET=your_secret_here
```

4. Generate SSL certificates:

```bash
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
```

5. Start the server:

```bash
npm start
```

6. Access the application at `https://localhost:3001`

## Connecting Charging Stations

### OCPP Connection Details

- Endpoint: `wss://your-server:3001/ocpp/<chargePointId>`
- Supported Protocols: 
  - OCPP 1.6
  - OCPP 2.0.1

### For CHARX Control Testing

1. Configure charger settings:
   - CSMS URL: `wss://10.10.1.2:3001/ocpp/`
   - OCPP ID: `your-charger-id`
   - Protocol: `ocpp1.6`
   - SSL Verification: `None` (for testing)

2. Disable security features for testing:
   - Multiple Connection Profiles: Off
   - Basic Authentication: Off

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user

### Chargers
- `GET /api/chargers` - List chargers
- `POST /api/chargers` - Add charger
- `GET /api/chargers/:id` - Get charger
- `PUT /api/chargers/:id` - Update charger
- `DELETE /api/chargers/:id` - Delete charger

### Transactions
- `GET /api/transactions` - List transactions
- `GET /api/transactions/:id` - Get transaction

## WebSocket Events

### Client Events
- `charger_status_update` - Status updates
- `transaction_update` - Transaction changes

### OCPP Events
- `BootNotification` - Charger boot
- `Heartbeat` - Charger heartbeat
- `StatusNotification` - Status changes
- `TransactionEvent` - Transaction updates

## Development

### Project Structure

CSMS/
├── certs/              # SSL certificates
├── models/             # Database models
├── routes/             # API routes
├── middleware/         # Express middleware
├── public/            # Frontend assets
│   └── js/           # JavaScript files
├── views/             # EJS templates
└── ocpp/             # OCPP server logic
```

### Common Issues

1. Certificate Errors
   - Check certificate generation
   - Verify paths in server config
   - Ensure proper permissions

2. Connection Issues
   - Verify MongoDB is running
   - Check firewall settings
   - Confirm correct ports are open

3. OCPP Connection Failures
   - Verify WebSocket URL
   - Check protocol version
   - Disable SSL verification for testing

## Security Notes

For production:
- Replace self-signed certificates
- Enable proper SSL verification
- Secure MongoDB installation
- Use strong JWT secrets
- Enable OCPP security features



## Support

For issues and feature requests, please create an issue in the repository.