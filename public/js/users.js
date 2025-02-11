// Socket.IO initialization
let socket;

// Initialize page and Socket.IO
document.addEventListener('DOMContentLoaded', () => {
    console.log('Users page loaded');
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

    socket.on('user_update', (data) => {
        console.log('User update received:', data);
        loadUsers();
    });

    // Load initial users
    loadUsers();
});

async function loadUsers() {
    try {
        showLoading(true);
        const response = await fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/';
                throw new Error('Session expired');
            }
            throw new Error('Failed to fetch users');
        }
        
        const users = await response.json();
        console.log('Loaded users:', users);
        updateUsersList(users);
    } catch (error) {
        console.error('Error loading users:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

function updateUsersList(users) {
    const usersList = document.getElementById('usersList');
    if (!usersList) {
        console.error('Users list element not found!');
        return;
    }

    if (!users || !users.length) {
        usersList.innerHTML = '<div class="alert alert-info">No users found</div>';
        return;
    }

    usersList.innerHTML = users.map(user => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="card-title mb-0">${user.username}</h5>
                    <span class="badge bg-${user.role === 'admin' ? 'primary' : 'secondary'}">${user.role}</span>
                </div>
                <p class="card-text mt-2">
                    Email: ${user.email || 'Not specified'}<br>
                    Created: ${new Date(user.createdAt).toLocaleString()}
                </p>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="editUser('${user._id}')">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${user._id}')">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function addUser(event) {
    event.preventDefault();
    const form = event.target;
    
    const userData = {
        username: form.username.value,
        email: form.email.value,
        password: form.password.value,
        role: form.role.value
    };

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to add user');
        }

        // Close modal and refresh list
        const modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
        modal.hide();
        form.reset();
        loadUsers();
    } catch (error) {
        console.error('Error adding user:', error);
        showError(error.message);
    }
}

function showAddUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
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