# Running CSMS on Linux

## 1. System Requirements

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required dependencies
sudo apt install -y git nodejs npm openssl mongodb
```

## 2. Install Node.js and NPM

```bash
# Install Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell configuration
source ~/.bashrc

# Install Node.js v14
nvm install 14
nvm use 14

# Verify installation
node --version
npm --version
```

## 3. Clone and Setup CSMS

```bash
# Clone repository
git clone https://github.com/yourusername/csms.git
cd csms

# Install dependencies
npm install
```

## 4. Generate SSL Certificates

```bash
# Create certificates directory
mkdir certs
cd certs

# Generate SSL certificate
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes \
-subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Set proper permissions
chmod 600 key.pem cert.pem
cd ..
```

## 5. Configure MongoDB

```bash
# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod

# Create database and user
mongosh <<EOF
use csms
db.createUser({
  user: "csmsUser",
  pwd: "your_secure_password",
  roles: [{ role: "readWrite", db: "csms" }]
})
EOF
```

## 6. Configure Environment

```bash
# Create .env file
cat > .env << EOL
PORT=3001
MONGODB_URI=mongodb://csmsUser:your_secure_password@localhost:27017/csms
JWT_SECRET=$(openssl rand -base64 32)
SSL_KEY_PATH=./certs/key.pem
SSL_CERT_PATH=./certs/cert.pem
EOL
```

## 7. Start CSMS

### Development Mode
```bash
# Start in development mode
npm run dev
```

### Production Mode
```bash
# Install PM2 for process management
sudo npm install -g pm2

# Start CSMS with PM2
pm2 start server.js --name csms

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## 8. Verify Installation

1. Check server status:
```bash
# Check if server is running
sudo netstat -tulpn | grep 3001

# Check logs
tail -f ~/.pm2/logs/csms-out.log
```

2. Access web interface:
```bash
# Open in browser
https://localhost:3001
```

## 9. Firewall Configuration

```bash
# Allow HTTPS and WebSocket ports
sudo ufw allow 3001/tcp
sudo ufw status
```

## 10. Troubleshooting

### Common Issues

1. Port in Use
```bash
# Check what's using the port
sudo lsof -i :3001
# Kill the process if needed
sudo kill -9 <PID>
```

2. Permission Issues
```bash
# Fix directory permissions
sudo chown -R $USER:$USER ~/csms
```

3. MongoDB Connection Issues
```bash
# Check MongoDB status
sudo systemctl status mongod
# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

## 11. Maintenance

### Log Rotation
```bash
# Install logrotate if not present
sudo apt install logrotate

# Create logrotate configuration
sudo tee /etc/logrotate.d/csms << EOL
/home/$(whoami)/.pm2/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
EOL
```

### Backup Script
```bash
# Create backup script
cat > backup-csms.sh << EOL
#!/bin/bash
BACKUP_DIR="/backup/csms"
mkdir -p \$BACKUP_DIR
mongodump --db csms --out \$BACKUP_DIR/\$(date +%Y%m%d)
find \$BACKUP_DIR -mtime +7 -delete
EOL

chmod +x backup-csms.sh
```

## 12. Monitoring

```bash
# Monitor system resources
htop

# Monitor CSMS process
pm2 monit

# Check logs
pm2 logs csms
``` 