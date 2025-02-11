// Socket.IO initialization - move to top of file
let socket;

// Initialize page and Socket.IO
document.addEventListener('DOMContentLoaded', () => {
    console.log('OCPP Control page loaded');
    const token = localStorage.getItem('token');
    console.log('Token exists:', !!token);

    if (!token) {
        console.error('No token found');
        window.location.href = '/';
        return;
    }

    // Initialize Socket.IO
    socket = io({
        secure: true,
        rejectUnauthorized: false,
        auth: {
            token: localStorage.getItem('token')
        }
    });

    socket.on('connect', () => {
        console.log('Connected to Socket.IO');
    });

    socket.on('ocpp_message', (data) => {
        console.log('OCPP message received:', data);
        addMessageToLog(data);
    });

    socket.on('charger_status_update', (data) => {
        console.log('Charger status update:', data);
        loadChargers();
    });

    // Initialize the interface
    loadChargers();
    setupCommandForm();
    


});

async function loadChargers() {
    try {
        const response = await fetch('/api/chargers', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch chargers');
        }
        
        const chargers = await response.json();
        console.log('Loaded chargers:', chargers);
        updateChargersList(chargers);
        updateChargerSelect(chargers);
    } catch (error) {
        console.error('Error loading chargers:', error);
        showError(error.message);
    }
}

function updateChargersList(chargers) {
    const chargersList = document.getElementById('chargersList');
    if (!chargersList) {
        console.error('Chargers list element not found');
        return;
    }

    if (!chargers || !chargers.length) {
        chargersList.innerHTML = '<div class="alert alert-info">No chargers found</div>';
        return;
    }

    chargersList.innerHTML = chargers.map(charger => `
        <div class="card mb-2">
            <div class="card-body">
                <h5 class="card-title">${charger.name || charger.chargePointId}</h5>
                <p class="card-text">
                    ID: ${charger.chargePointId}<br>
                    Status: <span class="status-badge status-${charger.status?.toLowerCase()}">${charger.status || 'Unknown'}</span><br>
                    Last Heartbeat: ${charger.lastHeartbeat ? new Date(charger.lastHeartbeat).toLocaleString() : 'Never'}
                </p>
            </div>
        </div>
    `).join('');
}

function updateChargerSelect(chargers) {
    const select = document.getElementById('chargerSelect');
    if (!select) {
        console.error('Charger select element not found');
        return;
    }

    select.innerHTML = `
        <option value="">Select a charger...</option>
        ${chargers.map(charger => `
            <option value="${charger.chargePointId}">
                ${charger.name || charger.chargePointId}
            </option>
        `).join('')}
    `;
}

function setupCommandForm() {
    const form = document.getElementById('ocppCommandForm');
    if (!form) {
        console.error('Command form not found');
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const chargerId = document.getElementById('chargerSelect').value;
        const command = document.getElementById('commandSelect').value;
        
        if (!chargerId || !command) {
            showError('Please select both a charger and a command');
            return;
        }

        try {
            const response = await fetch('/api/ocpp/command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ chargerId, command })
            });

            if (!response.ok) {
                throw new Error('Failed to send command');
            }

            const result = await response.json();
            addMessageToLog({
                type: 'Command',
                message: `Sent ${command} to ${chargerId}`,
                timestamp: new Date(),
                success: true
            });

            // Update command response display
            const responseElement = document.getElementById('commandResponse');
            if (responseElement) {
                responseElement.textContent = JSON.stringify(result, null, 2);
            }
        } catch (error) {
            console.error('Error sending command:', error);
            showError(error.message);
        }
    });
}

function addMessageToLog(data) {
    const logContainer = document.getElementById('messageLog');
    if (!logContainer) {
        console.error('Message log container not found');
        return;
    }

    const messageElement = document.createElement('div');
    messageElement.className = `log-message ${data.success ? 'success' : 'error'}`;
    messageElement.innerHTML = `
        <span class="timestamp">${new Date(data.timestamp).toLocaleString()}</span>
        <span class="type">[${data.type}]</span>
        <span class="message">${data.message}</span>
    `;

    logContainer.insertBefore(messageElement, logContainer.firstChild);
}

function showError(message) {
    console.error('OCPP Control error:', message);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show mt-3';
    errorDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function updateChargerStatus(chargerId, status) {
    const chargerElement = document.querySelector(`#charger-${chargerId}`);
    if (chargerElement) {
        chargerElement.querySelector('.status-badge').textContent = status;
        chargerElement.querySelector('.status-badge').className = `status-badge status-${status.toLowerCase()}`;
    }
} 