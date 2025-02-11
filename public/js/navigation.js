// Navigation and authentication functions
function navigateTo(path) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    // Update active state before navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(path)) {
            link.classList.add('active');
        }
    });
    
    window.location.href = path;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Check authentication and setup page
function setupPage() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/';
        return;
    }

    // Update user info
    document.getElementById('userInfo').textContent = `${user.username} (${user.role})`;

    // Show admin features if user is admin
    if (user.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
    }

    // Set active nav item based on current path
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(currentPath)) {
            link.classList.add('active');
        }
    });
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', setupPage); 