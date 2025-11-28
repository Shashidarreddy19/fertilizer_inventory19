// =====================
// Global Variables
// =====================
let isEditing = false;
let currentOrderId = null;
let currentOrders = []; // Store fetched orders

// =====================
// Run on Page Load
// =====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            return redirectToLogin();
        }

        await fetchSuppliers();
        await fetchOrders();
        setupEventListeners();
    } catch (error) {
        alert('Error initializing page. Please refresh.');
    }
});

// =====================
// Setup Event Listeners
// =====================
function setupEventListeners() {
    document.getElementById('order-form')?.addEventListener('submit', handleOrder);
    document.getElementById('apply-filters')?.addEventListener('click', applyFilters);
    document.getElementById('reset-filters')?.addEventListener('click', resetFilters);
    document.getElementById('cancel-button')?.addEventListener('click', resetForm);

    // Add event listener for edit buttons using event delegation
    document.getElementById('orders-table-body')?.addEventListener('click', handleTableActions);
}

function handleTableActions(event) {
    const target = event.target;
    const button = target.closest('button'); // Find the closest button element

    if (!button) return; // Exit if the click wasn't on or inside a button

    if (button.classList.contains('btn-edit')) {
        const orderId = button.dataset.orderId;
        if (orderId) {
            handleEditClick(orderId);
        }
    } 
    // Could add handling for delete button here too if we remove its onclick
    // else if (button.classList.contains('btn-delete')) { ... }
}

function handleEditClick(orderId) {
    const orderToEdit = currentOrders.find(order => order.id === parseInt(orderId));
    if (orderToEdit) {
        editOrder(orderToEdit);
    } else {
        console.error('Order not found for ID:', orderId);
        alert('Could not find the order details to edit. Please refresh.');
    }
}

// =====================
// Orders
// =====================
async function fetchOrders() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        redirectToLogin();
        return;
    }

    try {
        console.log('Fetching orders for userId:', userId); // Debug log

        const response = await fetch(`${API_BASE_URL}/orders?userId=${userId}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Raw response data:', data); // Debug log

        if (!Array.isArray(data)) {
            console.error('Invalid data format received:', data);
            currentOrders = [];
            renderTable([]);
            return [];
        }

        // Sort orders by date (newest first)
        const sortedOrders = data.sort((a, b) => {
            const dateA = new Date(a.order_date);
            const dateB = new Date(b.order_date);
            return dateB - dateA;
        });

        console.log('Sorted orders:', sortedOrders); // Debug log
        currentOrders = sortedOrders;
        renderTable(currentOrders);
        return currentOrders;
    } catch (error) {
        console.error('Error fetching orders:', error);
        alert(error.message || 'Error loading orders. Please try refreshing the page.');
        currentOrders = [];
        renderTable([]);
        return [];
    }
}

async function handleOrder(event) {
    event.preventDefault();
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
        redirectToLogin();
        return;
    }

    const formData = {
        userId,
        supplierId: document.getElementById('supplier').value,
        productName: document.getElementById('product-name').value.trim(),
        quantity: parseFloat(document.getElementById('quantity').value),
        quantityUnit: document.getElementById('quantity-unit').value,
        numberOfItems: parseInt(document.getElementById('number-of-items').value),
        orderDate: document.getElementById('order-date').value,
        status: document.getElementById('status').value
    };

    // Validate form data
    if (!formData.supplierId) {
        alert('Please select a supplier');
        document.getElementById('supplier').focus();
        return;
    }

    if (!formData.productName) {
        alert('Please enter a product name');
        document.getElementById('product-name').focus();
        return;
    }

    if (!formData.quantity || formData.quantity <= 0) {
        alert('Please enter a valid quantity');
        document.getElementById('quantity').focus();
        return;
    }

    if (!formData.numberOfItems || formData.numberOfItems <= 0) {
        alert('Please enter a valid number of items');
        document.getElementById('number-of-items').focus();
        return;
    }

    try {
        const endpoint = isEditing ? 
            `${API_BASE_URL}/orders/${currentOrderId}` : 
            `${API_BASE_URL}/orders`;

        const response = await fetch(endpoint, {
            method: isEditing ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to save order');
        }

        alert(result.message || (isEditing ? 'Order updated successfully!' : 'Order added successfully!'));
        resetForm();
        await fetchOrders(); // Refresh the table after adding/updating
    } catch (error) {
        console.error('Error in handleOrder:', error);
        alert(error.message || 'An error occurred while saving the order');
    }
}

function renderTable(orders) {
    console.log('Rendering table with orders:', orders); // Debug log
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) {
        console.error('Table body element not found');
        return;
    }

    // Clear existing content
    tableBody.innerHTML = '';

    if (!Array.isArray(orders) || orders.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4 text-gray-500 italic">
                    No orders found. Add your first order using the form above.
                </td>
            </tr>`;
        return;
    }

    orders.forEach((order, index) => {
        try {
            console.log('Rendering order:', order); // Debug log
            const row = document.createElement('tr');
            const formattedDate = formatDate(order.order_date);
            const statusClass = getStatusClass(order.status);

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHtml(order.supplier_name || 'N/A')}</td>
                <td>${escapeHtml(order.product_name || '')}</td>
                <td class="text-right">${order.quantity || 0}</td>
                <td>${escapeHtml(order.quantity_unit || '')}</td>
                <td class="text-right">${order.number_of_items || 0}</td>
                <td>${formattedDate}</td>
                <td><span class="status-badge ${statusClass}">${escapeHtml(order.status || 'Pending')}</span></td>
                <td class="text-center">
                    <button class="btn-edit" data-order-id="${order.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-delete" onclick="deleteOrder(${order.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>`;
            tableBody.appendChild(row);
        } catch (error) {
            console.error('Error rendering order row:', error, order);
        }
    });
}

// =====================
// Filters
// =====================
async function applyFilters() {
    const supplierInput = document.getElementById('search-supplier');
    const statusInput = document.getElementById('filter-status');

    const orders = await fetchOrders();
    const filtered = orders.filter(order => {
        const matchSupplier = !supplierInput.value || order.supplier_name?.toLowerCase().includes(supplierInput.value.toLowerCase());
        const matchStatus = !statusInput.value || order.status === statusInput.value;
        return matchSupplier && matchStatus;
    });

    renderTable(filtered);
}

async function resetFilters() {
    document.getElementById('search-supplier').value = '';
    document.getElementById('filter-status').value = '';
    await fetchOrders();
}

// =====================
// Suppliers
// =====================
async function fetchSuppliers() {
    const userId = localStorage.getItem('userId');
    if (!userId) return redirectToLogin();

    try {
        const response = await fetch(`${API_BASE_URL}/suppliers?userId=${userId}`);
        const suppliers = await response.json();

        if (!Array.isArray(suppliers)) throw new Error('Invalid supplier data received');
        populateSupplierDropdown(suppliers);
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        alert('Failed to load suppliers. Please refresh the page.');
    }
}

function populateSupplierDropdown(suppliers) {
    const dropdown = document.getElementById('supplier');
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">Select Supplier</option>';

    suppliers.sort((a, b) => (a.name || a.supplier_name).localeCompare(b.name || b.supplier_name)).forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = supplier.name || supplier.supplier_name || 'Unnamed Supplier';
        dropdown.appendChild(option);
    });
}

// =====================
// Edit/Delete/Reset
// =====================
function editOrder(order) {
    try {
        isEditing = true;
        currentOrderId = order.id;

        // Populate form with order data
        document.getElementById('supplier').value = order.supplier_id || '';
        document.getElementById('product-name').value = order.product_name || '';
        document.getElementById('quantity').value = order.quantity || '';
        document.getElementById('quantity-unit').value = order.quantity_unit || '';
        document.getElementById('number-of-items').value = order.number_of_items || '';
        document.getElementById('order-date').value = order.order_date?.split('T')[0] || '';
        document.getElementById('status').value = order.status || 'Pending';

        // Update UI
        document.getElementById('form-title').textContent = 'Edit Order';
        document.getElementById('submit-button').innerHTML = '<i class="fas fa-save"></i> Update Order';
        document.getElementById('cancel-button').style.display = 'inline-block';

        // Scroll to form
        document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error in editOrder:', error);
        alert('Failed to load order data for editing. Please try again.');
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
        redirectToLogin();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}?userId=${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to delete order');
        }

        alert(result.message || 'Order deleted successfully');
        await fetchOrders();
    } catch (error) {
        console.error('Error deleting order:', error);
        alert(error.message || 'Failed to delete order. Please try again.');
    }
}

function resetForm() {
    isEditing = false;
    currentOrderId = null;
    
    // Reset form fields
    document.getElementById('supplier').value = '';
    document.getElementById('product-name').value = '';
    document.getElementById('quantity').value = '';
    document.getElementById('quantity-unit').value = 'kg';
    document.getElementById('number-of-items').value = '';
    document.getElementById('order-date').value = '';
    document.getElementById('status').value = 'Pending';

    // Reset UI
    document.getElementById('form-title').textContent = 'Add New Order';
    document.getElementById('submit-button').innerHTML = '<i class="fas fa-plus"></i> Add Order';
    document.getElementById('cancel-button').style.display = 'none';
}

// =====================
// Utility
// =====================
function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

function getStatusClass(status) {
    switch (status?.toLowerCase()) {
        case 'delivered': return 'status-delivered';
        case 'shipped': return 'status-shipped';
        case 'pending': return 'status-pending';
        case 'cancelled': return 'status-cancelled';
        default: return 'status-default'; // Fallback for any other status
    }
}

function escapeHtml(unsafe) {
    return unsafe?.toString().replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;') || '';
}

function redirectToLogin() {
    alert('Please log in again.');
    window.location.href = 'loginpage.html';
}

function goToDashboard() {
    window.location.href = 'dashboard.html';
}