// Remove the socket declaration and initialization at the top
// Instead, just use the existing socket from footer.ejs

document.addEventListener('DOMContentLoaded', () => {
    console.log('Chargers page loaded');
    const token = localStorage.getItem('token');
    console.log('Token exists:', !!token);

    // No need to initialize socket here as it's already done in footer.ejs
    // Just add the event listeners
    socket.on('connect', () => {
        console.log('Connected to Socket.IO');
    });

    socket.on('charger_status_update', (data) => {
        console.log('Charger status update:', data);
        loadChargers();
    });

    // Load initial chargers
    loadChargers();
});

async function addCharger(event) {
    event.preventDefault();
    console.log('Add charger function called');
    
    const form = event.target;
    const chargerData = {
        chargePointId: document.getElementById('chargePointId').value,
        name: document.getElementById('name').value,
        location: document.getElementById('location').value,
        protocol: document.getElementById('protocol').value
    };

    console.log('Attempting to add charger with data:', chargerData);

    try {
        const response = await fetch('/api/chargers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(chargerData)
        });

        const data = await response.json();
        console.log('Server response:', data);
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to add charger');
        }

        console.log('Charger added successfully:', data);

        // Close the modal after successful addition
        const modal = bootstrap.Modal.getInstance(document.getElementById('addChargerModal'));
        if (modal) {
            modal.hide();
        } else {
            console.error('Modal instance not found');
        }

        // Refresh charger list
        await loadChargers();
        
        // Show success message
        const successDiv = document.createElement('div');
        successDiv.className = 'alert alert-success alert-dismissible fade show mt-3';
        successDiv.innerHTML = `
            Charger added successfully
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.querySelector('.container').prepend(successDiv);
        setTimeout(() => successDiv.remove(), 5000);

        // Clear form
        form.reset();
    } catch (error) {
        console.error('Error adding charger:', error);
        showError(error.message);
    }
}

async function loadChargers() {
    try {
        console.log('Fetching chargers...');
        const response = await fetch('/api/chargers', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch chargers: ${response.status}`);
        }
        
        const chargers = await response.json();
        console.log('Loaded chargers:', chargers);
        
        // Check if chargersList element exists
        const chargersList = document.getElementById('chargersList');
        console.log('ChargersList element:', chargersList);
        
        updateChargersList(chargers);
    } catch (error) {
        console.error('Error loading chargers:', error);
        showError(error.message);
    }
}

function updateChargersList(chargers) {
    const chargersList = document.getElementById('chargersList');
    if (!chargersList) {
        console.error('Chargers list element not found!');
        return;
    }

    if (!chargers || chargers.length === 0) {
        chargersList.innerHTML = '<div class="alert alert-info">No chargers found</div>';
        return;
    }

    const chargersHtml = chargers.map(charger => {
        console.log('Processing charger:', charger);
        
        // Format connectors display
        const connectorsHtml = charger.connectors?.map(conn => `
            <div class="connector-status mb-1">
                <span class="badge bg-${getStatusBadgeClass(conn.status)}">
                    Connector ${conn.connectorId}: ${conn.status}
                    ${conn.errorCode && conn.errorCode !== 'NoError' ? 
                        `<span class="ms-1 text-warning">(${conn.errorCode})</span>` : 
                        ''}
                </span>
            </div>
        `).join('') || '';

        return `
            <div class="card mb-3" id="charger-${charger.chargePointId}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="card-title mb-0">${charger.name || `Charger ${charger.chargePointId}`}</h5>
                        <span class="badge bg-${getStatusBadgeClass(charger.status)}">${charger.status || 'Unknown'}</span>
                    </div>
                    <p class="card-text mt-2">
                        ID: ${charger.chargePointId}<br>
                        Location: ${charger.location || 'Not specified'}<br>
                        Protocol: ${charger.protocol || 'Unknown'}<br>
                        Last Heartbeat: ${charger.lastHeartbeat ? new Date(charger.lastHeartbeat).toLocaleString() : 'Never'}
                    </p>
                    <div class="connectors mb-2">
                        <strong>Connectors:</strong><br>
                        ${connectorsHtml}
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="editCharger('${charger._id}')">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCharger('${charger._id}')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    chargersList.innerHTML = chargersHtml.join('');
}

function updateChargerStatus(chargerId, connectorId, status, errorCode) {
    const chargerElement = document.querySelector(`#charger-${chargerId}`);
    if (!chargerElement) return;

    const connectorsDiv = chargerElement.querySelector('.connectors');
    if (!connectorsDiv) return;

    const connectorElement = connectorsDiv.querySelector(`[data-connector-id="${connectorId}"]`);
    if (connectorElement) {
        connectorElement.className = `badge bg-${getStatusBadgeClass(status)}`;
        connectorElement.innerHTML = `
            Connector ${connectorId}: ${status}
            ${errorCode && errorCode !== 'NoError' ? 
                `<span class="ms-1 text-warning">(${errorCode})</span>` : 
                ''}
        `;
    }
}

function updateChargerUI(data) {
    const chargerElement = document.querySelector(`#charger-${data.chargerId}`);
    if (!chargerElement) return;

    const statusEl = chargerElement.querySelector('.status');
    const usageEl = chargerElement.querySelector('.usage');
    const connectorsEl = chargerElement.querySelector('.connectors');
    const lastSeenEl = chargerElement.querySelector('.last-seen');
    
    // Update status with color coding
    if (statusEl) {
        statusEl.textContent = data.status;
        statusEl.className = `status ${data.status.toLowerCase()}`;
        
        // Add status colors
        const colors = {
            'Available': 'bg-success',
            'Charging': 'bg-primary',
            'Faulted': 'bg-danger',
            'Unavailable': 'bg-secondary',
            'Preparing': 'bg-warning',
            'Finishing': 'bg-info'
        };
        Object.keys(colors).forEach(status => statusEl.classList.remove(colors[status]));
        statusEl.classList.add(colors[data.status] || 'bg-secondary');
    }
    
    // Update usage status
    if (usageEl) {
        const usageStatus = data.isInUse ? 'In Use' : 'Available';
        usageEl.textContent = usageStatus;
        usageEl.className = `usage ${data.isInUse ? 'in-use' : 'available'}`;
    }
    
    // Update connectors
    if (connectorsEl && data.connectors) {
        connectorsEl.innerHTML = data.connectors.map(conn => `
            <div class="connector ${conn.status.toLowerCase()}">
                <span class="connector-id">Connector ${conn.connectorId}</span>
                <span class="connector-status">${conn.status}</span>
                ${conn.errorCode ? `<span class="connector-error">${conn.errorCode}</span>` : ''}
            </div>
        `).join('');
    }
    
    // Update last seen time
    if (lastSeenEl && data.lastHeartbeat) {
        const lastSeen = new Date(data.lastHeartbeat);
        const timeAgo = Math.floor((new Date() - lastSeen) / 1000);
        lastSeenEl.textContent = `Last seen: ${timeAgo < 60 ? 'just now' : 
            timeAgo < 3600 ? `${Math.floor(timeAgo/60)}m ago` : 
            `${Math.floor(timeAgo/3600)}h ago`}`;
    }

    // Update transaction info if available
    if (data.currentTransaction) {
        const transactionEl = chargerElement.querySelector('.transaction-info');
        if (transactionEl) {
            transactionEl.innerHTML = `
                <div class="current-transaction">
                    <span>Transaction: ${data.currentTransaction}</span>
                    <span>Energy: ${data.energy || 0} kWh</span>
                </div>
            `;
        }
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show mt-3';
    errorDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function getStatusBadgeClass(status) {
    switch(status?.toLowerCase()) {
        case 'available': return 'success';
        case 'preparing': return 'info';
        case 'charging': return 'primary';
        case 'finishing': return 'warning';
        case 'reserved': return 'warning';
        case 'unavailable': return 'secondary';
        case 'faulted': return 'danger';
        case 'internalerror': return 'danger';
        case 'noerror': return 'success';
        default: return 'secondary';
    }
}

async function editCharger(chargerId) {
    try {
        // Fetch charger details
        const response = await fetch(`/api/chargers/${chargerId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch charger details');
        }

        const charger = await response.json();
        
        // Create edit modal dynamically
        const modalHtml = `
            <div class="modal fade" id="editChargerModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Charger</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editChargerForm">
                                <div class="mb-3">
                                    <label class="form-label">Charge Point ID</label>
                                    <input type="text" class="form-control" value="${charger.chargePointId}" readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Name</label>
                                    <input type="text" class="form-control" id="editName" value="${charger.name || ''}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Location</label>
                                    <input type="text" class="form-control" id="editLocation" value="${charger.location || ''}">
                                </div>
                                <button type="submit" class="btn btn-primary">Save Changes</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('editChargerModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Setup form submission
        const form = document.getElementById('editChargerForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateCharger(chargerId, {
                name: document.getElementById('editName').value,
                location: document.getElementById('editLocation').value
            });
        });

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editChargerModal'));
        modal.show();

    } catch (error) {
        console.error('Error editing charger:', error);
        showError(error.message);
    }
}

async function updateCharger(chargerId, data) {
    try {
        const response = await fetch(`/api/chargers/${chargerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to update charger');
        }

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editChargerModal'));
        modal.hide();

        // Refresh chargers list
        loadChargers();
        
        // Show success message
        const successDiv = document.createElement('div');
        successDiv.className = 'alert alert-success alert-dismissible fade show mt-3';
        successDiv.innerHTML = `
            Charger updated successfully
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.querySelector('.container').prepend(successDiv);
        setTimeout(() => successDiv.remove(), 5000);

    } catch (error) {
        console.error('Error updating charger:', error);
        showError(error.message);
    }
}

async function deleteCharger(chargerId) {
    if (!confirm('Are you sure you want to delete this charger?')) {
        return;
    }

    try {
        const response = await fetch(`/api/chargers/${chargerId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete charger');
        }

        // Refresh chargers list
        loadChargers();
        
        // Show success message
        const successDiv = document.createElement('div');
        successDiv.className = 'alert alert-success alert-dismissible fade show mt-3';
        successDiv.innerHTML = `
            Charger deleted successfully
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.querySelector('.container').prepend(successDiv);
        setTimeout(() => successDiv.remove(), 5000);

    } catch (error) {
        console.error('Error deleting charger:', error);
        showError(error.message);
    }
}

// Add this function after the existing functions
function showAddChargerModal() {
    // Create modal dynamically if it doesn't exist
    if (!document.getElementById('addChargerModal')) {
        const modalHtml = `
            <div class="modal fade" id="addChargerModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Add New Charger</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="addChargerForm" onsubmit="addCharger(event)">
                                <div class="mb-3">
                                    <label for="chargePointId" class="form-label">Charge Point ID</label>
                                    <input type="text" class="form-control" id="chargePointId" required>
                                </div>
                                <div class="mb-3">
                                    <label for="name" class="form-label">Name</label>
                                    <input type="text" class="form-control" id="name" required>
                                </div>
                                <div class="mb-3">
                                    <label for="location" class="form-label">Location</label>
                                    <input type="text" class="form-control" id="location">
                                </div>
                                <div class="mb-3">
                                    <label for="protocol" class="form-label">Protocol</label>
                                    <select class="form-control" id="protocol" required>
                                        <option value="ocpp1.6">OCPP 1.6</option>
                                        <option value="ocpp2.0.1">OCPP 2.0.1</option>
                                    </select>
                                </div>
                                <button type="submit" class="btn btn-primary">Add Charger</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('addChargerModal'));
    modal.show();
}