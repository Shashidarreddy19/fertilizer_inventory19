// Check authentication immediately when script loads
function checkAuth() {
    const userId = localStorage.getItem('userId');
    const lastAuthTime = localStorage.getItem('lastAuthTime');
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes

    if (!userId || !lastAuthTime) {
        window.location.href = 'loginpage.html';
        return false;
    }

    const currentTime = new Date().getTime();
    if (currentTime - parseInt(lastAuthTime) >= sessionTimeout) {
        // Clear session data and redirect
        localStorage.removeItem('userId');
        localStorage.removeItem('lastAuthTime');
        localStorage.removeItem('user');
        window.location.href = 'loginpage.html';
        return false;
    }

    return true;
}

// Immediately check auth when script loads
if (!checkAuth()) {
    throw new Error('Authentication required');
}

// Dashboard functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Profile section functionality
    const authButtons = document.getElementById('authButtons');
    const profileSection = document.getElementById('profileSection');
    const shopName = document.getElementById('shopName');
    const viewProfile = document.getElementById('viewProfile');
    const profileLogoutBtn = document.getElementById('logoutBtn');

    // Get user data
    const userId = localStorage.getItem('userId');
    const userData = localStorage.getItem('user');
    
    if (userId && userData) {
        try {
            const user = JSON.parse(userData);
            // Show profile section, hide auth buttons
            if (authButtons) authButtons.style.display = 'none';
            if (profileSection) {
                profileSection.style.display = 'flex';
                shopName.textContent = user.shop_name || 'My Shop';
            }

            // Initialize dashboard data
            await Promise.all([
                updateDashboardStats(),
                fetchStockData()
            ]);
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            showError('Error loading dashboard data. Please try again.');
            logout(); // Logout if there's an error with user data
        }
    } else {
        // Not logged in, redirect to login page
        window.location.href = 'loginpage.html';
        return;
    }

    // Handle profile dropdown
    const profileInfo = document.querySelector('.profile-info');
    const dropdown = document.querySelector('.profile-dropdown');
    
    if (profileInfo && dropdown) {
        profileInfo.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileSection.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }

    // Handle view profile
    if (viewProfile) {
        const modal = document.getElementById('profileModal');
        const closeModal = document.querySelector('.close-modal');
        const closeButton = document.querySelector('.btn-close');

        viewProfile.addEventListener('click', (e) => {
            e.preventDefault();
            const user = JSON.parse(localStorage.getItem('user'));
            
            // Update modal content
            document.getElementById('modalShopName').textContent = user.shop_name || 'N/A';
            document.getElementById('modalOwnerName').textContent = user.owner_name || 'N/A';
            document.getElementById('modalEmail').textContent = user.email || 'N/A';
            document.getElementById('modalPhone').textContent = user.phone || 'N/A';
            
            // Show modal
            modal.style.display = 'block';
            // Close dropdown
            document.querySelector('.profile-dropdown').classList.remove('show');
        });

        // Close modal when clicking the close button
        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Close modal when clicking the close button in footer
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Handle logout
    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});

function showError(message) {
    const errorContainer = document.getElementById('errorContainer') || createErrorContainer();
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.textContent = message;
    errorContainer.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Helper function to create error container if it doesn't exist
function createErrorContainer() {
    const container = document.createElement('div');
    container.id = 'errorContainer';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
    document.body.appendChild(container);
    return container;
}

// Fetch stock data for the logged-in user
async function fetchStockData() {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            throw new Error('User ID not found');
        }

        const response = await fetch(`${API_BASE_URL}/stock?userId=${userId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch stock data');
        }

        if (!Array.isArray(data)) {
            console.warn('Stock data is not an array:', data);
            return [];
        }

        renderSalesTable(data);
        return data;
    } catch (error) {
        console.error('Error fetching stock data:', error);
        showError('Unable to load stock data. Please try refreshing the page.');
        return [];
    }
}

// Update dashboard statistics
async function updateDashboardStats() {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            throw new Error('User ID not found');
        }

        // Define endpoints
        const endpoints = {
            stock: `${API_BASE_URL}/stock?userId=${userId}`,
            suppliers: `${API_BASE_URL}/suppliers?userId=${userId}`,
            orders: `${API_BASE_URL}/orders?userId=${userId}`,
            customers: `${API_BASE_URL}/customers?userId=${userId}`,
            credits: `${API_BASE_URL}/credit?userId=${userId}`,
            sales: `${API_BASE_URL}/sales?userId=${userId}`
        };

        // Initialize default stats
        let stats = {
            totalStock: 0,
            lowStock: 0,
            expiringSoon: 0,
            suppliers: 0,
            orders: 0,
            customers: 0,
            revenue: 0,
            credit: 0
        };

        // Fetch data sequentially to avoid overwhelming the server
        for (const [key, url] of Object.entries(endpoints)) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Error fetching ${key} data:`, errorData.error || 'Unknown error');
                    continue; // Skip this iteration but continue with others
                }
                
                const data = await response.json();

                // Process the data based on the endpoint
                switch (key) {
                    case 'stock':
                        if (Array.isArray(data)) {
                            stats.totalStock = data.length;
                            stats.lowStock = data.filter(item => item.quantity <= item.low_stock_threshold).length;
                            stats.expiringSoon = data.filter(item => {
                                if (!item.expiry_date) return false;
                                const expiryDate = new Date(item.expiry_date);
                                const thirtyDaysFromNow = new Date();
                                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                                return expiryDate <= thirtyDaysFromNow;
                            }).length;
                        }
                        break;
                    case 'suppliers':
                        stats.suppliers = Array.isArray(data) ? data.length : 0;
                        break;
                    case 'orders':
                        stats.orders = Array.isArray(data) ? data.length : 0;
                        break;
                    case 'customers':
                        stats.customers = Array.isArray(data) ? data.length : 0;
                        break;
                    case 'sales':
                        if (Array.isArray(data)) {
                            stats.revenue = data.reduce((total, sale) => {
                                const amount = parseFloat(sale.total_amount) || 0;
                                return total + amount;
                            }, 0);
                        }
                        break;
                    case 'credits':
                        if (Array.isArray(data)) {
                            stats.credit = data.reduce((total, credit) => {
                                const amount = parseFloat(credit.outstanding_credit) || 0;
                                return total + amount;
                            }, 0);
                        }
                        break;
                }
            } catch (error) {
                console.error(`Error processing ${key} data:`, error);
                showError(`Error loading ${key} data. Please try again later.`);
            }
        }

        // Update the UI with whatever data we were able to fetch
        updateStatCard('total-stock', `${stats.totalStock} Items`);
        updateStatCard('low-stock', `${stats.lowStock} Products`);
        updateStatCard('expiring-soon', `${stats.expiringSoon} Products`);
        updateStatCard('suppliers', `${stats.suppliers} Suppliers`);
        updateStatCard('orders', `${stats.orders} Orders`);
        updateStatCard('customers', `${stats.customers} Customers`);
        updateStatCard('sales', `₹${stats.revenue.toFixed(2)}`);
        updateStatCard('credit', `₹${stats.credit.toFixed(2)}`);

    } catch (error) {
        console.error('Error updating dashboard stats:', error);
        showError('Error updating dashboard. Some data may be unavailable.');
    }
}

// Helper function to update stat cards
function updateStatCard(cardId, value) {
    const card = document.querySelector(`[data-stat="${cardId}"] .stat-value`);
    if (card) {
        card.textContent = value;
    }
}

// Render the sales table
function renderSalesTable(stockData) {
    const tableBody = document.querySelector('#sales-table tbody');
    if (!tableBody) return;

    if (!Array.isArray(stockData)) {
        console.error('Invalid stock data:', stockData);
        return;
    }

    tableBody.innerHTML = stockData.map(item => `
        <tr data-stock-id="${item.id}">
            <td>${item.product_name}</td>
            <td>${item.category || 'N/A'}</td>
            <td>${item.quantity} ${item.quantity_unit || 'units'}</td>
            <td>
                <input type="number" class="quantity-input" 
                    min="1" max="${item.quantity}" 
                    onchange="calculateTotal(this)"
                    data-price="${item.selling_price || 0}">
            </td>
            <td>₹${item.selling_price || 0}</td>
            <td class="total">₹0.00</td>
            <td>
                <button onclick="updateStock(${item.id})" class="btn-update">Update</button>
            </td>
        </tr>
    `).join('');
}

// Calculate total for a row
function calculateTotal(input) {
    const row = input.closest('tr');
    const price = parseFloat(input.dataset.price) || 0;
    const quantity = parseFloat(input.value) || 0;
    const total = price * quantity;
    row.querySelector('.total').textContent = `₹${total.toFixed(2)}`;
}

// Update stock quantity
async function updateStock(stockId) {
    try {
        const row = document.querySelector(`tr[data-stock-id="${stockId}"]`);
        if (!row) {
            throw new Error('Row not found');
        }

        const quantityInput = row.querySelector('.quantity-input');
        const newQuantity = parseInt(quantityInput.value);
        const originalQuantity = parseInt(quantityInput.max);

        if (isNaN(newQuantity) || newQuantity < 0 || newQuantity > originalQuantity) {
            showError('Invalid quantity');
            return;
        }

        const userId = localStorage.getItem('userId');
        const response = await fetch(`${API_BASE_URL}/stock/${stockId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                quantity: originalQuantity - newQuantity
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update stock');
        }

        // Refresh the data
        await Promise.all([
            fetchStockData(),
            updateDashboardStats()
        ]);
        
        showError('Stock updated successfully');
    } catch (error) {
        console.error('Error updating stock:', error);
        showError(error.message || 'Failed to update stock');
    }
}

// Logout function
function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('lastAuthTime');
    localStorage.removeItem('user');
    window.location.href = 'loginpage.html';
}
