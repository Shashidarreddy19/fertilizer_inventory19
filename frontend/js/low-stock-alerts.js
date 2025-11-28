// Function to fetch low stock alerts
async function fetchLowStockAlerts() {
    try {
        showLoading();
        const userId = localStorage.getItem('userId');
        
        if (!userId) {
            showError('User not logged in. Please log in again.');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/stock/low-stock-alerts?userId=${userId}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch low stock alerts');
        }

        const data = await response.json();
        if (!data || !data.alerts) {
            throw new Error('Invalid response format from server');
        }
        
        updateAlertsDisplay(data.alerts);
    } catch (error) {
        console.error('Error fetching low stock alerts:', error);
        showError(error.message || 'Failed to load low stock alerts');
    } finally {
        hideLoading();
    }
}

// Function to update the alerts display
function updateAlertsDisplay(alerts) {
    const container = document.getElementById('alerts-container');
    container.innerHTML = '';

    if (!alerts || alerts.length === 0) {
        container.innerHTML = `
            <div class="no-alerts">
                <i class="fas fa-check-circle"></i>
                <p>No low stock alerts at the moment</p>
            </div>
        `;
        return;
    }

    // Create alerts section
    const alertsSection = document.createElement('div');
    alertsSection.className = 'alerts-section';

    alerts.forEach(alert => {
        const alertCard = document.createElement('div');
        alertCard.className = 'alert-card';
        
        // Determine alert type and severity
        const isQuantityLow = alert.quantity <= alert.low_stock_threshold;
        const isItemsLow = alert.number_of_items <= alert.low_stock_threshold;
        const severity = (isQuantityLow && isItemsLow) ? 'critical' : 'warning';
        
        alertCard.innerHTML = `
            <div class="alert-header">
                <i class="fas fa-exclamation-triangle ${severity}"></i>
                <h3>${alert.product_name}</h3>
            </div>
            <div class="alert-details">
                <p><strong>Current Quantity:</strong> ${alert.quantity} ${alert.quantity_unit}</p>
                <p><strong>Current Items:</strong> ${alert.number_of_items}</p>
                <p><strong>Category:</strong> ${alert.category}</p>
                <p><strong>Threshold:</strong> ${alert.low_stock_threshold}</p>
                <p><strong>Last Updated:</strong> ${new Date(alert.updated_at).toLocaleDateString()}</p>
            </div>
            <div class="alert-actions">
                <button onclick="viewProductDetails('${alert.id}')" class="btn-details">
                    <i class="fas fa-info-circle"></i> View Details
                </button>
            </div>
        `;
        
        alertsSection.appendChild(alertCard);
    });

    container.appendChild(alertsSection);
}

// Utility functions
function showLoading() {
    const container = document.getElementById('alerts-container');
    container.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading alerts...</p>
        </div>
    `;
}

function hideLoading() {
    // Loading state is automatically hidden when content is updated
}

function showError(message) {
    const container = document.getElementById('alerts-container');
    container.innerHTML = `
        <div class="error">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
        </div>
    `;
}

// Function to view product details
function viewProductDetails(productId) {
    window.location.href = `total-stock.html?productId=${productId}`;
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch of alerts
    fetchLowStockAlerts();
    
    // Add event listener to refresh button
    const refreshButton = document.querySelector('.refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', fetchLowStockAlerts);
    }
}); 