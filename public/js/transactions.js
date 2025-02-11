// Socket.IO initialization - move to top of file
let socket;

// Initialize page and Socket.IO
document.addEventListener('DOMContentLoaded', () => {
    console.log('Transactions page loaded');
    const token = localStorage.getItem('token');
    console.log('Token exists:', !!token);

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

    socket.on('transaction_event', (data) => {
        console.log('Transaction event received:', data);
        loadTransactions();
    });

    // Load initial transactions
    loadTransactions();
});

async function loadTransactions() {
    try {
        showLoading(true);
        const response = await fetch('/api/transactions/api', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch transactions');
        }
        
        const transactions = await response.json();
        console.log('Loaded transactions:', transactions);
        updateTransactionsTable(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) {
        console.error('Transactions table body not found!');
        return;
    }

    if (!transactions || !transactions.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No transactions found</td></tr>';
        return;
    }

    tbody.innerHTML = transactions.map(t => `
        <tr>
            <td>${t.transactionId}</td>
            <td>${t.charger}</td>
            <td>${t.idTag}</td>
            <td>${new Date(t.startTime).toLocaleString()}</td>
            <td>${t.endTime ? new Date(t.endTime).toLocaleString() : 'In Progress'}</td>
            <td>${(t.energy || 0).toFixed(2)}</td>
            <td><span class="badge bg-${getStatusBadgeClass(t.status)}">${t.status}</span></td>
        </tr>
    `).join('');
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => errorDiv.style.display = 'none', 5000);
    }
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