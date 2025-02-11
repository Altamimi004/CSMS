# MongoDB Setup for CSMS

## 1. Install MongoDB Community Edition

### Windows
1. Download MongoDB Community Server from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
2. Run the installer
3. Choose "Complete" installation
4. Install MongoDB Compass (optional but recommended for database management)

### Linux (Ubuntu)
```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list

# Update package list
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org
```

## 2. Start MongoDB Service

### Windows
```bash
# MongoDB should start automatically as a Windows service
# To verify, open Services app and check "MongoDB" service status
```

### Linux
```bash
# Start MongoDB
sudo systemctl start mongod

# Enable MongoDB to start on boot
sudo systemctl enable mongod

# Check status
sudo systemctl status mongod
```

## 3. Configure MongoDB for CSMS

1. Create CSMS database and user:
```javascript
// Connect to MongoDB shell
mongosh

// Create database
use csms

// Create user with permissions
db.createUser({
  user: "csmsUser",
  pwd: "your_secure_password",
  roles: [
    { role: "readWrite", db: "csms" }
  ]
})
```

2. Update CSMS environment variables:
```env
# .env file
MONGODB_URI=mongodb://csmsUser:your_secure_password@localhost:27017/csms
```

## 4. Required Collections

The following collections will be automatically created when needed:

```javascript
// Users collection
db.createCollection("users")

// Chargers collection
db.createCollection("chargers")

// Transactions collection
db.createCollection("transactions")
```

## 5. Indexes

Set up recommended indexes for better performance:

```javascript
// Chargers indexes
db.chargers.createIndex({ "chargePointId": 1 }, { unique: true })
db.chargers.createIndex({ "status": 1 })

// Transactions indexes
db.transactions.createIndex({ "transactionId": 1 }, { unique: true })
db.transactions.createIndex({ "chargerId": 1 })
db.transactions.createIndex({ "startTime": -1 })

// Users indexes
db.users.createIndex({ "email": 1 }, { unique: true })
```

## 6. Verify Setup

1. Test connection:
```javascript
// In MongoDB shell
use csms
db.chargers.find()
```

2. Test from CSMS:
```bash
# Start CSMS application
npm start

# Check logs for successful MongoDB connection
```

## 7. MongoDB Compass (Optional)

1. Install MongoDB Compass
2. Connect using connection string:
```
mongodb://csmsUser:your_secure_password@localhost:27017/csms
```

## 8. Backup and Restore

### Backup database
```bash
mongodump --db csms --out /backup/path
```

### Restore database
```bash
mongorestore --db csms /backup/path/csms
```

## 9. Troubleshooting

### Common Issues

1. Connection Refused
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

2. Authentication Failed
```bash
# Verify credentials in .env file
# Verify user was created correctly in MongoDB
```

3. Permissions Issues
```bash
# Check MongoDB data directory permissions
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chmod -R 0755 /var/lib/mongodb
```

## 10. Security Recommendations

1. Enable Authentication:
```javascript
// /etc/mongod.conf
security:
  authorization: enabled
```

2. Limit Network Access:
```javascript
// /etc/mongod.conf
net:
  bindIp: 127.0.0.1
```

3. Regular Backups:
```bash
# Create backup script
#!/bin/bash
mongodump --db csms --out /backup/csms_$(date +%Y%m%d)
```

## 11. Monitoring

Monitor database performance:
```bash
# Check database status
mongosh --eval "db.serverStatus()"

# Monitor logs
tail -f /var/log/mongodb/mongod.log
``` 