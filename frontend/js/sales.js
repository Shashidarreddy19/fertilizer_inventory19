// Sales Management JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const userId = localStorage.getItem('userId');
    if (!userId) {
        window.location.href = 'loginpage.html';
        return;
    }

    // Set default date
    document.getElementById('saleDate').value = new Date().toISOString().split('T')[0];

    // Load initial data
    try {
        await Promise.all([
            loadProducts(),
            loadCustomers(),
            loadSalesHistory()
        ]);

        // Setup daily statistics refresh
        setupDailyStatsRefresh();

        // Add event listeners
    setupEventListeners();
    } catch (error) {
        console.error('Error initializing page:', error);
        showToast('Error loading page data', 'error');
    }
});

function setupEventListeners() {
    // Add product button
    const addButton = document.querySelector('.btn-add');
    if (addButton) {
        addButton.addEventListener('click', addProductEntry);
    }

    // Calculate total button
    const calculateButton = document.querySelector('.btn-calculate');
    if (calculateButton) {
        calculateButton.addEventListener('click', calculateTotal);
    }

    // Form submission
    const salesForm = document.getElementById('salesForm');
    if (salesForm) {
        salesForm.addEventListener('submit', completeSale);
    }

    // Discount input
    const discountInput = document.getElementById('discount');
    if (discountInput) {
        discountInput.addEventListener('input', calculateTotal);
    }

    // Date range for sales history
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    if (startDateInput) {
        startDateInput.addEventListener('change', loadSalesHistory);
    }
    if (endDateInput) {
        endDateInput.addEventListener('change', loadSalesHistory);
    }

    // Export button
    const exportButton = document.querySelector('.btn-export');
    if (exportButton) {
        exportButton.addEventListener('click', exportSalesReport);
    }

    // Setup initial product entry listeners
    const initialProductEntry = document.querySelector('.product-entry');
    if (initialProductEntry) {
        setupProductEntryListeners(initialProductEntry);
    }

    // Add archive filter checkbox listener
    const archivedCheckbox = document.getElementById('showArchived');
    if (archivedCheckbox) {
        archivedCheckbox.addEventListener('change', loadSalesHistory);
    }
}

function setupProductEntryListeners(productEntry) {
    const productSelect = productEntry.querySelector('.product-select');
    const itemsInput = productEntry.querySelector('.items-input');
    const maxItems = productEntry.querySelector('.max-items');
    const quantityValue = productEntry.querySelector('.quantity-value');
    const quantityUnit = productEntry.querySelector('.quantity-unit');
    const priceInput = productEntry.querySelector('.price-input');
    const deleteBtn = productEntry.querySelector('.btn-delete');

    productSelect.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption.value) {
            const price = parseFloat(selectedOption.dataset.price) || 0;
            const unit = selectedOption.dataset.unit;
            const packageSize = parseFloat(selectedOption.dataset.packageSize) || 0;
            const maxStock = parseInt(selectedOption.dataset.numberItems) || 0;
            
            // Update max items display
            itemsInput.max = maxStock;
            itemsInput.min = 1;
            itemsInput.value = '';
            maxItems.textContent = `Max: ${maxStock}`;
            
            // Set unit and clear calculated quantity
            quantityUnit.textContent = unit;
            quantityValue.textContent = '0';
            
            // Update price input placeholder
            priceInput.placeholder = `₹${price.toFixed(2)}/${unit}`;
            
            calculateProductTotal(productEntry);
        } else {
            resetProductEntry(productEntry);
        }
    });

    itemsInput.addEventListener('input', function() {
        let value = parseInt(this.value) || 0;
        const max = parseInt(this.max) || 0;
        
        if (value < 1) {
            value = 1;
            this.value = 1;
        } else if (value > max) {
            value = max;
            this.value = max;
            showToast(`Maximum available items: ${max}`, 'warning');
        }
        
        // Calculate total quantity
        const selectedOption = productSelect.options[productSelect.selectedIndex];
        if (selectedOption.value) {
            const packageSize = parseFloat(selectedOption.dataset.packageSize) || 0;
            const totalQuantity = value * packageSize;
            quantityValue.textContent = totalQuantity.toFixed(2);
        }
        
        calculateProductTotal(productEntry);
    });
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (document.querySelectorAll('.product-entry').length > 1) {
                productEntry.remove();
                calculateTotal();
            } else {
                showToast('Cannot remove the last product entry', 'warning');
            }
        });
    }
}

function resetProductEntry(productEntry) {
    const itemsInput = productEntry.querySelector('.items-input');
    const maxItems = productEntry.querySelector('.max-items');
    const quantityValue = productEntry.querySelector('.quantity-value');
    const quantityUnit = productEntry.querySelector('.quantity-unit');
    const priceInput = productEntry.querySelector('.price-input');
    
    itemsInput.value = '';
    itemsInput.max = '';
    itemsInput.min = '1';
    maxItems.textContent = 'Max: 0';
    quantityValue.textContent = '0';
    quantityUnit.textContent = '';
    priceInput.value = '0.00';
    priceInput.placeholder = '₹0.00';
    
    calculateTotal();
}

function calculateProductTotal(productEntry) {
    const productSelect = productEntry.querySelector('.product-select');
    const itemsInput = productEntry.querySelector('.items-input');
    const priceInput = productEntry.querySelector('.price-input');
    
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    if (!selectedOption || !selectedOption.value) {
        priceInput.value = '0.00';
        return;
    }

    const sellingPrice = parseFloat(selectedOption.dataset.price) || 0;
    const packageSize = parseFloat(selectedOption.dataset.packageSize) || 0;
    const numberOfItems = parseInt(itemsInput.value) || 0;
    const maxItems = parseInt(itemsInput.max) || 0;
    
    // Calculate total quantity for display only
    const totalQuantity = numberOfItems * packageSize;
    const quantityValue = productEntry.querySelector('.quantity-value');
    quantityValue.textContent = totalQuantity.toFixed(2);
    
    // Calculate price based on number of items, not total quantity
    if (numberOfItems > maxItems) {
        showToast(`Maximum available items: ${maxItems}`, 'error');
        itemsInput.value = maxItems;
        const total = sellingPrice * maxItems;
        priceInput.value = total.toFixed(2);
    } else {
        const total = sellingPrice * numberOfItems;
        priceInput.value = total.toFixed(2);
    }
    
    calculateTotal();
}

async function loadDailyStatistics() {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            showToast('User not logged in. Please log in again.', 'error');
            window.location.href = 'loginpage.html';
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`${API_BASE_URL}/sales/daily-stats?userId=${userId}&date=${today}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch daily statistics');
        }
        
        const stats = await response.json();
        
        // Update statistics display
        document.getElementById('totalSales').textContent = stats.totalSales.toFixed(2);
        document.getElementById('totalItems').textContent = stats.totalItems.toFixed(2);
        document.getElementById('finalAmount').textContent = `₹${stats.finalAmount.toFixed(2)}`;

        // Update top products sold
        const productsList = document.getElementById('productsSold');
        if (productsList && Array.isArray(stats.topProducts)) {
            productsList.innerHTML = stats.topProducts
                .map(product => `
                    <div class="product-stat">
                        <span class="product-name">${product.name || 'Unknown Product'}</span>
                        <span class="product-quantity">${product.quantity.toFixed(2)} ${product.unit || ''}</span>
                    </div>
                `)
                .join('') || '<div class="no-products">No products sold today</div>';
        } else {
            productsList.innerHTML = '<div class="no-products">No products sold today</div>';
        }

    } catch (error) {
        console.error('Error loading daily statistics:', error);
        showToast('Failed to load daily statistics', 'error');
        
        // Set default values in case of error
        document.getElementById('totalSales').textContent = '0.00';
        document.getElementById('totalItems').textContent = '0.00';
        document.getElementById('finalAmount').textContent = '₹0.00';
        document.getElementById('productsSold').innerHTML = '<div class="no-products">No data available</div>';
    }
}

// Add auto-refresh for daily statistics
function setupDailyStatsRefresh() {
    // Initial load
    loadDailyStatistics();

    // Refresh every 5 minutes
    setInterval(loadDailyStatistics, 5 * 60 * 1000);

    // Also refresh when a new sale is completed
    document.addEventListener('saleCompleted', loadDailyStatistics);
}

async function loadCustomers() {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            showToast('User not logged in. Please log in again.', 'error');
            window.location.href = 'loginpage.html';
            return;
        }

        const response = await fetch(`/api/customers?userId=${userId}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch customers');
        }
        
        const customers = await response.json();
        const customerSelect = document.getElementById('customerName');
        
        if (!customerSelect) {
            throw new Error('Customer select element not found');
        }

        // Clear existing options
        customerSelect.innerHTML = '<option value="">Select customer</option>';
        
        // Add customer options with proper formatting
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = `${customer.name}${customer.phone ? ` (${customer.phone})` : ''}`;
            customerSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading customers:', error);
        showToast(error.message || 'Failed to load customers', 'error');
    }
}

async function loadProducts() {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            showToast('User not logged in. Please log in again.', 'error');
            window.location.href = 'loginpage.html';
            return;
        }

        const response = await fetch(`${API_BASE_URL}/stock?userId=${userId}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch products');
        }
        
        const products = await response.json();
        const productSelects = document.querySelectorAll('.product-select');
        
        if (products.length === 0) {
            showToast('No products available in stock', 'warning');
            return;
        }
        
        const productOptions = '<option value="">Select Product</option>' +
            products
                .filter(product => product.number_of_items > 0) // Only show products with stock
                .map(product => 
                    `<option value="${product.id}" 
                        data-price="${product.selling_price}"
                        data-number-items="${product.number_of_items}"
                        data-package-size="${product.package_size}"
                        data-unit="${product.quantity_unit}"
                    >${product.product_name} (Stock: ${product.number_of_items} items) - ₹${product.selling_price}/${product.quantity_unit}</option>`
                ).join('');
        
        productSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = productOptions;
            if (currentValue) {
                select.value = currentValue; // Preserve selected value if it exists
            }
        });
    } catch (error) {
        console.error('Error loading products:', error);
        showToast(error.message || 'Failed to load products', 'error');
    }
}

function addProductEntry() {
    const productsSection = document.querySelector('.products-section');
    const newEntry = document.querySelector('.product-entry').cloneNode(true);
    
    // Reset values
    newEntry.querySelector('.product-select').value = '';
    newEntry.querySelector('.items-input').value = '';
    newEntry.querySelector('.max-items').textContent = 'Max: 0';
    newEntry.querySelector('.quantity-value').textContent = '0';
    newEntry.querySelector('.quantity-unit').textContent = '';
    newEntry.querySelector('.price-input').value = '0.00';
    
    // Setup event listeners for the new entry
    setupProductEntryListeners(newEntry);
    
    // Add the new entry to the products section
    productsSection.appendChild(newEntry);

    // Load products for the new entry
    loadProducts();
}

function calculateTotal() {
    let total = 0;
    document.querySelectorAll('.product-entry').forEach(entry => {
        const priceInput = entry.querySelector('.price-input');
        const price = parseFloat(priceInput.value) || 0;
        total += price;
    });

    const totalPriceInput = document.getElementById('totalPrice');
    const discountInput = document.getElementById('discount');
    const finalPriceInput = document.getElementById('finalPrice');
    
    totalPriceInput.value = total.toFixed(2);
    
    const discount = parseFloat(discountInput.value) || 0;
    if (discount < 0) {
        discountInput.value = 0;
        showToast('Discount cannot be negative', 'warning');
    } else if (discount > 100) {
        discountInput.value = 100;
        showToast('Discount cannot exceed 100%', 'warning');
    }
    
    const finalPrice = total * (1 - discount / 100);
    finalPriceInput.value = finalPrice.toFixed(2);
}

async function completeSale(event) {
    event.preventDefault();
    
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            showToast('Please log in to complete the sale', 'error');
            return;
        }

        const products = [];
        let totalAmount = 0;

        // Collect product details
        document.querySelectorAll('.product-entry').forEach(entry => {
            const productSelect = entry.querySelector('.product-select');
            const itemsInput = entry.querySelector('.items-input');
            const priceInput = entry.querySelector('.price-input');

            if (productSelect.value && itemsInput.value && priceInput.value) {
                const selectedOption = productSelect.options[productSelect.selectedIndex];
                const numberOfItems = parseInt(itemsInput.value);
                const sellingPrice = parseFloat(selectedOption.dataset.price);
                const packageSize = parseFloat(selectedOption.dataset.packageSize) || 0;

                const product = {
                    product_id: parseInt(productSelect.value),
                    quantity: numberOfItems, // This is number of items, not total quantity
                    unit_price: sellingPrice, // This is price per item/package
                    total_quantity: numberOfItems * packageSize // For display/tracking only
                };
                
                if (isNaN(product.product_id) || isNaN(product.quantity) || isNaN(product.unit_price)) {
                    throw new Error('Invalid product data');
                }
                
                products.push(product);
                totalAmount += product.unit_price * product.quantity; // Price = items × selling_price
            }
        });

        if (products.length === 0) {
            showToast('Please add at least one product', 'error');
            return;
        }

        const payment_method = document.getElementById('paymentType').value;
        const customerId = document.getElementById('customerName').value;
        const discount = parseFloat(document.getElementById('discount').value) || 0;
        const finalAmount = parseFloat(document.getElementById('finalPrice').value) || 0;

        const response = await fetch(`${API_BASE_URL}/sales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'userId': userId
            },
            body: JSON.stringify({
                products,
                total_amount: totalAmount,
                payment_method: payment_method.toLowerCase(), // Ensure consistent casing
                customer_id: customerId || null,
                discount,
                final_amount: finalAmount,
                sale_date: document.getElementById('saleDate').value || new Date()
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to complete sale');
        }

        showToast('Sale completed successfully', 'success');
        resetForm();
        
        // Refresh displays
        await Promise.all([
            loadProducts(),
            loadSalesHistory(),
            loadDailyStatistics()
        ]);
    } catch (error) {
        console.error('Error completing sale:', error);
        showToast(error.message, 'error');
    }
}

function resetForm() {
    // Reset the form fields
    document.getElementById('salesForm').reset();
    
    // Reset product entries
    const productEntries = document.querySelectorAll('.product-entry');
    productEntries.forEach((entry, index) => {
        if (index === 0) {
            // Reset first entry instead of removing it
            const productSelect = entry.querySelector('.product-select');
            const itemsInput = entry.querySelector('.items-input');
            const maxItems = entry.querySelector('.max-items');
            const quantityValue = entry.querySelector('.quantity-value');
            const quantityUnit = entry.querySelector('.quantity-unit');
            const priceInput = entry.querySelector('.price-input');
            
            productSelect.value = '';
            itemsInput.value = '';
            maxItems.textContent = 'Max: 0';
            quantityValue.textContent = '0';
            quantityUnit.textContent = '';
            priceInput.value = '0.00';
        } else {
            // Remove additional entries
            entry.remove();
        }
    });

    // Reset the date to today
    document.getElementById('saleDate').value = new Date().toISOString().split('T')[0];
    
    // Reset payment type to default
    document.getElementById('paymentType').value = 'Cash';
    
    // Reset amounts
    document.getElementById('totalPrice').value = '0.00';
    document.getElementById('discount').value = '0';
    document.getElementById('finalPrice').value = '0.00';
    
    // Reload products to refresh stock quantities
    loadProducts();
}

async function loadSalesHistory() {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            showToast('User not logged in. Please log in again.', 'error');
            window.location.href = 'loginpage.html';
            return;
        }

        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const showArchived = document.getElementById('showArchived').checked;

        let url = `${API_BASE_URL}/sales`;
        const params = new URLSearchParams();
        params.append('userId', userId);
        
        if (startDate && endDate) {
            params.append('startDate', startDate);
            params.append('endDate', endDate);
        }
        params.append('includeArchived', showArchived);

        url += `?${params.toString()}`;
        console.log('Fetching sales from:', url);

        const response = await fetch(url, {
            headers: {
                'userId': userId
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch sales history');
        }
        
        const sales = await response.json();
        const salesList = document.getElementById('salesList');
        
        if (!sales || !Array.isArray(sales) || sales.length === 0) {
            salesList.innerHTML = `
                <tr>
                    <td colspan="9" class="no-data">
                        <div class="no-data-message">
                            <i class="fas fa-box-open"></i>
                            <p>No ${showArchived ? 'archived ' : ''}sales available</p>
                            ${startDate && endDate ? 
                                `<p class="date-range-info">No sales found between ${new Date(startDate).toLocaleDateString()} and ${new Date(endDate).toLocaleDateString()}</p>` 
                                : ''
                            }
                        </div>
                    </td>
                </tr>`;
            return;
        }

        salesList.innerHTML = sales.map(sale => {
            const saleId = sale.sale_id || sale.saleId;
            const customerId = sale.customer_id || sale.customerId;
            const customerName = sale.customer_name || sale.customerName;
            const saleDate = sale.sale_date || sale.saleDate;
            const finalAmount = sale.final_amount || sale.finalAmount;
            const discount = sale.discount || 0;
            const paymentType = sale.payment_type || sale.paymentType || 'N/A';
            const isArchived = sale.is_archived || sale.isArchived;
            
            const products = Array.isArray(sale.products) ? sale.products : [];
            const productNames = products.map(p => p.name || p.product_name).filter(Boolean);
            const productQuantities = products.map(p => p.quantity).filter(Boolean);

            return `
                <tr class="${isArchived ? 'archived-row' : ''}">
                    <td data-label="Customer ID">${customerId || 'N/A'}</td>
                    <td data-label="Customer Name">${customerName || 'N/A'}</td>
                    <td data-label="Date">${saleDate ? new Date(saleDate).toLocaleDateString() : 'N/A'}</td>
                    <td data-label="Products">${productNames.join(', ') || 'N/A'}</td>
                    <td data-label="Quantities">${productQuantities.join(', ') || 'N/A'}</td>
                    <td data-label="Discount">${parseFloat(discount).toFixed(2)}%</td>
                    <td data-label="Final Amount">₹${parseFloat(finalAmount).toFixed(2)}</td>
                    <td data-label="Payment Type"><span class="payment-type ${paymentType.toLowerCase()}">${paymentType}</span></td>
                    <td data-label="Actions" class="actions">
                        ${isArchived ? `
                            <button class="btn-unarchive" onclick="unarchiveSale(${saleId})">
                                <i class="fas fa-box-open"></i> Unarchive
                            </button>
                        ` : `
                            <button class="btn-archive" onclick="archiveSale(${saleId})">
                                <i class="fas fa-archive"></i> Archive
                            </button>
                        `}
                        <button class="btn-delete" onclick="deleteSale(${saleId})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading sales history:', error);
        showToast('Failed to load sales history', 'error');
        document.getElementById('salesList').innerHTML = `
            <tr>
                <td colspan="9" class="no-data">
                    <div class="no-data-message error">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Error loading sales data</p>
                        <p class="error-details">Please try again later</p>
                    </div>
                </td>
            </tr>`;
    }
}

async function exportSalesReport() {
    try {
        const userId = localStorage.getItem('userId');
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        const response = await fetch(
            `${API_BASE_URL}/sales/export?userId=${userId}&startDate=${startDate}&endDate=${endDate}`
        );
        
        if (!response.ok) throw new Error('Failed to export sales report');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-report-${startDate}-to-${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('Report exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting report:', error);
        showToast('Failed to export report', 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }, 100);
}

// Add CSS styles for daily statistics
const statsStyles = document.createElement('style');
statsStyles.textContent = `
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
    }

    .stat-box {
        padding: 1.5rem;
        border-radius: 8px;
        color: white;
    }

    .stat-box.blue { background-color: #2196F3; }
    .stat-box.green { background-color: #4CAF50; }
    .stat-box.purple { background-color: #9C27B0; }
    .stat-box.yellow { 
        background-color: #FFC107;
        color: #333;
    }

    .stat-box h3 {
        margin: 0 0 1rem 0;
        font-size: 1.1rem;
        font-weight: 500;
    }

    .stat-box p {
        margin: 0;
        font-size: 1.8rem;
        font-weight: 600;
    }

    .products-list {
        margin-top: 0.5rem;
    }

    .product-stat {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
        border-bottom: 1px solid rgba(0,0,0,0.1);
    }

    .product-stat:last-child {
        border-bottom: none;
    }

    .product-name {
        font-weight: 500;
    }

    .product-quantity {
        font-weight: 600;
    }

    .no-products {
        text-align: center;
        padding: 1rem 0;
        font-style: italic;
        color: #666;
    }
`;

document.head.appendChild(statsStyles);

// Add CSS styles for archive features
const archiveStyles = document.createElement('style');
archiveStyles.textContent = `
    .archived-row {
        background-color: #f8f9fa;
        color: #6c757d;
    }

    .archived-badge {
        background-color: #6c757d;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.8rem;
    }

    .actions {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
    }

    .btn-archive, .btn-delete {
        padding: 4px 8px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .btn-archive {
        background-color: #6c757d;
        color: white;
    }

    .btn-archive:hover {
        background-color: #5a6268;
    }

    .btn-delete {
        background-color: #dc3545;
        color: white;
    }

    .btn-delete:hover {
        background-color: #c82333;
    }

    .archive-filter {
        margin: 1rem 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .archive-filter input[type="checkbox"] {
        margin: 0;
    }
`;

document.head.appendChild(archiveStyles);

// Add CSS styles for no data message
const noDataStyles = document.createElement('style');
noDataStyles.textContent = `
    .no-data {
        text-align: center;
        padding: 2rem !important;
    }

    .no-data-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        color: #6c757d;
    }

    .no-data-message i {
        font-size: 3rem;
        margin-bottom: 0.5rem;
    }

    .no-data-message p {
        margin: 0;
        font-size: 1.1rem;
    }

    .no-data-message .date-range-info {
        font-size: 0.9rem;
        color: #888;
    }

    .no-data-message.error {
        color: #dc3545;
    }

    .no-data-message.error .error-details {
        font-size: 0.9rem;
        color: #6c757d;
    }
`;

document.head.appendChild(noDataStyles);

async function deleteSale(saleId) {
    try {
        if (!saleId || isNaN(parseInt(saleId))) {
            showToast('Invalid sale ID', 'error');
            return;
        }

        if (!confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
            return;
        }

        const userId = localStorage.getItem('userId');
        if (!userId) {
            showToast('User not logged in. Please log in again.', 'error');
            window.location.href = 'loginpage.html';
            return;
        }

        console.log('Deleting sale:', { saleId, userId }); // Debug log

        const response = await fetch(`${API_BASE_URL}/sales/${parseInt(saleId)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'userId': userId
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete sale');
        }

        showToast('Sale deleted successfully!', 'success');
        
        // Reload data after successful deletion
        await Promise.all([
            loadSalesHistory(),
            loadDailyStatistics(),
            loadProducts() // Reload products to update stock quantities
        ]);
    } catch (error) {
        console.error('Error deleting sale:', error);
        showToast(error.message || 'Failed to delete sale', 'error');
    }
}

async function archiveSale(saleId) {
    try {
        if (!saleId || isNaN(parseInt(saleId))) {
            showToast('Invalid sale ID', 'error');
            return;
        }

        if (!confirm('Are you sure you want to archive this sale?')) {
            return;
        }

        const userId = localStorage.getItem('userId');
        if (!userId) {
            showToast('User not logged in. Please log in again.', 'error');
            window.location.href = 'loginpage.html';
            return;
        }

        console.log('Archiving sale:', { saleId, userId }); // Debug log

        const response = await fetch(`${API_BASE_URL}/sales/${parseInt(saleId)}/archive`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'userId': userId
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to archive sale');
        }

        showToast('Sale archived successfully!', 'success');
        
        // Reload data after successful archival
        await Promise.all([
            loadSalesHistory(),
            loadDailyStatistics()
        ]);
    } catch (error) {
        console.error('Error archiving sale:', error);
        showToast(error.message || 'Failed to archive sale', 'error');
    }
}

async function unarchiveSale(saleId) {
    try {
        if (!saleId || isNaN(parseInt(saleId))) {
            showToast('Invalid sale ID', 'error');
            return;
        }

        if (!confirm('Are you sure you want to unarchive this sale?')) {
            return;
        }

        const userId = localStorage.getItem('userId');
        if (!userId) {
            showToast('User not logged in. Please log in again.', 'error');
            window.location.href = 'loginpage.html';
            return;
        }

        console.log('Unarchiving sale:', { saleId, userId }); // Debug log

        const response = await fetch(`${API_BASE_URL}/sales/${saleId}/unarchive`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'userId': userId
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to unarchive sale');
        }

        showToast('Sale unarchived successfully!', 'success');
        
        // Reload data after successful unarchival
        await Promise.all([
            loadSalesHistory(),
            loadDailyStatistics()
        ]);
    } catch (error) {
        console.error('Error unarchiving sale:', error);
        showToast(error.message || 'Failed to unarchive sale', 'error');
    }
} 