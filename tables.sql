CREATE DATABASE IF NOT EXISTS fertilizer_inventory;
USE fertilizer_inventory;
-- USERS TABLE
CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    shop_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL,
    password VARCHAR(255) NOT NULL
);
-- SUPPLIERS TABLE
CREATE TABLE suppliers (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    license_number VARCHAR(50)
);
-- CUSTOMERS TABLE
CREATE TABLE customers (
    customer_id VARCHAR(10) NOT NULL PRIMARY KEY,
    user_id INT,
    customer_name VARCHAR(255),
    phone_number VARCHAR(20),
    address TEXT,
    notes TEXT,
    total_purchases INT DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    outstanding_credit DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    credit_score INT DEFAULT 100
);
-- CREDIT SALES TABLE
CREATE TABLE credit_sales (
    credit_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    customer_id VARCHAR(10),
    user_id INT,
    credit_amount DECIMAL(10, 2),
    paid_amount DECIMAL(10, 2),
    remaining_amount DECIMAL(10, 2) DEFAULT 0.00,
    interest_rate DECIMAL(5, 2) DEFAULT 2.00,
    total_interest_amount DECIMAL(10, 2) DEFAULT 0.00,
    due_date DATE,
    last_interest_calculation DATE,
    overdue_days INT DEFAULT 0,
    status ENUM('Pending', 'Partially Paid', 'Paid') DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived TINYINT(1),
    last_payment_date DATETIME,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    duration_days INT DEFAULT 30,
    credit_date DATE DEFAULT CURDATE()
);
-- CREDIT PRODUCTS TABLE
CREATE TABLE credit_products (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    credit_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity_unit VARCHAR(20),
    price_per_unit DECIMAL(10, 2),
    number_of_items INT
);
-- CREDIT SCORE HISTORY TABLE
CREATE TABLE credit_score_history (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    customer_id VARCHAR(10) NOT NULL,
    score_change INT NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- SALES TABLE
CREATE TABLE sales (
    sale_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    customer_id VARCHAR(10),
    total_amount DECIMAL(10, 2),
    payment_status ENUM('Paid', 'Credit', 'Unpaid', 'Partially Paid'),
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    discount DECIMAL(10, 2) DEFAULT 0.00,
    final_amount DECIMAL(10, 2) DEFAULT 0.00,
    is_archived TINYINT(1) DEFAULT 0
);
-- STOCK TABLE
CREATE TABLE stock (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    supplier_id INT NOT NULL,
    product_name VARCHAR(255),
    category VARCHAR(100),
    quantity DECIMAL(10, 2) DEFAULT 0.00,
    quantity_unit VARCHAR(10),
    number_of_items INT,
    expiry_date DATE,
    actual_price DECIMAL(10, 2),
    selling_price DECIMAL(10, 2),
    fixed_quantity DECIMAL(10, 2),
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    low_stock_threshold DECIMAL(10, 2) DEFAULT 5.00,
    package_size VARCHAR(100)
);
-- CREDIT INTEREST CALCULATIONS TABLE
CREATE TABLE credit_interest_calculations (
    calculation_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    credit_id INT NOT NULL,
    calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    principal_amount DECIMAL(10, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL,
    interest_amount DECIMAL(10, 2),
    month_name VARCHAR(20),
    year INT,
    remaining_balance DECIMAL(10, 2) DEFAULT 0.00,
    duration_days INT
);
-- CREDIT PAYMENTS TABLE
CREATE TABLE credit_payments (
    payment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    credit_id INT NOT NULL,
    user_id INT NOT NULL,
    payment_amount DECIMAL(10, 2),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_notes TEXT
);
CREATE TABLE orders (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    supplier_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity FLOAT NOT NULL,
    quantity_unit VARCHAR(50),
    number_of_items INT,
    order_date DATE,
    status ENUM('Pending', 'Shipped', 'Delivered', 'Cancelled'),
    PRIMARY KEY (id),
    KEY (user_id),
    KEY (supplier_id)
);
CREATE TABLE sale_items (
    id INT NOT NULL AUTO_INCREMENT,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (id),
    KEY (sale_id),
    KEY (product_id)
);