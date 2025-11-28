// Global variables
let customers = [];
let products = [];
let selectedCredit = null;

// Add at the top of the file, after the global variables
const creditCache = new Map();
const pendingRequests = new Map();
const notFoundCache = new Set();
let debounceTimers = new Map();

// Add these variables at the top with other global variables
let searchTimeout = null;
let currentEditCreditId = null;

// Add this function at the top with other global variables
let currentCredits = [];

// Add this at the top of the file
let currentCreditId = null;

// Add this variable at the top with other global variables
let selectedCreditId = null;

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize credit date with today's date
    const creditDateInput = document.getElementById('creditDate');
    if (creditDateInput) {
        const today = new Date().toISOString().split('T')[0];
        creditDateInput.value = today;
    }

    // Initialize forms
    const creditForm = document.getElementById('creditForm');
    const editForm = document.getElementById('editForm');

    if (creditForm) {
        creditForm.addEventListener('submit', handleCreditSubmit);
    }

    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }

    // Initialize product lists
    const productList = document.getElementById('productList');
    const editProductList = document.getElementById('editProductList');

    // Add initial product row if needed
    if (productList && productList.children.length === 0) {
        addProductRow();
    }

    // Add product button handlers
    const addProductButton = document.getElementById('addProduct');
    const editAddProductButton = document.getElementById('editAddProduct');

    if (addProductButton) {
        addProductButton.addEventListener('click', () => {
            addProductRow();
        });
    }

    if (editAddProductButton) {
        editAddProductButton.addEventListener('click', () => {
            addEditProductRow(editProductList);
        });
    }

    // Initialize modal close buttons
    const closeButtons = document.querySelectorAll('.modal .close');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                if (modal.id === 'editModal') {
                    const editProductList = modal.querySelector('#editProductList');
                    if (editProductList) {
                        editProductList.innerHTML = '';
                    }
                }
            }
        });
    });

    // Load initial data
    fetchCustomers();
    loadCreditTransactions();

    // Add search functionality event listeners
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    if (searchInput) {
        // Search on input change with debounce
        searchInput.addEventListener('input', () => {
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            searchTimeout = setTimeout(handleSearch, 300);
        });

        // Search on Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });

        // Clear search
        searchInput.addEventListener('search', () => {
            if (!searchInput.value) {
                loadCreditTransactions(); // Reset to show all credits
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearch);
    }

    // Initial load of credit transactions
    loadCreditTransactions();
});

// Helper function to get user ID
function getUserId() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        showErrorMessage('User ID not found. Please log in again.');
        return null;
    }
    return userId;
}

// Helper function to fetch credit details
async function fetchCreditDetails(creditId) {
    const userId = getUserId();
    if (!userId) throw new Error('User ID not found');

    const response = await fetch(`${API_BASE_URL}/credit/${creditId}?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch credit details');

    return await response.json();
}

// Get selected customer from localStorage if coming from customers page
function getSelectedCustomer() {
    const customerSelect = document.getElementById('customerName'); // fix this line
    if (!customerSelect || !customerSelect.value || customerSelect.value === 'Select') {
            return null;
        }
    return {
        id: customerSelect.value,
        name: customerSelect.options[customerSelect.selectedIndex].text
    };
}

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the page
    fetchCustomers().then(() => {
        const selectedCustomer = getSelectedCustomer();
        if (selectedCustomer) {
            const customerSelect = document.getElementById('customerName');
            if (customerSelect) {
                customerSelect.value = selectedCustomer.customer_id;
                handleCustomerChange({ target: customerSelect });
            }
        }
    });
    
    fetchProducts().then(() => {
        // Initialize first product row calculations
        const firstRow = document.querySelector('.product-row');
        if (firstRow) {
            const productSelect = firstRow.querySelector('.product-select');
            const quantityInput = firstRow.querySelector('.quantity');
            const removeBtn = firstRow.querySelector('.remove-product');
            
            if (productSelect) productSelect.addEventListener('change', handleProductChange);
            if (quantityInput) quantityInput.addEventListener('input', calculateTotalAmount);
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    if (document.querySelectorAll('.product-row').length > 1) {
                        firstRow.remove();
                        calculateTotalAmount();
                    }
                });
            }
        }
    });
    
    loadCreditTransactions();
  
    // Event Listeners - Add null checks
    const customerNameSelect = document.getElementById('customerName');
    const addProductBtn = document.getElementById('addProduct');
    const calculateBalanceBtn = document.getElementById('calculateBalance');
    const paymentForm = document.getElementById('paymentForm');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const exportBtn = document.getElementById('exportBtn');
    const editAddProductBtn = document.getElementById('editAddProduct');
    const interestRateInput = document.getElementById('interestRate');
    const partialPaymentInput = document.getElementById('partialPayment');

    if (customerNameSelect) customerNameSelect.addEventListener('change', handleCustomerChange);
    if (addProductBtn) addProductBtn.addEventListener('click', addProductRow);
    if (calculateBalanceBtn) calculateBalanceBtn.addEventListener('click', calculateBalance);
    if (paymentForm) paymentForm.addEventListener('submit', handlePaymentSubmit);
    
    // Close modal buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.onclick = function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                if (this.closest('#editModal')) {
                    currentEditCreditId = null;
                    if (editForm) editForm.reset();
                }
            }
        };
    });

    // Add these new event listeners with null checks
    if (interestRateInput) interestRateInput.addEventListener('input', calculateBalance);
    if (partialPaymentInput) {
        partialPaymentInput.value = '0.00';
        partialPaymentInput.addEventListener('input', handlePartialPaymentInput);
        partialPaymentInput.addEventListener('focus', function(e) {
            if (e.target.value === '0.00') {
                e.target.value = '';
            }
        });
        partialPaymentInput.addEventListener('blur', function(e) {
            if (e.target.value === '') {
                e.target.value = '0.00';
            }
        });
    }

    // Add event listeners with null checks
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });
        searchInput.addEventListener('search', () => {
            if (!searchInput.value) {
                loadCreditTransactions(); // Reset to show all credits
            }
        });
    }
    
    if (searchBtn) searchBtn.addEventListener('click', handleSearch);
    if (editAddProductBtn) editAddProductBtn.addEventListener('click', addEditProductRow);
    
    // Export button event listener with proper error handling
    if (exportBtn) {
        exportBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                // Show loading state
                exportBtn.textContent = 'Exporting...';
                exportBtn.disabled = true;

                await exportToExcel();

                // Reset button state
                exportBtn.textContent = 'Export History';
                exportBtn.disabled = false;
            } catch (error) {
                console.error('Error during export:', error);
                alert('Failed to export data. Please try again.');
                
                // Reset button state on error
                exportBtn.textContent = 'Export History';
                exportBtn.disabled = false;
            }
        });
    }

    // Set up event listeners for existing product rows
    document.querySelectorAll('.product-row').forEach(row => {
        const numberInput = row.querySelector('.number-of-items');
        if (numberInput) {
            ['input', 'change'].forEach(eventType => {
                numberInput.addEventListener(eventType, handleNumberInputChange);
            });
        }
    });
});

// Fetch Customers
  async function fetchCustomers() {
    try {
        const userId = getUserId();
        const response = await fetch(`/api/customers?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch customers');
        const data = await response.json();
        customers = Array.isArray(data) ? data : [];
        
        // Debug log to check customers data
        console.log('Fetched customers:', customers);
        
        const select = document.getElementById('customerName');
        if (!select) {
            console.error('Customer select element not found');
            return;
        }

        // Clear existing options
        select.innerHTML = '<option value="">Select Customer</option>';
        
        // Add customer options
    customers.forEach(customer => {
      const option = document.createElement('option');
            option.value = customer.id || customer.customer_id;
            option.textContent = `${customer.name || customer.customer_name} (ID: ${customer.id || customer.customer_id})`;
            option.dataset.creditScore = customer.credit_score || 'N/A';
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error fetching customers:', error);
        alert('Failed to load customers. Please try again.');
    }
}

// Fetch Products
async function fetchProducts() {
    try {
        const userId = getUserId();
        const response = await fetch(`${API_BASE_URL}/stock?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch products');
        const data = await response.json();
        products = Array.isArray(data) ? data : [];
        updateProductSelects();
    } catch (error) {
        console.error('Error fetching products:', error);
        alert('Failed to load products. Please try again.');
    }
}

// Update Product Selects
function updateProductSelects() {
    const productRows = document.querySelectorAll('.product-row');
    productRows.forEach(row => {
        const select = row.querySelector('.product-select');
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Select Product</option>';
            products.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id || p.product_id;
                option.textContent = p.product_name || p.name;
                select.appendChild(option);
            });
            if (currentValue) select.value = currentValue;
        }
    });
}

// Handle Customer Change
function handleCustomerChange(event) {
    if (!event || !event.target) return;

    const customerSelect = event.target;
    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    
    if (!selectedOption) return;

    const customerIdInput = document.getElementById('customerId');
    const customerNameInput = document.getElementById('customerName');

    if (customerIdInput) {
        customerIdInput.value = selectedOption.dataset.customerId || selectedOption.value || '';
    }

    if (customerNameInput && customerNameInput !== customerSelect) {
        customerNameInput.value = selectedOption.textContent.trim();
    }
}

// Handle Product Change - Auto-load price and update calculations
async function handleProductChange(e) {
    const row = e.target.closest('.product-row');
    const productId = e.target.value;
    const userId = getUserId();

    if (!productId || !userId || !row) {
        console.warn('Invalid product change event', { productId, userId, row });
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/stock/${productId}?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch product details');
        
        const product = await response.json();
        console.log('Product details:', product);

        const unitSelect = row.querySelector('.unit-select');
        const priceInput = row.querySelector('.price-per-unit');
        const numberInput = row.querySelector('.number-of-items');

        // Update unit
        if (unitSelect) {
            unitSelect.value = product.quantity_unit || 'units';
            unitSelect.disabled = false;
        }

        // Set price if not manually entered
        if (priceInput) {
            priceInput.value = parseFloat(product.selling_price || 0).toFixed(2);
        }

        // Set default quantity if empty
        if (numberInput && !numberInput.value) {
            numberInput.value = "1";
        }

        // Calculate new total
        calculateRowTotal(row);

    } catch (error) {
        console.error('Error fetching product details:', error);
        showErrorMessage('Failed to load product details');
    }
}

// Calculate row total with proper input handling
function calculateRowTotal(row) {
    if (!row) return;

    const numberInput = row.querySelector('.number-of-items');
    const priceInput = row.querySelector('.price-per-unit');
    const totalPrice = row.querySelector('.total-price');

    if (!numberInput || !priceInput || !totalPrice) return;

    const quantity = parseInt(numberInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const total = quantity * price;

    // Update total price with 2 decimal places
    totalPrice.value = total.toFixed(2);
    
    // Calculate overall balance
    calculateBalance();
}

// Calculate overall balance from all rows
function calculateBalance() {
    try {
        const rows = document.querySelectorAll('.product-row');
        let totalAmount = 0;

        rows.forEach(row => {
            const totalPrice = parseFloat(row.querySelector('.total-price').value) || 0;
            totalAmount += totalPrice;
        });

        // Update credit amount field
        const creditAmountInput = document.getElementById('creditAmount');
        if (creditAmountInput) {
            creditAmountInput.value = totalAmount.toFixed(2);
        }

        // Update outstanding balance
        const outstandingInput = document.getElementById('outstandingBalance');
        if (outstandingInput) {
            outstandingInput.value = totalAmount.toFixed(2);
        }

        return totalAmount;
    } catch (error) {
        console.error('Error calculating balance:', error);
        return 0;
    }
}

// Handle number input changes
function handleNumberInputChange(e) {
    const row = e.target.closest('.product-row');
    if (!row) return;
    
    // Ensure the number is positive
    const value = parseFloat(e.target.value) || 0;
    if (value < 0) {
        e.target.value = 0;
    }
    
    console.log('Number input changed:', e.target.value);
    calculateRowTotal(row);
    updateCreditAmount();
    calculateBalance();
}

// Handle price per unit changes
function handlePriceChange(e) {
    const row = e.target.closest('.product-row');
    if (row) {
        calculateRowTotal(row);
    }
}

function updateCreditAmount() {
    try {
        const rows = document.querySelectorAll('.product-row');
        let totalCreditAmount = 0;
        
        rows.forEach(row => {
            const totalPrice = parseFloat(row.querySelector('.total-price').value) || 0;
            totalCreditAmount += totalPrice;
            
            // Log individual row totals for debugging
            console.log('Row total:', { 
                rowElement: row,
                totalPrice: totalPrice 
            });
        });
        
        console.log('Total credit amount:', totalCreditAmount);
        
        // Update credit amount field
        const creditAmountInput = document.getElementById('creditAmount');
        if (creditAmountInput) {
            creditAmountInput.value = totalCreditAmount.toFixed(2);
        }
        
        // Update outstanding balance
        const outstandingInput = document.getElementById('outstandingBalance');
        if (outstandingInput) {
            outstandingInput.value = totalCreditAmount.toFixed(2);
        }

        // Update partial payment max if needed
        const partialPaymentInput = document.getElementById('partialPayment');
        if (partialPaymentInput) {
            partialPaymentInput.max = totalCreditAmount;
        }

        return totalCreditAmount;
    } catch (error) {
        console.error('Error updating credit amount:', error);
        return 0;
    }
}

function calculateTotalAmount() {
    try {
        const rows = document.querySelectorAll('.product-row');
        let total = 0;

        rows.forEach(row => {
            const totalPrice = parseFloat(row.querySelector('.total-price')?.value) || 0;
            total += totalPrice;
        });

        // Update credit amount field
        const creditAmountInput = document.getElementById('creditAmount');
        if (creditAmountInput) {
            creditAmountInput.value = total.toFixed(2);
        }

        return total;
    } catch (error) {
        console.error('Error calculating total amount:', error);
        return 0;
    }
}

// Update payment status based on balance and payments
function updatePaymentStatus(outstandingBalance, partialPayment) {
    const statusSelect = document.getElementById('creditStatus');
    const totalAmount = outstandingBalance + partialPayment;

    if (outstandingBalance <= 0) {
        statusSelect.value = 'Pending';
    } else if (partialPayment > 0) {
        statusSelect.value = 'Partially Paid';
    } else {
        statusSelect.value = 'Pending';
    }
}

// Update display of all monetary fields
function updateFieldsDisplay(creditAmount, interestAmount, partialPayment, outstandingBalance) {
    const creditAmountField = document.getElementById('creditAmount');
    const outstandingBalanceField = document.getElementById('outstandingBalance');
    const partialPaymentField = document.getElementById('partialPayment');

    creditAmountField.value = creditAmount.toFixed(2);
    outstandingBalanceField.value = outstandingBalance.toFixed(2);
    
    // Only update partial payment if it's empty or 0
    if (!partialPaymentField.value || parseFloat(partialPaymentField.value) === 0) {
        partialPaymentField.value = '0.00';
    }
}

// Handle Credit Submit
async function handleCreditSubmit(event) {
    try {
        event.preventDefault();
        
        const userId = getUserId();
        if (!userId) {
            showErrorMessage('User ID not found. Please log in again.');
            return;
        }

        // Get customer details
        const customerSelect = document.getElementById('customerName');
        if (!customerSelect || !customerSelect.value) {
            showErrorMessage('Please select a customer');
            return;
        }

        // Gather product data
        const products = gatherProductData();
        if (products.length === 0) {
            showErrorMessage('Please add at least one product with valid details');
            return;
        }

        // Validate number of items
        const invalidProducts = products.filter(p => !p.number_of_items || p.number_of_items <= 0);
        if (invalidProducts.length > 0) {
            showErrorMessage('Please enter valid number of items for all products');
            return;
        }

        // Get other form values
        const interestRate = parseFloat(document.getElementById('interestRate').value) || 0;
        const notes = document.getElementById('creditNotes').value || '';
        const partialPayment = parseFloat(document.getElementById('partialPayment').value) || 0;
        const creditDate = document.getElementById('creditDate').value || null;

        // Prepare credit data
        const creditData = {
            customerId: customerSelect.value,
            userId: userId,
            products: products,
            interest_rate: interestRate,
            notes: notes,
            partial_payment: partialPayment,
            creditDate: creditDate
        };

        // Show loading state
        const submitButton = event.target.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Saving...';
        }

        // Submit credit
        const response = await fetch(`${API_BASE_URL}/credit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(creditData)
        });

        if (!response.ok) {
            throw new Error('Failed to create credit');
        }

        const result = await response.json();
        
        // Show success message
        showSuccessMessage('Credit created successfully');
        
        // Reset form
        document.getElementById('creditForm').reset();
        
        // Set today's date in credit date field
        document.getElementById('creditDate').value = new Date().toISOString().split('T')[0];
        
        // Reload transactions
        await loadCreditTransactions();

    } catch (error) {
        console.error('Error submitting credit:', error);
        showErrorMessage(error.message || 'Failed to create credit');
    } finally {
        // Reset submit button
        const submitButton = document.querySelector('#creditForm button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Credit';
        }
    }
}

// Load Credit Transactions
async function loadCreditTransactions() {
    try {
        const userId = getUserId();
        if (!userId) {
            showErrorMessage('User ID not found. Please log in again.');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/credit?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch credits');
        
        const credits = await response.json();
        currentCredits = Array.isArray(credits) ? credits : [];
        
        const tbody = document.querySelector('#transactionsTable tbody');
        if (!tbody) {
            console.error("Transaction table body not found!");
            return;
        }
        tbody.innerHTML = '';

        if (currentCredits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" class="no-data">No credit transactions found.</td></tr>';
            return;
        }

        currentCredits.forEach(credit => {
            const row = document.createElement('tr');
            const principal = parseFloat(credit.credit_amount || 0);
            const totalInterest = parseFloat(credit.total_interest_amount || 0);
            const totalPaid = parseFloat(credit.paid_amount || 0);
            const outstanding = (principal + totalInterest - totalPaid).toFixed(2);
            const creditDate = new Date(credit.credit_date).toLocaleDateString();

            // Calculate total items from products if available, otherwise use the total_items field
            let totalItems = credit.total_items;
            if (!totalItems && credit.products && Array.isArray(credit.products)) {
                totalItems = credit.products.reduce((sum, product) => {
                    return sum + (parseInt(product.number_of_items) || 0);
                }, 0);
            }

            row.innerHTML = `
                <td>${credit.customer_id || ''}</td>
                <td>${credit.customer_name || ''}</td>
                <td>${credit.products.map(p => p.product_name).join(', ') || ''}</td>
                <td>${totalItems || 0}</td>
                <td>₹${principal.toFixed(2)}</td>
                <td>${credit.interest_rate}%</td>
                <td>₹${totalInterest.toFixed(2)}</td>
                <td>₹${totalPaid.toFixed(2)}</td>
                <td>₹${outstanding}</td>
                <td>${creditDate}</td>
                <td>
                    <span class="status-badge ${getStatusClass(credit.status)}">
                        ${credit.status}
                    </span>
                </td>
                <td class="credit-notes" title="${credit.notes || ''}">${credit.notes || ''}</td>
                <td class="action-buttons">
                    <button onclick="openPaymentModal('${credit.credit_id}')" class="btn-payment" title="Make Payment">
                        <i class="fas fa-money-bill"></i> Pay
                    </button>
                    <button onclick="openPaymentHistory('${credit.credit_id}')" class="btn-history" title="View Payment History">
                        <i class="fas fa-history"></i> History
                    </button>
                    <button onclick="openInterestModal('${credit.credit_id}')" class="btn-interest" title="Calculate Interest">
                        <i class="fas fa-chart-line"></i> Interest
                    </button>
                    <button onclick="openEditModal('${credit.credit_id}')" class="btn-edit" title="Edit Credit">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="deleteCredit('${credit.credit_id}')" class="btn-delete" title="Delete Credit">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading transactions:', error);
        showErrorMessage('Failed to load credit transactions. Please try again.');
    }
}

// Get Status Badge
function getStatusBadge(credit) {
    const statusMap = {
        'Paid': { class: 'status-paid', text: 'Paid' },
        'Partially Paid': { class: 'status-partial', text: 'Partially Paid' },
        'Pending': { class: 'status-pending', text: 'Pending' },
        'Overdue': { class: 'status-overdue', text: 'Overdue' },
        'Archived': { class: 'status-archived', text: 'Archived' }
    };

    // Ensure we have a valid status, defaulting to Pending if not present
    const status = credit.status ? statusMap[credit.status] || { class: 'status-pending', text: credit.status } : statusMap.Pending;
    
    // If archived, just show archived status
    if (credit.status === 'Archived') {
        return `<span class="status-badge ${status.class}">${status.text}</span>`;
    }
    
    // Check for overdue status - show days overdue if available
    if (credit.status !== 'Paid' && credit.overdue_days && credit.overdue_days > 0) {
        return `<span class="status-badge status-overdue">Overdue (${credit.overdue_days} days)</span>`;
    }
    
    return `<span class="status-badge ${status.class}">${status.text}</span>`;
}

// Get Credit Score Class
function getCreditScoreClass(score) {
    score = parseInt(score) || 0;
    if (score >= 700) return 'score-excellent';
    if (score >= 500) return 'score-good';
    return 'score-poor';
}

// Open Payment Modal
function openPaymentModal(creditId) {
    try {
        if (!creditId) {
            showErrorMessage('No credit selected for payment');
            return;
        }

        selectedCreditId = creditId; // Store the credit ID
        const modal = document.getElementById('paymentModal');
        const paymentForm = document.getElementById('paymentForm');
        
        // Reset form
        paymentForm.reset();
        
        // Set default payment date to today
        const paymentDateInput = document.getElementById('paymentDate');
        if (paymentDateInput) {
            paymentDateInput.valueAsDate = new Date();
        }

        // Show modal
        if (modal) {
            modal.style.display = 'block';
        }
    } catch (error) {
        console.error('Error opening payment modal:', error);
        showErrorMessage('Failed to open payment modal');
    }
}

// Open Payment History Modal
async function openPaymentHistory(creditId) {
    try {
        const userId = getUserId();
        const response = await fetch(`${API_BASE_URL}/credit/${creditId}/payments?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch payment history');
        
        const payments = await response.json();
        if (!Array.isArray(payments)) {
            throw new Error('Invalid payment data format');
        }
        
        const tbody = document.querySelector('#paymentHistoryTable tbody');
        tbody.innerHTML = payments.length > 0 ? 
            payments.map(payment => `
                <tr>
                    <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
                    <td>${formatCurrency(payment.payment_amount)}</td>
                    <td>${payment.payment_notes || ''}</td>
                </tr>
            `).join('') : '<tr><td colspan="3">No payment history found.</td></tr>';
        
        document.getElementById('paymentHistoryModal').style.display = 'block';
    } catch (error) {
        console.error('Error loading payment history:', error);
        alert('Failed to load payment history. Please try again.');
    }
}

// Add this new function for toggling archive status
async function toggleArchiveCredit(creditId) {
    try {
        const credit = currentCredits.find(c => c.credit_id === creditId);
        if (!credit) {
            throw new Error('Credit not found');
        }

        const isArchived = credit.status === 'Archived';
        const action = isArchived ? 'unarchive' : 'archive';
        const confirmMessage = isArchived ? 
            'Are you sure you want to unarchive this credit?' : 
            'Are you sure you want to archive this credit?';

        if (!confirm(confirmMessage)) {
            return;
        }

        const userId = getUserId();
        const response = await fetch(`${API_BASE_URL}/credit/${creditId}/${action}?userId=${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Failed to ${action} credit`);
        }

        await loadCreditTransactions();
        alert(`Credit ${action}d successfully`);
    } catch (error) {
        console.error(`Error ${credit.status === 'Archived' ? 'unarchiving' : 'archiving'} credit:`, error);
        alert(error.message || `Failed to ${credit.status === 'Archived' ? 'unarchive' : 'archive'} credit. Please try again.`);
    }
}

// Add CSS class for no data message
const style = document.createElement('style');
style.textContent = `
    .no-data {
        text-align: center;
        color: #6b7280;
        padding: 2rem !important;
        font-style: italic;
    }
`;
document.head.appendChild(style);

function validateProductRow(row) {
    const productSelect = row.querySelector('.product-select');
    const numberElement = row.querySelector('.number-of-items');
    const unitSelect = row.querySelector('.unit-select');
    const priceElement = row.querySelector('.price-per-unit');
    const totalElement = row.querySelector('.total-price');

    const missingElements = [];
    
    // Validate product selection
    if (!productSelect || !productSelect.value) {
        missingElements.push('product');
    }

    // Validate number of items (handle both input and select)
    let numberValue;
    if (numberElement) {
        if (numberElement.tagName === 'SELECT') {
            numberValue = numberElement.value;
        } else {
            numberValue = numberElement.value.trim();
        }
        
        const parsedNumber = parseFloat(numberValue);
        if (!numberValue || isNaN(parsedNumber) || parsedNumber <= 0) {
            missingElements.push('number-of-items');
        }
    } else {
        missingElements.push('number-of-items');
    }

    // Validate unit selection
    if (!unitSelect || !unitSelect.value) {
        missingElements.push('unit');
    }

    // Validate price (handle both input and select)
    let priceValue;
    if (priceElement) {
        if (priceElement.tagName === 'SELECT') {
            priceValue = priceElement.value;
        } else {
            priceValue = priceElement.value.trim();
        }
        
        const parsedPrice = parseFloat(priceValue);
        if (!priceValue || isNaN(parsedPrice) || parsedPrice <= 0) {
            missingElements.push('price-per-unit');
        }
    } else {
        missingElements.push('price-per-unit');
    }

    return {
        isValid: missingElements.length === 0,
        missingElements,
        values: {
            productId: productSelect ? productSelect.value : null,
            numberValue: numberValue ? parseFloat(numberValue) : null,
            unit: unitSelect ? unitSelect.value : null,
            price: priceValue ? parseFloat(priceValue) : null
        }
    };
}

function validateAndLogProductDetails() {
    const productRows = document.querySelectorAll('.product-row');
    let isValid = true;
    let totalAmount = 0;

    productRows.forEach(row => {
        const productSelect = row.querySelector('.product-select');
        const numberOfItems = row.querySelector('.number-of-items');
        const pricePerUnit = row.querySelector('.price-per-unit');
        const totalPrice = row.querySelector('.total-price');

        if (!productSelect.value) {
            isValid = false;
            productSelect.classList.add('error');
        } else {
            productSelect.classList.remove('error');
        }

        if (!numberOfItems.value || parseFloat(numberOfItems.value) <= 0) {
            isValid = false;
            numberOfItems.classList.add('error');
        } else {
            numberOfItems.classList.remove('error');
        }

        if (!pricePerUnit.value || parseFloat(pricePerUnit.value) <= 0) {
            isValid = false;
            pricePerUnit.classList.add('error');
        } else {
            pricePerUnit.classList.remove('error');
        }

        totalAmount += parseFloat(totalPrice.value) || 0;
    });

    return { isValid, totalAmount };
}

// Add this helper function for status classes
function getStatusClass(status) {
    switch (status?.toLowerCase()) {
        case 'paid': return 'status-paid';
        case 'partially paid': return 'status-partial';
        case 'overdue': return 'status-overdue';
        case 'archived': return 'status-archived';
        default: return 'status-pending';
    }
}

// Add new function to gather product data
function gatherProductData() {
    const productRows = document.querySelectorAll('.product-row');
    const products = [];

    productRows.forEach(row => {
        const productSelect = row.querySelector('.product-select');
        const numberInput = row.querySelector('.number-of-items');
        const priceInput = row.querySelector('.price-per-unit');
        const unitSelect = row.querySelector('.unit-select');

        if (!productSelect || !numberInput || !priceInput || !unitSelect) return;

        const productId = productSelect.value;
        const number_of_items = parseInt(numberInput.value) || 0;
        const price_per_unit = parseFloat(priceInput.value) || 0;
        const quantity_unit = unitSelect.value;

        // Only add products with valid number of items
        if (productId && number_of_items > 0 && price_per_unit > 0) {
            products.push({
                productId,
                number_of_items,
                price_per_unit,
                quantity_unit
            });
        }
    });

    return products;
}

// Add this new function for debounced credit fetching
async function fetchCreditDetails(creditId, options = {}) {
    const {
        skipCache = false,
        debounceMs = 300,
        cacheExpiry = 30000 // 30 seconds
    } = options;

    // Check if credit was previously not found
    if (!skipCache && notFoundCache.has(creditId)) {
        return null;
    }

    // Clear any existing debounce timer for this credit ID
    if (debounceTimers.has(creditId)) {
        clearTimeout(debounceTimers.get(creditId));
    }

    // Return a promise that resolves after the debounce period
    return new Promise((resolve, reject) => {
        debounceTimers.set(creditId, setTimeout(async () => {
            try {
                // Check cache first
                if (!skipCache) {
                    const cached = creditCache.get(creditId);
                    if (cached && (Date.now() - cached.timestamp < cacheExpiry)) {
                        return resolve(cached.data);
                    }
                }

                // Check for pending request
                if (pendingRequests.has(creditId)) {
                    return resolve(await pendingRequests.get(creditId));
                }

                // Make the API request
                const userId = getUserId();
                const requestPromise = fetch(`${API_BASE_URL}/credit/${creditId}?userId=${userId}`)
                    .then(async response => {
                        if (!response.ok) {
                            if (response.status === 404) {
                                notFoundCache.add(creditId);
                                // Clear not found cache after 5 minutes
                                setTimeout(() => notFoundCache.delete(creditId), 300000);
                                return null;
                            }
                            throw new Error('Failed to fetch credit details');
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data) {
                            creditCache.set(creditId, {
                                data,
                                timestamp: Date.now()
                            });
                        }
                        return data;
                    })
                    .finally(() => {
                        pendingRequests.delete(creditId);
                    });

                pendingRequests.set(creditId, requestPromise);
                resolve(await requestPromise);
            } catch (error) {
                console.error('Error fetching credit details:', error);
                reject(error);
            }
        }, debounceMs));
    });
}

// Format currency values consistently
function formatCurrency(amount) {
    return parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Interest calculation functions
function showLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    const content = document.getElementById('interestContent');
    if (spinner) spinner.style.display = 'flex';
    if (content) content.style.display = 'none';
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    const content = document.getElementById('interestContent');
    if (spinner) spinner.style.display = 'none';
    if (content) content.style.display = 'block';
}

function showErrorMessage(message) {
    const errorAlert = document.getElementById('errorAlert');
    if (errorAlert) {
        errorAlert.style.display = 'flex';
        errorAlert.style.backgroundColor = '#fee2e2';
        errorAlert.style.color = '#991b1b';
        const messageElement = errorAlert.querySelector('.error-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }
}

function hideErrorMessage() {
    const errorAlert = document.getElementById('errorAlert');
    if (errorAlert) {
        errorAlert.style.display = 'none';
    }
}

async function loadInterestHistory(creditId) {
    try {
        const userId = getUserId();
        if (!userId) {
            throw new Error('User ID not found. Please log in again.');
        }

        showLoadingSpinner();
        const response = await fetch(`${API_BASE_URL}/credit/${creditId}/interest-history?userId=${userId}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch interest history');
        }

        const data = await response.json();
        
        // Get the table body
        const historyTable = document.getElementById('interestHistoryTableBody');
        if (!historyTable) throw new Error("Could not find interest history table");

        const history = data.history || [];

        if (history.length === 0) {
            historyTable.innerHTML = '<tr><td colspan="8" class="text-center">No interest history available</td></tr>';
            return;
        }

        // Populate the table
        historyTable.innerHTML = history.map(entry => `
            <tr>
                <td>${new Date(entry.calculation_date).toLocaleDateString()}</td>
                <td>₹${parseFloat(entry.principal_amount || 0).toFixed(2)}</td>
                <td>₹${parseFloat(entry.payment_amount || 0).toFixed(2)}</td>
                <td>₹${parseFloat(entry.remaining_balance || 0).toFixed(2)}</td>
                <td>${entry.duration_days || 0}</td>
                <td>${entry.interest_rate || 0}%</td>
                <td>₹${parseFloat(entry.interest_amount || 0).toFixed(2)}</td>
                <td>
                    <button 
                        class="btn-delete-interest" 
                        onclick="deleteInterestCalculation('${creditId}', '${entry.calculation_id}')"
                        title="Delete this interest calculation"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Update total interest amount
        const totalInterest = document.getElementById('totalInterestAmount');
        if (totalInterest) {
            totalInterest.textContent = `₹${data.total_interest.toFixed(2)}`;
        }

    } catch (error) {
        console.error("Interest history error:", error);
        showErrorMessage(error.message || "Could not load interest history");
    } finally {
        hideLoadingSpinner();
    }
}

async function deleteInterestCalculation(creditId, calculationId) {
    try {
        if (!confirm('Are you sure you want to delete this interest calculation?')) {
            return;
        }

        showLoadingSpinner();
        hideErrorMessage();

        const userId = getUserId();
        const response = await fetch(`${API_BASE_URL}/credit/${creditId}/interest/${calculationId}?userId=${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete interest calculation');
        }

        // Show success message
        showSuccessMessage('Interest calculation deleted successfully');

        // Reload interest history
        await loadInterestHistory(creditId);
        
        // Reload the main transactions table to update interest amount
        await loadCreditTransactions();

    } catch (error) {
        console.error('Error deleting interest calculation:', error);
        showErrorMessage(error.message || 'Failed to delete interest calculation');
    } finally {
        hideLoadingSpinner();
    }
}

// Add success message handling
function showSuccessMessage(message) {
    const errorAlert = document.getElementById('errorAlert');
    if (errorAlert) {
        errorAlert.style.display = 'flex';
        errorAlert.style.backgroundColor = '#dcfce7';
        errorAlert.style.color = '#166534';
        const messageElement = errorAlert.querySelector('.error-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        // Hide after 3 seconds
        setTimeout(() => {
            errorAlert.style.display = 'none';
        }, 3000);
    }
}

// Add this function to handle interest application
async function applyInterest(creditId, userId, days) {
    try {
        showLoadingSpinner();
        hideErrorMessage();

        const response = await fetch(`${API_BASE_URL}/credit/${creditId}/interest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, days })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to apply interest');
        }

        const data = await response.json();
        
        // Show success message
        showSuccessMessage(`Interest of ₹${data.interest_amount} applied. New balance: ₹${data.new_remaining_amount}`);
        
        // Refresh the interest breakdown
        await loadInterestHistory(creditId);
        
        // Update the outstanding amount display
        const outstandingElement = document.querySelector('.outstanding-amount');
        if (outstandingElement) {
            outstandingElement.textContent = `₹${parseFloat(data.new_remaining_amount).toFixed(2)}`;
        }

    } catch (error) {
        console.error('Error applying interest:', error);
        showErrorMessage(error.message || 'Failed to apply interest. Please try again.');
    } finally {
        hideLoadingSpinner();
    }
}

// Add this function to calculate days between dates
function calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

async function calculateInterestForDateRange(creditId) {
    try {
        const userId = getUserId();
        if (!userId) {
            showErrorMessage('User ID not found');
            return;
        }

        const startDate = document.getElementById('interestStartDate').value;
        const endDate = document.getElementById('interestEndDate').value;

        if (!startDate || !endDate) {
            showErrorMessage('Please select both start and end dates');
            return;
        }

        // Calculate days between dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        if (days < 0) {
            showErrorMessage('End date must be after start date');
            return;
        }

        showLoadingSpinner();
        hideErrorMessage();

        // Make API call to calculate interest
        const response = await fetch(`${API_BASE_URL}/credit/${creditId}/interest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                days,
                startDate,
                endDate
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to calculate interest');
        }

        const result = await response.json();
        
        if (result.success) {
            showSuccessMessage(`Interest calculated: ₹${parseFloat(result.interest_amount).toFixed(2)}`);
            
            // Update the outstanding amount display
            const outstandingElement = document.querySelector('.outstanding-amount');
            if (outstandingElement && result.new_remaining_amount) {
                outstandingElement.textContent = `₹${parseFloat(result.new_remaining_amount).toFixed(2)}`;
            }

            // Reload interest history to show new calculation
            await loadInterestHistory(creditId);
            
            // Reload the main transactions table to update interest amount
            await loadCreditTransactions();
        } else {
            throw new Error(result.message || 'Failed to calculate interest');
        }

    } catch (error) {
        console.error('Error calculating interest:', error);
        showErrorMessage(error.message || 'Failed to calculate interest');
    } finally {
        hideLoadingSpinner();
    }
}

// Add event listener for Calculate Interest button
document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.querySelector('.btn-calculate');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', () => {
            const modal = document.getElementById('interestModal');
            const creditId = modal.dataset.creditId;
            if (creditId) {
                calculateInterestForDateRange(creditId);
            } else {
                showErrorMessage('Credit ID not found');
            }
        });
    }
});

function updateInterestTable(breakdown) {
    const tbody = document.querySelector('#interestTable tbody');
    tbody.innerHTML = '';

    breakdown.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(row.date).toLocaleDateString()}</td>
            <td>₹${formatCurrency(row.principal)}</td>
            <td>₹${formatCurrency(row.payment)}</td>
            <td>₹${formatCurrency(row.outstanding)}</td>
            <td>${row.days}</td>
            <td>${row.interest_rate}%</td>
            <td>₹${formatCurrency(row.interest)}</td>
            <td>
                ${row.interest > 0 ? `
                    <button class="delete-interest" data-calculation-id="${row.calculation_id || ''}">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateInterestSummary(summary) {
    document.querySelector('#totalInterest').textContent = `₹${formatCurrency(summary.total_interest)}`;
    document.querySelector('#totalPayments').textContent = `₹${formatCurrency(summary.total_payments)}`;
    document.querySelector('#totalAmountWithInterest').textContent = `₹${formatCurrency(summary.total_outstanding)}`;
}

function updateCreditDetails(details) {
    const customerName = document.querySelector('#modalCustomerName');
    const creditAmount = document.querySelector('.credit-amount');
    const outstandingAmount = document.querySelector('.outstanding-amount');

    if (customerName) customerName.textContent = details.customer_name;
    if (creditAmount) creditAmount.textContent = `₹${formatCurrency(details.credit_amount)}`;
    if (outstandingAmount) outstandingAmount.textContent = `₹${formatCurrency(details.current_outstanding)}`;
}

// Handle Payment Submit
async function handlePaymentSubmit(event) {
    event.preventDefault();
    
    try {
        if (!selectedCreditId) {
            throw new Error('No credit selected for payment');
        }

        const userId = getUserId();
        if (!userId) {
            throw new Error('User ID not found. Please log in again.');
        }

        const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
        if (!paymentAmount || paymentAmount <= 0) {
            throw new Error('Please enter a valid payment amount');
        }

        const paymentDate = document.getElementById('paymentDate').value;
        if (!paymentDate) {
            throw new Error('Please select a payment date');
        }

        const paymentData = {
            userId: userId,
            payment_amount: paymentAmount,
            payment_date: paymentDate,
            payment_notes: document.getElementById('paymentNotes').value || ''
        };

        // Show loading state
        const submitButton = event.target.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Processing...';
        }

        // Submit payment
        const response = await fetch(`${API_BASE_URL}/credit/${selectedCreditId}/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to process payment');
        }

        const result = await response.json();
        
        // Show success message
        showSuccessMessage('Payment processed successfully');
        
        // Close modal and reset form
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.style.display = 'none';
        }
        document.getElementById('paymentForm').reset();
        
        // Reset selected credit ID
        selectedCreditId = null;
        
        // Refresh the transactions table
        await loadCreditTransactions();

        // If payment history modal is open, refresh it
        if (document.getElementById('paymentHistoryModal').style.display === 'block') {
            await openPaymentHistory(selectedCreditId);
        }

    } catch (error) {
        console.error('Error processing payment:', error);
        showErrorMessage(error.message || 'Failed to process payment');
    } finally {
        // Reset submit button
        const submitButton = document.getElementById('paymentForm').querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Payment';
        }
    }
}

// Add event listeners when the document loads
document.addEventListener('DOMContentLoaded', () => {
    // ... existing event listeners ...

    // Add payment form submit handler
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentSubmit);
    }

    // Add payment modal close handler
    const paymentModalClose = document.querySelector('#paymentModal .close');
    if (paymentModalClose) {
        paymentModalClose.addEventListener('click', () => {
            const modal = document.getElementById('paymentModal');
            if (modal) {
                modal.style.display = 'none';
                selectedCreditId = null; // Reset selected credit ID when closing
            }
        });
    }
});

// Add Product Row with enhanced event listeners
function addProductRow(product = {}) {
    const row = document.createElement('div');
    row.className = 'product-row';
    
    // Create product select
    const productSelect = document.createElement('select');
    productSelect.className = 'product-select';
    productSelect.required = true;
    productSelect.innerHTML = '<option value="">Select Product</option>';
    products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id || p.product_id;
        option.textContent = p.product_name || p.name;
        productSelect.appendChild(option);
    });
    if (product.product_id) productSelect.value = product.product_id;

    // Create number input
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.className = 'number-of-items';
    numberInput.placeholder = '0';
    numberInput.min = '1';
    numberInput.step = 'any';
    numberInput.required = true;
    if (product.number_of_items) numberInput.value = product.number_of_items;

    // Create unit select
    const unitSelect = document.createElement('select');
    unitSelect.className = 'unit-select';
    unitSelect.required = true;
    unitSelect.disabled = true;
    unitSelect.innerHTML = `
        <option value="">Unit</option>
        <option value="kg">kg</option>
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="l">l</option>
        <option value="bags">bags</option>
        <option value="units">units</option>
    `;
    if (product.quantity_unit) unitSelect.value = product.quantity_unit;

    // Create price input
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.className = 'price-per-unit';
    priceInput.placeholder = '0.00';
    priceInput.step = '0.01';
    priceInput.required = true;
    if (product.price_per_unit) priceInput.value = product.price_per_unit;

    // Create total price display
    const totalPrice = document.createElement('input');
    totalPrice.type = 'text';
    totalPrice.className = 'total-price';
    totalPrice.value = '0.00';
    totalPrice.readOnly = true;

    // Create remove button
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-product';
    removeButton.innerHTML = '×';

    // Add event listeners
    productSelect.addEventListener('change', async (e) => {
        await handleProductChange(e);
    });

    numberInput.addEventListener('input', () => {
        calculateRowTotal(row);
    });

    priceInput.addEventListener('input', () => {
        calculateRowTotal(row);
    });

    removeButton.addEventListener('click', () => {
        if (document.querySelectorAll('.product-row').length > 1) {
            row.remove();
            calculateBalance();
        }
    });

    // Append all elements to the row
    row.appendChild(productSelect);
    row.appendChild(numberInput);
    row.appendChild(unitSelect);
    row.appendChild(priceInput);
    row.appendChild(totalPrice);
    row.appendChild(removeButton);

    // Add the row to the product list
    const productList = document.getElementById('productList');
    if (productList) {
        productList.appendChild(row);
    }

    // Calculate initial total if product data is provided
    if (product.product_id) {
        calculateRowTotal(row);
    }

    return row;
}

// Function to populate product options
async function populateProductOptions(selectElement) {
    try {
        const userId = getUserId();
        const response = await fetch(`/api/stock?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const products = await response.json();
        
        selectElement.innerHTML = '<option value="">Select Product</option>';
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.product_name;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Error populating product options:', error);
    }
}

// Reset row fields function
function resetRowFields(row) {
    const productSelect = row.querySelector('.product-select');
    const unitSelect = row.querySelector('.unit-select');
    const priceInput = row.querySelector('.price-per-unit');
    const numberInput = row.querySelector('.number-of-items');
    const totalInput = row.querySelector('.total-price');

    if (productSelect) {
        productSelect.value = '';
    }
    if (unitSelect) {
        unitSelect.value = '';
        unitSelect.disabled = true;
    }
    if (priceInput) {
        priceInput.value = '0.00';
        priceInput.readOnly = true;
    }
    if (numberInput) {
        numberInput.value = '';
        numberInput.disabled = false;
    }
    if (totalInput) {
        totalInput.value = '0.00';
    }
    updateCreditAmount();
}

// Delete Credit
async function deleteCredit(creditId) {
    try {
        if (!creditId) {
            throw new Error('Credit ID is missing');
        }

        const userId = getUserId();
        if (!userId) {
            throw new Error('User ID not found. Please log in again.');
        }

        // Ask for confirmation
        if (!confirm('Are you sure you want to delete this credit? This action cannot be undone.')) {
            return;
        }

        // Show loading state on the delete button
        const deleteButton = document.querySelector(`button[onclick="deleteCredit('${creditId}')"]`);
        if (deleteButton) {
            deleteButton.disabled = true;
            deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        const response = await fetch(`${API_BASE_URL}/credit/${creditId}?userId=${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete credit');
        }

        // Show success message
        showSuccessMessage('Credit deleted successfully');

        // Refresh the transactions table
        await loadCreditTransactions();

    } catch (error) {
        console.error('Error deleting credit:', error);
        showErrorMessage(error.message || 'Failed to delete credit');
    } finally {
        // Reset delete button if it exists
        const deleteButton = document.querySelector(`button[onclick="deleteCredit('${creditId}')"]`);
        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        }
    }
}

// Archive Credit
async function archiveCredit(creditId) {
    if (!confirm('Are you sure you want to archive this credit?')) {
        return;
    }

    try {
        const userId = getUserId();
        const response = await fetch(`${API_BASE_URL}/credit/${creditId}/archive?userId=${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Failed to archive credit');
        }

        alert('Credit archived successfully');
        loadCreditTransactions();
    } catch (error) {
        console.error('Error archiving credit:', error);
        alert('Failed to archive credit. Please try again.');
    }
}

// Add unarchive functionality
async function unarchiveCredit(creditId) {
    if (!confirm('Are you sure you want to unarchive this credit?')) {
        return;
    }

    try {
        const userId = getUserId();
        const response = await fetch(`${API_BASE_URL}/credit/${creditId}/unarchive?userId=${userId}`, {
            method: 'PUT'
        });

        if (response.ok) {
            alert('Credit unarchived successfully');
            loadCreditTransactions();
        } else {
            throw new Error('Failed to unarchive credit');
        }
    } catch (error) {
        console.error('Error unarchiving credit:', error);
        alert('Failed to unarchive credit. Please try again.');
    }
}

// Simplify the partial payment input handling
function handlePartialPaymentInput(e) {
    let value = e.target.value;
    
    // Remove all non-numeric characters except decimal point
    value = value.replace(/[^\d.]/g, '');
    
    // Ensure only one decimal point
    const decimalCount = (value.match(/\./g) || []).length;
    if (decimalCount > 1) {
        value = value.replace(/\./g, (match, index) => index === value.indexOf('.') ? match : '');
    }
    
    // Format to 2 decimal places if there's a decimal point
    if (value.includes('.')) {
        const parts = value.split('.');
        value = parts[0] + '.' + (parts[1] || '').slice(0, 2);
    }
    
    // Update input value
    e.target.value = value;
    
    // Calculate balance
    calculateBalance();
}

// Add these new functions
async function handleSearch() {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(async () => {
        try {
            const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
            const userId = getUserId();
            
            // Get all credits
            const response = await fetch(`${API_BASE_URL}/credit?userId=${userId}`);
            if (!response.ok) throw new Error('Failed to fetch credits');
            
            const credits = await response.json();
            
            // Client-side filtering
            const filteredCredits = credits.filter(credit => {
                if (!searchTerm) return true; // Show all if search is empty
                
                // Fields to search in
                const searchableFields = [
                    credit.customer_name,
                    credit.customer_id?.toString(),
                    credit.credit_amount?.toString(),
                    credit.status,
                    credit.notes,
                    // Include product names in search
                    ...(credit.products || []).map(p => p.product_name || '')
                ].filter(Boolean); // Remove any null/undefined values

                // Search in all fields
                return searchableFields.some(field => 
                    field.toLowerCase().includes(searchTerm)
                );
            });

            // Update the transactions table with filtered results
            const tbody = document.querySelector('#transactionsTable tbody');
            if (!tbody) {
                throw new Error('Transactions table not found');
            }

            if (filteredCredits.length === 0) {
                tbody.innerHTML = '<tr><td colspan="13" class="no-data">No matching credits found.</td></tr>';
                return;
            }

            tbody.innerHTML = filteredCredits.map(credit => {
                const principal = parseFloat(credit.credit_amount || 0);
                const totalInterest = parseFloat(credit.total_interest_amount || 0);
                const totalPaid = parseFloat(credit.paid_amount || 0);
                const outstanding = (principal + totalInterest - totalPaid).toFixed(2);
                const creditDate = new Date(credit.credit_date).toLocaleDateString();
                const products = Array.isArray(credit.products) ? credit.products : [];
                const totalItems = products.reduce((sum, product) => sum + (parseInt(product.number_of_items) || 0), 0);

                return `
                    <tr>
                        <td>${credit.customer_id || ''}</td>
                        <td>${credit.customer_name || ''}</td>
                        <td>${products.map(p => p.product_name).join(', ') || ''}</td>
                        <td>${totalItems || 0}</td>
                        <td>₹${principal.toFixed(2)}</td>
                        <td>${credit.interest_rate}%</td>
                        <td>₹${totalInterest.toFixed(2)}</td>
                        <td>₹${totalPaid.toFixed(2)}</td>
                        <td>₹${outstanding}</td>
                        <td>${creditDate}</td>
                        <td>
                            <span class="status-badge ${getStatusClass(credit.status)}">
                                ${credit.status}
                            </span>
                        </td>
                        <td class="credit-notes" title="${credit.notes || ''}">${credit.notes || ''}</td>
                        <td class="action-buttons">
                            <button onclick="openPaymentModal('${credit.credit_id}')" class="btn-payment" title="Make Payment">
                                <i class="fas fa-money-bill"></i> Pay
                            </button>
                            <button onclick="openPaymentHistory('${credit.credit_id}')" class="btn-history" title="View Payment History">
                                <i class="fas fa-history"></i> History
                            </button>
                            <button onclick="openInterestModal('${credit.credit_id}')" class="btn-interest" title="Calculate Interest">
                                <i class="fas fa-chart-line"></i> Interest
                            </button>
                            <button onclick="openEditModal('${credit.credit_id}')" class="btn-edit" title="Edit Credit">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button onclick="deleteCredit('${credit.credit_id}')" class="btn-delete" title="Delete Credit">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (error) {
            console.error('Error searching credits:', error);
            const tbody = document.querySelector('#transactionsTable tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="13" class="error-message">
                            Error loading credits. Please try again.
                        </td>
                    </tr>
                `;
            }
        }
    }, 300); // 300ms debounce
}

async function openEditModal(creditId) {
    try {
        const modal = document.getElementById('editModal');
        const editForm = document.getElementById('editForm');
        const editProductList = document.getElementById('editProductList');

        if (!editProductList) {
            console.error('Edit product list container not found');
            return;
        }

        // Clear previous products
        editProductList.innerHTML = '';

        // Fetch credit details
        const credit = await fetchCreditDetails(creditId);
        if (!credit) {
            throw new Error('Credit details not found');
        }

        console.log('Opening edit modal with credit:', credit); // Debug log

        // Store credit ID in a data attribute
        modal.dataset.creditId = credit.credit_id;

        // Populate form fields
        document.getElementById('editCustomerId').value = credit.customer_id;
        
        // Get the customer select element
        const customerSelect = document.getElementById('editCustomerName');
        if (customerSelect) {
            // Set the value to customer_id
            customerSelect.value = credit.customer_id;
            
            // If the option doesn't exist, create it
            if (!customerSelect.querySelector(`option[value="${credit.customer_id}"]`)) {
                const option = document.createElement('option');
                option.value = credit.customer_id;
                option.textContent = credit.customer_name;
                customerSelect.appendChild(option);
            }
        }

        document.getElementById('editInterestRate').value = credit.interest_rate;
        document.getElementById('editStatus').value = credit.status;
        document.getElementById('editNotes').value = credit.notes || '';

        // Add product rows
        if (credit.products && credit.products.length > 0) {
            credit.products.forEach(product => {
                addEditProductRow(product);
            });
        } else {
            addEditProductRow();
        }

        // Show modal
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showErrorMessage('Failed to load credit details. Please try again.');
    }
}

function addEditProductRow(productData = null) {
    const editProductList = document.getElementById('editProductList');
    if (!editProductList) {
        console.error('Edit product list container not found');
        return;
    }

    const row = document.createElement('div');
    row.className = 'product-row';
    row.innerHTML = `
        <select class="product-select" required>
            <option value="">Select Product</option>
            ${products.map(p => `<option value="${p.id}">${p.product_name}</option>`).join('')}
        </select>
        <input type="number" class="number-of-items" placeholder="0" min="1" required>
        <select class="unit-select" required disabled>
            <option value="">Unit</option>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="l">l</option>
            <option value="bags">bags</option>
            <option value="units">units</option>
        </select>
        <input type="number" class="price-per-unit" placeholder="0.00" step="0.01" required readonly>
        <input type="text" class="total-price" value="0.00" readonly>
        <button type="button" class="remove-product">×</button>
    `;

    // Add event listeners
    const productSelect = row.querySelector('.product-select');
    const numberInput = row.querySelector('.number-of-items');
    const priceInput = row.querySelector('.price-per-unit');
    const removeButton = row.querySelector('.remove-product');

    productSelect.addEventListener('change', async (e) => {
        const productId = e.target.value;
        if (productId) {
            try {
                const userId = getUserId();
                const response = await fetch(`/api/stock/${productId}?userId=${userId}`);
                if (!response.ok) throw new Error('Failed to fetch product details');
                const product = await response.json();
                
                const unitSelect = row.querySelector('.unit-select');
                unitSelect.value = product.quantity_unit || 'units';
                priceInput.value = parseFloat(product.selling_price || 0).toFixed(2);
                
                calculateEditRowTotal(row);
            } catch (error) {
                console.error('Error fetching product details:', error);
            }
        } else {
            resetEditRowFields(row);
        }
    });

    numberInput.addEventListener('input', () => {
        calculateEditRowTotal(row);
    });

    removeButton.addEventListener('click', () => {
        if (editProductList.querySelectorAll('.product-row').length > 1) {
            row.remove();
            updateEditCreditAmount();
        }
    });

    // If product data is provided, populate the row
    if (productData) {
        productSelect.value = productData.product_id;
        numberInput.value = productData.number_of_items;
        priceInput.value = productData.price_per_unit;
        const unitSelect = row.querySelector('.unit-select');
        unitSelect.value = productData.quantity_unit || 'units';
        calculateEditRowTotal(row);
    }

    editProductList.appendChild(row);
}

function calculateEditRowTotal(row) {
    const numberInput = row.querySelector('.number-of-items');
    const priceInput = row.querySelector('.price-per-unit');
    const totalInput = row.querySelector('.total-price');
    
    const quantity = parseFloat(numberInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const total = quantity * price;
    
    totalInput.value = total.toFixed(2);
    updateEditCreditAmount();
}

function updateEditCreditAmount() {
    const rows = document.querySelectorAll('#editProductList .product-row');
    let totalAmount = 0;
    
    rows.forEach(row => {
        const totalPrice = parseFloat(row.querySelector('.total-price').value) || 0;
        totalAmount += totalPrice;
    });
    
    const creditAmountInput = document.getElementById('editCreditAmount');
    if (creditAmountInput) {
        creditAmountInput.value = totalAmount.toFixed(2);
    }
}

function resetEditRowFields(row) {
    const unitSelect = row.querySelector('.unit-select');
    const priceInput = row.querySelector('.price-per-unit');
    const numberInput = row.querySelector('.number-of-items');
    const totalInput = row.querySelector('.total-price');

    unitSelect.value = '';
    priceInput.value = '0.00';
    numberInput.value = '';
    totalInput.value = '0.00';
    updateEditCreditAmount();
}

async function handleEditSubmit(event) {
    event.preventDefault();
    
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            throw new Error('User ID not found. Please log in again.');
        }

        // Get the credit ID from the modal's data attribute
        const modal = document.getElementById('editModal');
        const creditId = modal.dataset.creditId;
        
        if (!creditId) {
            throw new Error('Credit ID is missing');
        }

        console.log('Submitting edit for credit ID:', creditId); // Debug log

        const formData = {
            customerId: document.getElementById('editCustomerName').value,
            interest_rate: parseFloat(document.getElementById('editInterestRate').value),
            status: document.getElementById('editStatus').value,
            notes: document.getElementById('editNotes').value || '',
            products: []
        };

        // Log form data for debugging
        console.log('Form data to submit:', formData);

        // Validate required fields
        if (!formData.customerId) {
            throw new Error('Please select a customer');
        }
        if (!formData.interest_rate || formData.interest_rate < 0) {
            throw new Error('Please enter a valid interest rate');
        }

        // Get product details
        const productRows = document.querySelectorAll('#editProductList .product-row');
        productRows.forEach(row => {
            const productSelect = row.querySelector('.product-select');
            const numberInput = row.querySelector('.number-of-items');
            const unitSelect = row.querySelector('.unit-select');
            const priceInput = row.querySelector('.price-per-unit');

            const productId = productSelect.value;
            const numberOfItems = parseFloat(numberInput.value);
            const pricePerUnit = parseFloat(priceInput.value);
            const quantityUnit = unitSelect.value;

            if (productId && numberOfItems > 0 && pricePerUnit > 0) {
                formData.products.push({
                    product_id: productId,
                    number_of_items: numberOfItems,
                    price_per_unit: pricePerUnit,
                    quantity_unit: quantityUnit
                });
            }
        });

        if (formData.products.length === 0) {
            throw new Error('Please add at least one product');
        }

        // Log the final URL and data being sent
        const url = `${API_BASE_URL}/credit/${creditId}?userId=${userId}`;
        console.log('Sending PUT request to:', url);
        console.log('With data:', formData);

        // Submit the form
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update credit');
        }

        const result = await response.json();
        console.log('Update successful:', result); // Debug log
        
        showSuccessMessage('Credit updated successfully');
        closeEditModal();
        await loadCreditTransactions(); // Refresh the table

    } catch (error) {
        console.error('Error updating credit:', error);
        showErrorMessage(error.message || 'Failed to update credit');
    }
}

// Add this function if not already present
function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Add this function to fetch payment history for all credits
async function fetchAllPaymentHistory(credits) {
    const userId = getUserId();
    const paymentHistories = [];

    try {
        for (const credit of credits) {
            const response = await fetch(`${API_BASE_URL}/credit/${credit.credit_id}/payments?userId=${userId}`);
            if (response.ok) {
                const payments = await response.json();
                paymentHistories.push({
                    credit_id: credit.credit_id,
                    payments: payments
                });
            }
        }
        return paymentHistories;
    } catch (error) {
        console.error('Error fetching payment histories:', error);
        return [];
    }
}

// Update the export function to include payment history
async function exportToExcel() {
    try {
        // Show loading state in the button
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.textContent = 'Fetching data...';
        exportBtn.disabled = true;

        // Get the latest data
        const userId = getUserId();
        
        // Fix: Change the endpoint from /api/credits to /api/credit
        const response = await fetch(`${API_BASE_URL}/credit?userId=${userId}`);
        if (!response.ok) {
            console.error('Failed to fetch credit data:', response.status, response.statusText);
            throw new Error('Failed to fetch credit data');
        }
        const credits = await response.json();
        
        // Update currentCredits with fresh data
        currentCredits = Array.isArray(credits) ? credits : [];
        
        if (currentCredits.length === 0) {
            throw new Error('No credit data available to export');
        }

        // Add debug logging
        console.log('Fetched credits for export:', currentCredits);

        // Update button text
        exportBtn.textContent = 'Preparing export...';

        // Fetch payment histories for all credits
        const paymentHistories = await fetchAllPaymentHistory(currentCredits);

        // Add debug logging
        console.log('Fetched payment histories:', paymentHistories);

        // Create credit details CSV
        let creditCsvContent = "Credit Details\n";
        creditCsvContent += "Customer ID,Customer Name,Products,Quantities,Credit Amount,Interest Rate,Due Date,Outstanding Balance,Credit Score,Status,Notes\n";
        
        currentCredits.forEach(credit => {
            const productsList = Array.isArray(credit.products) ? credit.products : [];
            const productNames = productsList.map(p => p.product_name || 'Unknown Product').join('; ');
            const quantities = productsList.map(p => `${p.quantity || 0} ${p.quantity_unit || ''}`).join('; ');
            const dueDate = credit.due_date ? new Date(credit.due_date).toLocaleDateString() : 'N/A';
            
            const row = [
                credit.customer_id || '',
                (credit.customer_name || 'Unknown').replace(/,/g, ';'),
                productNames.replace(/,/g, ';'),
                quantities.replace(/,/g, ';'),
                `₹${parseFloat(credit.credit_amount || 0).toFixed(2)}`,
                `${parseFloat(credit.interest_rate || 0).toFixed(2)}%`,
                dueDate,
                `₹${parseFloat(credit.remaining_amount || 0).toFixed(2)}`,
                credit.credit_score || 'N/A',
                credit.status || 'Pending',
                (credit.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
            ].join(',');
            
            creditCsvContent += row + "\n";
        });

        // Add payment history section
        creditCsvContent += "\nPayment History\n";
        creditCsvContent += "Customer Name,Credit ID,Payment Date,Payment Amount,Payment Notes\n";

        paymentHistories.forEach(history => {
            const credit = currentCredits.find(c => c.credit_id === history.credit_id);
            const customerName = credit ? credit.customer_name : 'Unknown';

            if (Array.isArray(history.payments)) {
                history.payments.forEach(payment => {
                    const paymentDate = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A';
                    const row = [
                        customerName.replace(/,/g, ';'),
                        history.credit_id,
                        paymentDate,
                        `₹${parseFloat(payment.payment_amount || 0).toFixed(2)}`,
                        (payment.payment_notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
                    ].join(',');
                    
                    creditCsvContent += row + "\n";
                });
            }
        });

        // Create and download the file
        const blob = new Blob(['\ufeff' + creditCsvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement("a");
        const fileName = `credit_history_${new Date().toISOString().split('T')[0]}.csv`;

        downloadLink.href = url;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);

        // Reset button state
        exportBtn.textContent = 'Export History';
        exportBtn.disabled = false;

    } catch (error) {
        console.error('Error exporting data:', error);
        alert(error.message || 'Failed to export data. Please try again.');
        
        // Reset button state on error
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.textContent = 'Export History';
            exportBtn.disabled = false;
        }
    }
}

// Add this function to handle opening the interest modal
async function openInterestModal(creditId) {
    try {
        const modal = document.getElementById('interestModal');
        if (!modal) {
            throw new Error('Interest modal not found');
        }

        // Store credit ID in modal for later use
        modal.dataset.creditId = creditId;

        // Fetch credit details
        const credit = await fetchCreditDetails(creditId);
        if (!credit) {
            throw new Error('Credit details not found');
        }

        // Update modal content with credit details
        const customerName = document.getElementById('modalCustomerName');
        const creditAmount = document.querySelector('.credit-amount');
        const outstandingAmount = document.querySelector('.outstanding-amount');

        if (customerName) customerName.textContent = credit.customer_name;
        if (creditAmount) creditAmount.textContent = `₹${formatCurrency(credit.credit_amount)}`;
        if (outstandingAmount) outstandingAmount.textContent = `₹${formatCurrency(credit.remaining_amount)}`;

        // Set default date range
        const startDate = document.getElementById('interestStartDate');
        const endDate = document.getElementById('interestEndDate');
        
        if (startDate) {
            startDate.value = credit.credit_date.split('T')[0];
        }
        if (endDate) {
            endDate.value = new Date().toISOString().split('T')[0];
        }

        // Load initial interest history
        await loadInterestHistory(creditId);

        // Show the modal
        modal.style.display = 'block';

    } catch (error) {
        console.error('Error opening interest modal:', error);
        showErrorMessage(error.message || 'Failed to open interest modal');
    }
}