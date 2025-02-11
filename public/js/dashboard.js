// Socket.IO initialization - move to top of file
let socket;

// Initialize page and Socket.IO
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard page loaded');
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

    socket.on('dashboard_update', (data) => {
        console.log('Dashboard update received:', data);
        updateDashboardStats();
    });

    socket.on('charger_status_update', (data) => {
        console.log('Charger status update:', data);
        updateDashboardStats();
    });

    socket.on('transaction_update', (data) => {
        console.log('Transaction update received:', data);
        updateDashboardStats();
    });

    // Initial load
    updateDashboardStats();
    // Refresh every 30 seconds
    setInterval(updateDashboardStats, 30000);
});

async function updateDashboardStats() {
    try {
        const response = await fetch('/api/dashboard/stats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired or invalid
                localStorage.removeItem('token');
                window.location.href = '/';
                throw new Error('Session expired');
            }
            throw new Error('Failed to fetch dashboard stats');
        }

        const data = await response.json();
        console.log('Dashboard stats:', data);
        updateUI(data);
    } catch (error) {
        console.error('Error updating dashboard:', error);
        showError(error.message);
    }
}

function updateUI(data) {
    try {
        console.log('Updating UI with data:', data);
        
        // Update charger stats
        document.getElementById('totalChargers').textContent = data.chargerStats?.total || 0;
        document.getElementById('activeSessions').textContent = data.transactionStats?.active || 0;
        document.getElementById('totalEnergyToday').textContent = 
            `${(data.transactionStats?.totalEnergy || 0).toFixed(2)} kWh`;
        document.getElementById('totalTransactions').textContent = data.transactionStats?.total || 0;

        // Update recent transactions
        const tbody = document.getElementById('recentTransactions');
        if (tbody) {
            if (data.recentTransactions && data.recentTransactions.length > 0) {
                tbody.innerHTML = data.recentTransactions.map(t => `
                    <tr>
                        <td>${t.charger || 'N/A'}</td>
                        <td>${new Date(t.startTime).toLocaleString()}</td>
                        <td>${formatDuration(t.duration)}</td>
                        <td>${(t.energy || 0).toFixed(2)} kWh</td>
                        <td><span class="badge bg-${getStatusBadgeClass(t.status)}">${t.status}</span></td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No recent transactions</td></tr>';
            }
        }
    } catch (error) {
        console.error('Error updating UI:', error);
        showError('Error updating dashboard display');
    }
}

function showError(message) {
    console.error('Dashboard error:', message);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show mt-3';
    errorDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Add any chart update functions you need
function updateCharts(data) {
    // Implementation for updating charts
}

function formatDuration(minutes) {
    if (!minutes) return 'N/A';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function getStatusBadgeClass(status) {
    switch(status?.toLowerCase()) {
        case 'in progress': return 'primary';
        case 'completed': return 'success';
        case 'failed': return 'danger';
        case 'stopped': return 'warning';
        default: return 'secondary';
    }
} 