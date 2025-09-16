// Common functions and utilities for Fun Zone
// This file contains shared functionality across all pages

// Navigation functions
function goToLogin() {
    window.location.href = 'login.html';
}

function goToDashboard() {
    window.location.href = 'dashboard.html';
}

function goToHome() {
    window.location.href = 'index.html';
}

// User status display
function updateUserStatus() {
    const user = window.auth ? window.auth.getCurrentUser() : null;
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const userInfo = document.getElementById('userInfo');
    const tokenNotice = document.getElementById('tokenNotice');

    if (user && loginButton) {
        loginButton.style.display = 'none';
        if (logoutButton) {
            logoutButton.style.display = 'inline-block';
        }
        if (tokenNotice) {
            tokenNotice.style.display = 'block';
        }
        if (userInfo) {
            userInfo.style.display = 'block';
            userInfo.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${user.avatar_url || 'https://via.placeholder.com/30x30/ff6b6b/ffffff?text=' + (user.full_name ? user.full_name.charAt(0) : 'U')}" 
                         style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
                    <span style="color: white; font-weight: bold;">${user.full_name || 'User'}</span>
                </div>
            `;
        }
    } else if (loginButton) {
        loginButton.style.display = 'block';
        if (logoutButton) {
            logoutButton.style.display = 'none';
        }
        if (tokenNotice) {
            tokenNotice.style.display = 'none';
        }
        if (userInfo) {
            userInfo.style.display = 'none';
        }
    }
}

// Logout function
function logout() {
    if (window.auth) {
        window.auth.logout();
        updateUserStatus();
        // Show logout message
        showNotification('Đã đăng xuất thành công! 👋', 'success');
    }
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.getElementById('notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: bold;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 3000);
}

// Add CSS animations for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(notificationStyles);

// Smooth scrolling for anchor links
function smoothScrollTo(targetId) {
    const target = document.getElementById(targetId);
    if (target) {
        target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Initialize common functionality
document.addEventListener('DOMContentLoaded', function () {
    // Update user status on all pages
    updateUserStatus();

    // Add smooth scrolling to all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            smoothScrollTo(targetId);
        });
    });
});

// Utility functions
const utils = {
    // Format number with Vietnamese locale
    formatNumber: (num) => {
        return new Intl.NumberFormat('vi-VN').format(num);
    },

    // Format currency
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    },

    // Debounce function
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Generate random ID
    generateId: () => {
        return Math.random().toString(36).substr(2, 9);
    },

    // Check if element is in viewport
    isInViewport: (element) => {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
};

// Export utilities to global scope
window.utils = utils;

// Initialize user status when page loads
document.addEventListener('DOMContentLoaded', function () {
    // Wait a bit for auth.js to load
    setTimeout(() => {
        updateUserStatus();
    }, 100);
});

// Also update when auth state changes
window.addEventListener('storage', function (e) {
    if (e.key === 'auth_token' || e.key === 'user_data') {
        updateUserStatus();
    }
});
