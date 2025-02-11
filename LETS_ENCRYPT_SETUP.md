# Setting up Let's Encrypt for CSMS

## 1. Prerequisites

```bash
# Install Certbot and Nginx
sudo apt update
sudo apt install -y certbot python3-certbot-nginx nginx
```

## 2. Configure Nginx

```bash
# Create Nginx configuration for CSMS
sudo nano /etc/nginx/sites-available/csms

# Add the following configuration
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    location / {
        proxy_pass https://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ocpp/ {
        proxy_pass https://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
```

## 3. Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/csms /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## 4. Obtain SSL Certificate

```bash
# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

## 5. Update CSMS Configuration

1. Update your `.env` file:
```bash
# Update SSL paths in .env
cat > .env << EOL
PORT=3001
MONGODB_URI=mongodb://csmsUser:your_secure_password@localhost:27017/csms
JWT_SECRET=$(openssl rand -base64 32)
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
EOL
```

2. Update server.js to use Let's Encrypt certificates:
javascript:CSMS/server.js
const https = require('https');
const fs = require('fs');
const options = {
key: fs.readFileSync(process.env.SSL_KEY_PATH),
cert: fs.readFileSync(process.env.SSL_CERT_PATH),
secureProtocol: 'TLS_method',
ciphers: 'ALL'
};
```

## 6. Set Up Auto-renewal

```bash
# Create renewal hook
sudo mkdir -p /etc/letsencrypt/renewal-hooks/post
sudo nano /etc/letsencrypt/renewal-hooks/post/restart-csms

# Add the following content
#!/bin/bash
pm2 restart csms
```

```bash
# Make the hook executable
sudo chmod +x /etc/letsencrypt/renewal-hooks/post/restart-csms
```

## 7. Configure Permissions

```bash
# Allow Node.js to read SSL certificates
sudo usermod -a -G ssl-cert nodejs
sudo chown -R root:ssl-cert /etc/letsencrypt/live/
sudo chown -R root:ssl-cert /etc/letsencrypt/archive/
sudo chmod -R 750 /etc/letsencrypt/live/
sudo chmod -R 750 /etc/letsencrypt/archive/
```

## 8. Update Firewall Rules

```bash
# Allow HTTPS traffic
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
sudo ufw status
```

## 9. Verify Setup

1. Test HTTPS:
```bash
curl https://your-domain.com
```

2. Test WebSocket:
```bash
# Using wscat
wscat -c wss://your-domain.com/ocpp/test
```

## 10. Troubleshooting

### Common Issues

1. Certificate Permission Errors
```bash
# Check permissions
sudo ls -la /etc/letsencrypt/live/your-domain.com/
sudo ls -la /etc/letsencrypt/archive/your-domain.com/

# Fix permissions if needed
sudo chmod -R 750 /etc/letsencrypt/live/your-domain.com/
sudo chmod -R 750 /etc/letsencrypt/archive/your-domain.com/
```

2. Nginx Proxy Errors
```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check Nginx access logs
sudo tail -f /var/log/nginx/access.log
```

3. Certificate Renewal Issues
```bash
# Test renewal process
sudo certbot renew --dry-run --debug
```

## 11. Security Recommendations

1. Enable HSTS in Nginx:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

2. Configure SSL parameters:
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
```

3. Enable OCSP Stapling:
```nginx
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

## 12. Monitoring

```bash
# Monitor certificate expiry
echo "00 00 * * * root certbot certificates" | sudo tee -a /etc/crontab

# Monitor Nginx status
sudo systemctl status nginx

# Check SSL configuration
curl -vI https://your-domain.com