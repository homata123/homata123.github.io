// Authentication functions for Fun Zone
const API_BASE_URL = 'https://homatabe-qx4o.onrender.com';
const LOGIN_ENDPOINT = '/auth/login';

// User session management
function saveUserSession(userData) {
    try {
        localStorage.setItem('funzone_user', JSON.stringify(userData));
        localStorage.setItem('funzone_token', userData.access_token);
        localStorage.setItem('funzone_refresh_token', userData.refresh_token);
        return true;
    } catch (error) {
        console.error('Error saving user session:', error);
        return false;
    }
}

function getCurrentUser() {
    try {
        const userData = localStorage.getItem('funzone_user');
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

function getAccessToken() {
    return localStorage.getItem('funzone_token');
}

function getRefreshToken() {
    return localStorage.getItem('funzone_refresh_token');
}

function clearUserSession() {
    try {
        localStorage.removeItem('funzone_user');
        localStorage.removeItem('funzone_token');
        localStorage.removeItem('funzone_refresh_token');
        return true;
    } catch (error) {
        console.error('Error clearing user session:', error);
        return false;
    }
}

function isLoggedIn() {
    const user = getCurrentUser();
    const token = getAccessToken();
    return user && token;
}

// Login function
async function login(email, password) {
    try {
        console.log('Attempting login with:', { email, password: '***' });
        console.log('API URL:', `${API_BASE_URL}${LOGIN_ENDPOINT}`);

        const response = await fetch(`${API_BASE_URL}${LOGIN_ENDPOINT}`, {
            method: 'POST',
            mode: 'cors', // Explicitly set CORS mode
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // Handle specific status codes
            if (response.status === 400) {
                throw new Error('Thông tin đăng nhập không hợp lệ. Vui lòng kiểm tra lại email và password.');
            } else if (response.status === 401) {
                throw new Error('Email hoặc mật khẩu không đúng.');
            } else if (response.status === 403) {
                throw new Error('Tài khoản của bạn đã bị khóa hoặc không có quyền truy cập.');
            } else if (response.status === 404) {
                throw new Error('Không tìm thấy dịch vụ đăng nhập. Vui lòng thử lại sau.');
            } else if (response.status === 405) {
                throw new Error('Lỗi CORS: Server không hỗ trợ OPTIONS request. Vui lòng kiểm tra cấu hình CORS trên server.');
            } else if (response.status >= 500) {
                throw new Error('Lỗi máy chủ. Vui lòng thử lại sau.');
            }

            throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate response structure
        if (!data.access_token) {
            throw new Error('Invalid response from server');
        }

        // Save user session
        const saveSuccess = saveUserSession(data);
        if (!saveSuccess) {
            throw new Error('Failed to save user session');
        }

        return {
            success: true,
            user: data,
            message: 'Đăng nhập thành công!'
        };

    } catch (error) {
        console.error('Login error:', error);

        // Handle CORS and network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return {
                success: false,
                message: 'Lỗi kết nối: Không thể kết nối đến server. Vui lòng kiểm tra:\n1. Server có đang chạy không?\n2. Cấu hình CORS trên server\n3. URL API có đúng không?'
            };
        }

        if (error.message.includes('CORS')) {
            return {
                success: false,
                message: 'Lỗi CORS: Server cần cấu hình để cho phép requests từ browser. Vui lòng kiểm tra cấu hình CORS trên server.'
            };
        }

        return {
            success: false,
            message: error.message || 'Đăng nhập thất bại. Vui lòng thử lại.'
        };
    }
}

// Register function
async function register(fullName, email, password, memberCode) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                full_name: fullName,
                email: email,
                password: password,
                member_code: memberCode
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // Handle specific status codes
            if (response.status === 400) {
                throw new Error('Thông tin đăng ký không hợp lệ. Vui lòng kiểm tra lại thông tin.');
            } else if (response.status === 409) {
                throw new Error('Email đã được sử dụng. Vui lòng chọn email khác.');
            } else if (response.status >= 500) {
                throw new Error('Lỗi máy chủ. Vui lòng thử lại sau.');
            }

            throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // If registration includes access token, save user session
        if (data.access_token) {
            const saveSuccess = saveUserSession(data);
            if (saveSuccess) {
                return {
                    success: true,
                    user: data,
                    message: 'Đăng ký thành công! Bạn đã được đăng nhập tự động.',
                    autoLogin: true
                };
            }
        }

        return {
            success: true,
            user: data,
            message: 'Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.',
            autoLogin: false
        };

    } catch (error) {
        console.error('Register error:', error);
        return {
            success: false,
            message: error.message || 'Đăng ký thất bại. Vui lòng thử lại.'
        };
    }
}

// Logout function
function logout() {
    clearUserSession();
    return {
        success: true,
        message: 'Đăng xuất thành công!'
    };
}

// Check if token is expired (basic check)
function isTokenExpired(token) {
    try {
        if (!token) return true;

        // Decode JWT token (basic decode without verification)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);

        // Add 5 minute buffer before actual expiration
        const bufferTime = 5 * 60; // 5 minutes in seconds
        const isExpired = payload.exp < (currentTime + bufferTime);

        if (isExpired) {
            console.log('Token will expire soon or is expired');
        }

        return isExpired;
    } catch (error) {
        console.error('Error checking token expiration:', error);
        return true;
    }
}

// Refresh token function (if needed in the future)
async function refreshAccessToken() {
    try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        // This would need to be implemented based on your backend API
        // For now, we'll just return false
        console.log('Refresh token functionality not implemented yet');
        return false;
    } catch (error) {
        console.error('Error refreshing token:', error);
        return false;
    }
}

// API request with authentication
async function authenticatedRequest(url, options = {}) {
    const token = getAccessToken();

    if (!token) {
        throw new Error('No authentication token available');
    }

    if (isTokenExpired(token)) {
        // Try to refresh token
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            // Redirect to login
            window.location.href = 'login.html';
            return;
        }
    }

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        }
    };

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, finalOptions);

        if (response.status === 401) {
            // Token expired or invalid, redirect to login
            clearUserSession();
            window.location.href = 'login.html';
            return;
        }

        return response;
    } catch (error) {
        console.error('Authenticated request error:', error);
        throw error;
    }
}

// Function to update user info display on all pages
function updateUserInfoDisplay() {
    const userInfoElement = document.getElementById('userInfo');
    const loginButton = document.getElementById('loginButton');

    if (!userInfoElement || !loginButton) return;

    if (isLoggedIn()) {
        const user = getCurrentUser();
        if (user) {
            // Hide login button
            loginButton.style.display = 'none';

            // Show user info
            userInfoElement.style.display = 'block';
            const avatarUrl = getUserAvatar(user);
            userInfoElement.innerHTML = `
                <div class="user-info">
                    <img src="${avatarUrl}" alt="Avatar" style="width: 30px; height: 30px; border-radius: 50%; margin-right: 8px; vertical-align: middle;">
                    <span class="user-name">👤 ${user.full_name || user.email}</span>
                    <span class="user-balance">💰 $${user.taixiu?.current_money?.toLocaleString() || '0'}</span>
                    <button class="logout-button" onclick="handleLogout()">🚪 Đăng xuất</button>
                </div>
            `;
        }
    } else {
        // Show login button
        loginButton.style.display = 'block';

        // Hide user info
        userInfoElement.style.display = 'none';
    }
}

// Function to handle logout
function handleLogout() {
    const result = logout();
    if (result.success) {
        // Update UI
        updateUserInfoDisplay();

        // Show notification
        if (window.showNotification) {
            window.showNotification(result.message, 'success');
        } else {
            alert(result.message);
        }

        // Redirect to home page
        window.location.href = 'index.html';
    }
}

// Utility function to check authentication status on page load
function checkAuthStatus() {
    if (!isLoggedIn()) {
        // If on protected page, redirect to login
        if (window.location.pathname.includes('dashboard.html') ||
            window.location.pathname.includes('taixiu.html')) {
            window.location.href = 'login.html';
        }
    } else {
        // If on login page but already logged in, redirect to dashboard
        if (window.location.pathname.includes('login.html')) {
            window.location.href = 'dashboard.html';
        }
    }

    // Update user info display on all pages
    updateUserInfoDisplay();
}

// Initialize auth check when script loads
document.addEventListener('DOMContentLoaded', checkAuthStatus);

// TaiXiu API functions
async function getTaiXiuStats() {
    try {
        const response = await authenticatedRequest(`${API_BASE_URL}/taixiu/stats`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching TaiXiu stats:', error);
        throw error;
    }
}

async function getCurrentUserInfo() {
    try {
        const response = await authenticatedRequest(`${API_BASE_URL}/users/me`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching current user info:', error);
        throw error;
    }
}

async function recordTaiXiuGame(betAmount, result, md5Hash) {
    try {
        const response = await authenticatedRequest(`${API_BASE_URL}/taixiu/game`, {
            method: 'POST',
            body: JSON.stringify({
                bet_amount: betAmount,
                result: result,
                md5_hash: md5Hash
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Update local user data with server response
        if (data.user) {
            saveUserSession(data.user);
        }

        return data;
    } catch (error) {
        console.error('Error recording TaiXiu game:', error);
        throw error;
    }
}

// New API functions for server-managed games
async function getActiveTaiXiuGame() {
    try {
        console.log('🔍 Making request to:', `${API_BASE_URL}/taixiu/active`);
        const response = await authenticatedRequest(`${API_BASE_URL}/taixiu/active`);
        console.log('🔍 Response status:', response.status);
        console.log('🔍 Response ok:', response.ok);

        if (response.status === 404) {
            console.log('No active game found (404)');
            return null; // No active game
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const gameData = await response.json();
        console.log('🔍 Parsed game data:', gameData);
        console.log('🔍 Game data game_id:', gameData?.game_id);
        console.log('🔍 Game data type:', typeof gameData);
        return gameData;
    } catch (error) {
        console.error('Error fetching active TaiXiu game:', error);
        // If it's a 404 error, return null instead of throwing
        if (error.message && error.message.includes('404')) {
            console.log('No active game found (404 error)');
            return null;
        }
        throw error;
    }
}

async function startNewTaiXiuGame(md5Hash) {
    try {
        const response = await authenticatedRequest(`${API_BASE_URL}/taixiu/start`, {
            method: 'POST',
            body: JSON.stringify({
                md5_hash: md5Hash
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error starting new TaiXiu game:', error);
        throw error;
    }
}

async function finishTaiXiuGame(gameId, result, taiBetAmount, xiuBetAmount) {
    try {
        const response = await authenticatedRequest(`${API_BASE_URL}/taixiu/games/${gameId}/finish`, {
            method: 'PUT',
            body: JSON.stringify({
                result: result,
                tai_bet_amount: taiBetAmount,
                xiu_bet_amount: xiuBetAmount
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error finishing TaiXiu game:', error);
        throw error;
    }
}

async function updateUserAfterGame(gameId, betType, betAmount, won) {
    try {
        const response = await authenticatedRequest(`${API_BASE_URL}/taixiu/user/update-after-game`, {
            method: 'POST',
            body: JSON.stringify({
                game_id: gameId,
                bet_type: betType,
                bet_amount: betAmount,
                won: won
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating user after game:', error);
        throw error;
    }
}

// Avatar function based on user role
function getUserAvatar(user) {
    if (!user || !user.role) {
        return 'https://api.dicebear.com/7.x/avataaars/svg?seed=52'; // Default member avatar
    }

    if (user.role.toLowerCase() === 'admin') {
        return 'https://api.dicebear.com/7.x/avataaars/svg?seed=56';
    } else {
        return 'https://api.dicebear.com/7.x/avataaars/svg?seed=52';
    }
}

// Get top users by current money
async function getTopUsers(page = 1, limit = 10) {
    try {
        const response = await authenticatedRequest(`${API_BASE_URL}/users/top-win?page=${page}&limit=${limit}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching top users:', error);
        throw error;
    }
}

// Get public game history for chart display
async function getPublicGameHistory(page = 1, pageSize = 10) {
    try {
        const response = await fetch(`${API_BASE_URL}/public/taixiu/history?page=${page}&page_size=${pageSize}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching public game history:', error);
        throw error;
    }
}

// Export functions for use in other scripts
window.auth = {
    login,
    register,
    logout,
    getCurrentUser,
    getAccessToken,
    isLoggedIn,
    clearUserSession,
    authenticatedRequest,
    checkAuthStatus,
    updateUserInfoDisplay,
    handleLogout,
    getTaiXiuStats,
    getCurrentUserInfo,
    recordTaiXiuGame,
    getActiveTaiXiuGame,
    startNewTaiXiuGame,
    finishTaiXiuGame,
    updateUserAfterGame,
    getUserAvatar,
    getTopUsers,
    getPublicGameHistory
};

// Make functions globally available
window.login = login;
window.register = register;
window.logout = logout;
window.handleLogout = handleLogout;
window.getUserAvatar = getUserAvatar;
window.getTopUsers = getTopUsers;
window.getPublicGameHistory = getPublicGameHistory;
