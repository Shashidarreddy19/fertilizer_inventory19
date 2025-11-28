// Customer Management JavaScript
let customersData = [];
let currentCustomerId = null;
// DOM Elements
let customersList;
let customerForm;
let searchInput;

// Initialize DOM elements after the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    customersList = document.getElementById('customersList');
    customerForm = document.getElementById('customerForm');
    searchInput = document.getElementById('searchCustomer');

    // Check if all required elements exist
    if (!customersList || !customerForm || !searchInput) {
        alert('Some required DOM elements are missing. Please check the HTML structure.');
        return;
    }

    // Initialize event listeners
    initializeEventListeners();

    // Load initial data
    loadCustomers();
});

// Initialize all event listeners
function initializeEventListeners() {
    // Form submission
    customerForm.addEventListener('submit', handleFormSubmit);

    // Search functionality
    searchInput.addEventListener('input', debounce(filterCustomers, 300));
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const customerData = {
        name: document.getElementById('customerName').value,
        phone: document.getElementById('phone').value,
        notes: document.getElementById('notes').value,
        address: document.getElementById('address').value,
        userId: getUserId()
    };
    
    try {
        if (currentCustomerId) {
            await updateCustomer(currentCustomerId, customerData);
            currentCustomerId = null;
        } else {
            await createCustomer(customerData);
        }
        customerForm.reset();
        document.querySelector('.btn-primary').innerHTML = '<i class="fas fa-plus"></i> Add Customer';
        loadCustomers();
    } catch (error) {
        console.error('Error saving customer:', error);
        alert('Error saving customer: ' + error.message);
    }
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

// Customer Card Rendering
function renderCustomersList(customers) {
    if (!customersList) return;

    customersList.innerHTML = '';
    
    if (customers.length === 0) {
        customersList.innerHTML = '<p class="no-data">No customers found</p>';
        return;
    }

    customers.forEach(customer => {
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.innerHTML = `
            <div class="customer-info">
                <h3>${customer.name}</h3>
                <p><i class="fas fa-phone"></i> ${customer.phone}</p>
                <p><i class="fas fa-sticky-note"></i> ${customer.notes || 'No notes'}</p>
                <p><i class="fas fa-map-marker-alt"></i> ${customer.address || 'N/A'}</p>
                <p><i class="fas fa-calendar"></i> Joined: ${formatDate(customer.createdAt)}</p>
            </div>
            <div class="purchase-history">
                <h4><i class="fas fa-history"></i> Recent Purchases</h4>
                <div class="history-content">
                    ${renderPurchaseHistory(customer.sales || [])}
                </div>
            </div>
            <div class="customer-actions">
                <button onclick="openEditCustomerModal('${customer.id}')" class="btn-edit">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deleteCustomer('${customer.id}')" class="btn-delete">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        customersList.appendChild(card);
    });
}

// Render purchase history
function renderPurchaseHistory(purchases) {
    if (!purchases || purchases.length === 0) {
        return '<p class="no-history">No purchase history available</p>';
    }

    return `
        <div class="purchase-list">
            ${purchases.slice(0, 3).map(purchase => `
                <div class="purchase-item">
                    <div class="purchase-header">
                        <span class="date">
                            <i class="fas fa-calendar"></i>
                            ${formatDate(purchase.date)}
                        </span>
                        <span class="type ${purchase.type === 'credit' ? 'credit' : 'direct'}">
                            ${purchase.type === 'credit' ? 
                                '<i class="fas fa-credit-card"></i> Credit' : 
                                '<i class="fas fa-money-bill"></i> Direct'}
                        </span>
                    </div>
                    <div class="purchase-details">
                        ${purchase.products.map(product => `
                            <div class="product-item">
                                <span class="product-name">${product.name}</span>
                                <span class="product-quantity">${product.quantity} ${product.unit}</span>
                                <span class="product-price">${formatCurrency(product.price)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="purchase-footer">
                        <span class="total">Total: ${formatCurrency(purchase.total)}</span>
                        ${purchase.type === 'credit' ? `
                            <span class="status ${purchase.status.toLowerCase()}">
                                ${purchase.status}
                            </span>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
            ${purchases.length > 3 ? `
                <div class="view-more">
                    <button onclick="viewAllPurchases('${purchases[0].customer_id}')" class="btn-secondary">
                        View All Purchases
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// View all purchases for a customer
async function viewAllPurchases(customerId) {
    try {
        const response = await fetch(`/api/customers/${customerId}/purchases?userId=${getUserId()}`);
        if (!response.ok) throw new Error('Failed to load purchase history');
        const purchases = await response.json();
        
        // Create and show modal with all purchases
        showPurchaseHistoryModal(customerId, purchases);
    } catch (error) {
        alert('Error loading purchase history: ' + error.message);
    }
}

// Show purchase history modal
function showPurchaseHistoryModal(customerId, purchases) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Purchase History</h3>
                <button class="close">&times;</button>
            </div>
            <div class="modal-body">
                ${renderPurchaseHistory(purchases)}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close modal when clicking close button or outside
    modal.querySelector('.close').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

async function loadCustomers() {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const response = await fetch(`${API_BASE_URL}/customers?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to load customers');
        const customers = await response.json();
        customersData = customers;
        renderCustomersList(customers);
    } catch (error) {
        alert('Failed to load customers. Please try again.');
    }
}

// Filter customers
function filterCustomers() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredCustomers = customersData.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm) ||
        customer.phone.includes(searchTerm) ||
        (customer.notes && customer.notes.toLowerCase().includes(searchTerm))
    );
    renderCustomersList(filteredCustomers);
}

// Helper function to get user ID
function getUserId() {
    return localStorage.getItem('userId');
}

// API Calls
async function createCustomer(customerData) {
    try {
        const response = await fetch(`${API_BASE_URL}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create customer');
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
}

// Alert handling
function showAlert(message, type = 'success') {
    const alertDiv = document.getElementById('alertDiv');
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show`;
    alertElement.role = 'alert';
    alertElement.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertDiv.appendChild(alertElement);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        alertElement.remove();
    }, 3000);
}

// Edit customer functionality
async function openEditCustomerModal(customerId) {
    try {
        currentCustomerId = customerId;
        const userId = localStorage.getItem('userId');
        const response = await fetch(`${API_BASE_URL}/customers/${customerId}?userId=${userId}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch customer data');
        }
        
        const customer = await response.json();
        
        // Populate form fields
        document.getElementById('editCustomerName').value = customer.name;
        document.getElementById('editCustomerPhone').value = customer.phone;
        document.getElementById('editCustomerAddress').value = customer.address || '';
        document.getElementById('editCustomerNotes').value = customer.notes || '';
        
        // Show modal
        const modal = document.getElementById('editCustomerModal');
        modal.style.display = 'block';
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

function closeEditModal() {
    const modal = document.getElementById('editCustomerModal');
    modal.style.display = 'none';
    currentCustomerId = null;
}

// Handle edit form submission
document.getElementById('editCustomerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentCustomerId) return;

    try {
        const customerData = {
            name: document.getElementById('editCustomerName').value,
            phone: document.getElementById('editCustomerPhone').value,
            address: document.getElementById('editCustomerAddress').value,
            notes: document.getElementById('editCustomerNotes').value,
            userId: localStorage.getItem('userId')
        };

        const response = await fetch(`${API_BASE_URL}/customers/${currentCustomerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(customerData)
        });

        if (!response.ok) {
            throw new Error('Failed to update customer');
        }

        showAlert('Customer updated successfully');
        closeEditModal();
        loadCustomers(); // Refresh the list
    } catch (error) {
        showAlert(error.message, 'danger');
    }
});

// Delete customer
async function deleteCustomer(customerId) {
    try {
        const result = await Swal.fire({
            title: 'Delete Customer?',
            text: "This will delete the customer and all their sales history. This action cannot be undone!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete everything',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) {
            return;
        }

        // Show loading state
        Swal.fire({
            title: 'Deleting...',
            text: 'Please wait while we delete the customer and related records',
            allowOutsideClick: false,
            allowEscapeKey: false,
            allowEnterKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const userId = localStorage.getItem('userId');
        if (!userId) {
            Swal.close();
            await Swal.fire({
                title: 'Error',
                text: 'You must be logged in to delete customers',
                icon: 'error'
            });
            return;
        }

        const response = await fetch(`${API_BASE_URL}/customers/${customerId}?userId=${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        }).catch(() => ({
            ok: true,
            json: async () => ({
                success: false,
                message: 'Network error occurred'
            })
        }));

        const data = await response.json().catch(() => ({
            success: false,
            message: 'Failed to process response'
        }));

        Swal.close();

        if (!data.success) {
            await Swal.fire({
                title: 'Cannot Delete',
                text: data.message,
                icon: 'error',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        await Swal.fire({
            title: 'Deleted Successfully',
            text: 'The customer and all related records have been deleted',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        // Silently reload customers list
        loadCustomers().catch(() => {});
    } catch {
        Swal.close();
        await Swal.fire({
            title: 'Error',
            text: 'Unable to process your request at this time',
            icon: 'error',
            confirmButtonColor: '#3085d6'
        });
    }
}

// Function to redirect to credits page with selected customer
function goToCredits(customerId) {
    const customer = customersData.find(c => c.id.toString() === customerId.toString());
    if (customer) {
        // Store selected customer in localStorage
        localStorage.setItem('selectedCustomer', JSON.stringify(customer));
        // Redirect to credits page
        window.location.href = '/credit';
    }
}

// Add credit button to customer actions
function renderCustomerActions(customer) {
    return `
        <div class="action-buttons">
            <button onclick="editCustomer(${customer.id})" class="btn-edit">✏️ Edit</button>
            <button onclick="goToCredits(${customer.id})" class="btn-credit">💳 New Credit</button>
            <button onclick="viewHistory(${customer.id})" class="btn-history">📋 History</button>
        </div>
    `;
}

// View customer's credit history
function viewHistory(customerId) {
    const creditHistory = JSON.parse(localStorage.getItem('creditHistory') || '{}');
    const history = creditHistory[customerId] || [];
    
    const historyHtml = history.length ? history.map(entry => `
        <tr>
            <td>${new Date(entry.date).toLocaleDateString()}</td>
            <td>₹${entry.amount}</td>
            <td><span class="status-badge status-${entry.status.toLowerCase()}">${entry.status}</span></td>
        </tr>
    `).join('') : '<tr><td colspan="3">No credit history found</td></tr>';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>Credit History</h2>
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${historyHtml}
                </tbody>
            </table>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';

    modal.querySelector('.close').onclick = () => {
        modal.style.display = 'none';
        modal.remove();
    };
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editCustomerModal');
    if (event.target === modal) {
        closeEditModal();
    }
}; 