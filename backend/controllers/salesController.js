const db = require('../config/db');
const Sales = require('../models/salesModel');
const Stock = require('../models/stockModel');

class SalesController {
    static async getAll(req, res) {
        try {
            const { userId, startDate, endDate } = req.query;
            const showArchived = req.query.includeArchived === 'true';

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            let query = `
                SELECT s.*, c.customer_name,
                    GROUP_CONCAT(st.product_name) as product_names,
                    GROUP_CONCAT(si.quantity) as quantities,
                    GROUP_CONCAT(si.unit_price) as unit_prices,
                    GROUP_CONCAT(si.total_price) as total_prices,
                    cs.credit_amount, cs.paid_amount, cs.remaining_amount, cs.status as credit_status
                FROM sales s
                LEFT JOIN customers c ON s.customer_id = c.customer_id
                LEFT JOIN sale_items si ON s.sale_id = si.sale_id
                LEFT JOIN stock st ON si.product_id = st.id
                LEFT JOIN credit_sales cs ON s.sale_id = cs.credit_id
                WHERE s.user_id = ?
                ${showArchived ? 'AND s.is_archived = 1' : 'AND (s.is_archived = 0 OR s.is_archived IS NULL)'}
            `;
            const params = [userId];

            if (startDate && endDate) {
                query += ' AND DATE(s.sale_date) BETWEEN ? AND ?';
                params.push(startDate, endDate);
            }

            query += ' GROUP BY s.sale_id ORDER BY s.sale_date DESC';
            
            const results = await db.executeQuery(query, params);
            
            // Ensure results is an array and handle empty results
            const rows = Array.isArray(results) ? results : [];
            
            const sales = rows.map(sale => ({
                saleId: sale.sale_id,
                customerId: sale.customer_id,
                customerName: sale.customer_name,
                saleDate: sale.sale_date,
                products: sale.product_names ? 
                    sale.product_names.split(',').map((name, i) => ({
                        name,
                        quantity: parseFloat(sale.quantities?.split(',')[i] || 0),
                        unitPrice: parseFloat(sale.unit_prices?.split(',')[i] || 0),
                        totalPrice: parseFloat(sale.total_prices?.split(',')[i] || 0)
                    })) : [],
                discount: parseFloat(sale.discount || 0),
                finalAmount: parseFloat(sale.final_amount || 0),
                paymentType: sale.payment_type || 'cash',
                isArchived: Boolean(sale.is_archived),
                creditDetails: sale.credit_amount ? {
                    creditAmount: parseFloat(sale.credit_amount || 0),
                    paidAmount: parseFloat(sale.paid_amount || 0),
                    remainingAmount: parseFloat(sale.remaining_amount || 0),
                    status: sale.credit_status
                } : null
            }));

            res.json(sales);
        } catch (error) {
            console.error('Error fetching sales:', error);
            res.status(500).json({ error: 'Failed to fetch sales' });
        }
    }

    static async create(req, res) {
        try {
            const userId = req.headers.userid || req.body.user_id;
            const { customer_id, sale_date, products, total_amount, discount, final_amount, payment_method } = req.body;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            if (!products || !Array.isArray(products) || products.length === 0) {
                return res.status(400).json({ error: 'Products are required' });
            }

            // Map payment_method to payment_status
            let payment_status;
            switch(payment_method?.toLowerCase()) {
                case 'card':
                case 'cash':
                    payment_status = 'Paid';
                    break;
                default:
                    payment_status = 'Unpaid';
            }

            // Use executeTransaction for the entire sale process
            await db.executeTransaction(async (connection) => {
                // Insert into sales table with proper null handling
                const [saleResult] = await connection.execute(
                    `INSERT INTO sales (
                        user_id, customer_id, sale_date, total_amount, discount, 
                        final_amount, payment_status, payment_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        customer_id || null,
                        sale_date || new Date(),
                        parseFloat(total_amount) || 0,
                        parseFloat(discount) || 0,
                        parseFloat(final_amount) || 0,
                        payment_status,
                        payment_method?.toLowerCase() || 'cash' // Store the actual payment method
                    ]
                );

                const saleId = saleResult.insertId;

                // Insert sale items with proper validation
                for (const product of products) {
                    if (!product.product_id || !product.quantity || !product.unit_price) {
                        throw new Error('Invalid product data');
                    }

                    // Get current stock details
                    const [stockRows] = await connection.execute(
                        'SELECT number_of_items, package_size FROM stock WHERE id = ? AND user_id = ?',
                        [product.product_id, userId]
                    );

                    if (stockRows.length === 0) {
                        throw new Error(`Product with ID ${product.product_id} not found in stock`);
                    }

                    const stock = stockRows[0];
                    const numberOfItems = parseInt(product.quantity);

                    if (numberOfItems > stock.number_of_items) {
                        throw new Error(`Insufficient stock for product ID ${product.product_id}. Available: ${stock.number_of_items} items`);
                    }

                    // Insert sale details - store both number of items and total quantity
                    await connection.execute(
                        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_quantity) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            saleId,
                            parseInt(product.product_id),
                            numberOfItems,
                            parseFloat(product.unit_price),
                            parseFloat(product.total_quantity) || (numberOfItems * (stock.package_size || 1))
                        ]
                    );

                    // Update stock - reduce number_of_items and recalculate quantity
                    await connection.execute(
                        'UPDATE stock SET number_of_items = number_of_items - ?, quantity = (number_of_items - ?) * COALESCE(package_size, 1) WHERE id = ? AND user_id = ?',
                        [
                            numberOfItems,
                            numberOfItems,
                            parseInt(product.product_id),
                            userId
                        ]
                    );
                }
            });

            res.status(201).json({ message: 'Sale created successfully' });
        } catch (error) {
            console.error('Error creating sale:', error);
            res.status(500).json({ error: error.message || 'Failed to create sale' });
        }
    }

    static async getSaleDetails(req, res) {
        try {
            const { id: saleId } = req.params;
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const query = `
                SELECT s.*, 
                    c.customer_name, 
                    c.phone,
                    c.address,
                    si.product_id, 
                    si.quantity, 
                    si.unit_price,
                    st.product_name, 
                    st.quantity_unit
                FROM sales s
                LEFT JOIN customers c ON s.customer_id = c.customer_id
                LEFT JOIN sale_items si ON s.sale_id = si.sale_id
                LEFT JOIN stock st ON si.product_id = st.id
                WHERE s.sale_id = ? AND s.user_id = ?
            `;

            const results = await db.executeQuery(query, [saleId, userId]);
            
            if (!results || results.length === 0) {
                return res.status(404).json({ error: 'Sale not found' });
            }

            const sale = {
                saleId: results[0].sale_id,
                customerId: results[0].customer_id,
                customerName: results[0].customer_name,
                phone: results[0].phone,
                address: results[0].address,
                saleDate: results[0].sale_date,
                products: results.map(row => ({
                    productId: row.product_id,
                    productName: row.product_name,
                    quantity: parseFloat(row.quantity || 0),
                    unit: row.quantity_unit,
                    unitPrice: parseFloat(row.unit_price || 0),
                    totalPrice: parseFloat(row.quantity || 0) * parseFloat(row.unit_price || 0)
                })),
                totalAmount: parseFloat(results[0].total_amount || 0),
                discount: parseFloat(results[0].discount || 0),
                finalAmount: parseFloat(results[0].final_amount || 0),
                paymentStatus: results[0].payment_status
            };

            res.json(sale);
        } catch (error) {
            console.error('Error fetching sale details:', error);
            res.status(500).json({ error: 'Failed to fetch sale details' });
        }
    }

    static async getSalesStats(req, res) {
        try {
            const { userId, date } = req.query;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const query = `
                SELECT 
                    COUNT(DISTINCT s.sale_id) as total_sales,
                    COUNT(*) as total_items,
                    SUM(s.final_amount) as final_amount,
                    SUM(s.discount) as total_discount
                FROM sales s
                WHERE s.user_id = ?
                ${date ? 'AND DATE(s.sale_date) = ?' : ''}
            `;

            const params = [userId];
            if (date) params.push(date);

            const results = await db.executeQuery(query, params);
            const stats = results[0]?.[0] || {};

            // Get top selling products
            const productsQuery = `
                SELECT 
                    st.product_name,
                    SUM(si.quantity) as total_quantity
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.sale_id
                JOIN stock st ON si.product_id = st.id
                WHERE s.user_id = ?
                ${date ? 'AND DATE(s.sale_date) = ?' : ''}
                GROUP BY st.product_name
                ORDER BY total_quantity DESC
                LIMIT 5
            `;

            const productResults = await db.executeQuery(productsQuery, params);
            const productsSold = productResults[0] || [];

            res.json({
                totalSales: parseFloat(stats.total_sales || 0),
                totalItems: parseFloat(stats.total_items || 0),
                finalAmount: parseFloat(stats.final_amount || 0),
                totalDiscount: parseFloat(stats.total_discount || 0),
                productsSold: productsSold.map(p => ({
                    name: p.product_name,
                    quantity: parseFloat(p.total_quantity || 0)
                }))
            });
        } catch (error) {
            console.error('Error getting sales stats:', error);
            res.status(500).json({ error: 'Failed to get sales statistics' });
        }
    }

    static async update(req, res) {
        try {
            const { id: saleId } = req.params;
            const { userId } = req.query;
            const { customerId, totalAmount, paymentStatus } = req.body;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            if (!totalAmount || !paymentStatus) {
                return res.status(400).json({ error: 'Total amount and payment status are required' });
            }

            const query = `
                UPDATE sales 
                SET customer_id = ?,
                    total_amount = ?,
                    payment_status = ?
                WHERE sale_id = ? AND user_id = ?
            `;

            const result = await db.executeQuery(query, [
                customerId || null,
                totalAmount,
                paymentStatus,
                saleId,
                userId
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Sale not found or no permission to update' });
            }
            res.json({ message: 'Sale updated successfully' });
        } catch (error) {
            console.error('Error updating sale:', error);
            res.status(500).json({ error: 'Failed to update sale' });
        }
    }

    static async delete(req, res) {
        try {
            const saleId = parseInt(req.params.id);
            const userId = parseInt(req.headers.userid);

            if (!saleId || isNaN(saleId)) {
                return res.status(400).json({ error: 'Invalid sale ID' });
            }

            if (!userId || isNaN(userId)) {
                return res.status(400).json({ error: 'Invalid user ID' });
            }

            await db.executeTransaction(async (connection) => {
                // First check if sale exists and belongs to the user
                const [saleRows] = await connection.execute(
                    'SELECT * FROM sales WHERE sale_id = ? AND user_id = ?',
                    [saleId, userId]
                );

                if (!saleRows || saleRows.length === 0) {
                    return res.status(404).json({ error: 'Sale not found' });
                }

                // Delete sale items first
                await connection.execute(
                    'DELETE FROM sale_items WHERE sale_id = ?',
                    [saleId]
                );

                // Then delete the sale
                await connection.execute(
                    'DELETE FROM sales WHERE sale_id = ? AND user_id = ?',
                    [saleId, userId]
                );
            });

            res.json({ message: 'Sale deleted successfully' });
        } catch (error) {
            console.error('Error deleting sale:', error);
            res.status(500).json({ error: 'Failed to delete sale' });
        }
    }

    static async exportSalesReport(req, res) {
        try {
            const { userId, startDate, endDate } = req.query;
            if (!userId || !startDate || !endDate) {
                return res.status(400).json({ error: 'User ID and date range are required' });
            }

            const query = `
                SELECT 
                    s.sale_date,
                    c.customer_name,
                    GROUP_CONCAT(st.product_name) as products,
                    GROUP_CONCAT(si.quantity) as quantities,
                    GROUP_CONCAT(si.unit_price) as unit_prices,
                    GROUP_CONCAT(si.total_price) as total_prices,
                    s.discount,
                    s.final_amount,
                    s.payment_type,
                    CASE 
                        WHEN s.payment_type = 'credit' 
                        THEN COALESCE(cs.remaining_amount, 0) 
                        ELSE 0 
                    END as remaining_credit
                FROM sales s
                LEFT JOIN customers c ON s.customer_id = c.customer_id
                LEFT JOIN sale_items si ON s.sale_id = si.sale_id
                LEFT JOIN stock st ON si.product_id = st.product_id
                LEFT JOIN credit_sales cs ON s.sale_id = cs.sale_id
                WHERE s.user_id = ?
                    AND DATE(s.sale_date) BETWEEN ? AND ?
                GROUP BY s.sale_id
                ORDER BY s.sale_date DESC
            `;

            const [rows] = await db.executeQuery(query, [userId, startDate, endDate]);
            
            // Convert to CSV format
            const csvRows = rows.map(row => {
                const products = row.products.split(',');
                const quantities = row.quantities.split(',');
                const unitPrices = row.unit_prices.split(',');
                const totalPrices = row.total_prices.split(',');
                
                const productDetails = products.map((product, i) => 
                    `${product} (${quantities[i]} @ ₹${unitPrices[i]})`
                ).join('; ');

                return [
                    new Date(row.sale_date).toLocaleDateString(),
                    row.customer_name,
                    productDetails,
                    `${row.discount}%`,
                    `₹${row.final_amount}`,
                    row.payment_type,
                    row.payment_type === 'credit' ? `₹${row.remaining_credit}` : 'N/A'
                ].join(',');
            });

            const csvHeader = 'Date,Customer,Products,Discount,Final Amount,Payment Type,Remaining Credit\n';
            const csvContent = csvHeader + csvRows.join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-to-${endDate}.csv`);
            res.send(csvContent);
        } catch (error) {
            console.error('Error exporting sales report:', error);
            res.status(500).json({ error: 'Failed to export sales report' });
        }
    }

    static async getAvailableProducts(req, res) {
        try {
            const { userId } = req.query;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const query = `
                SELECT 
                    id,
                    product_name,
                    quantity,
                    quantity_unit,
                    selling_price,
                    fixed_quantity
                FROM stock 
                WHERE user_id = ? 
                AND quantity > 0
                ORDER BY product_name ASC
            `;

            const [rows] = await db.executeQuery(query, [userId]);
            
            // Ensure rows is an array
            const products = Array.isArray(rows) ? rows.map(product => ({
                id: product.id,
                name: product.product_name,
                stock: product.quantity,
                unit: product.quantity_unit,
                selling_price: product.selling_price,
                fixed_quantity: product.fixed_quantity
            })) : [];
            
            res.json(products);
        } catch (error) {
            console.error('Error fetching available products:', error);
            res.status(500).json({ error: 'Failed to fetch products' });
        }
    }

    static async getDailyStats(req, res) {
        try {
            const userId = req.headers.userid || req.query.userId;
            const date = req.query.date || new Date().toISOString().split('T')[0];

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const statsQuery = `
                SELECT 
                    COUNT(DISTINCT s.sale_id) as totalSales,
                    COALESCE(SUM(si.quantity), 0) as totalItems,
                    COALESCE(SUM(s.final_amount), 0) as finalAmount
                FROM sales s
                LEFT JOIN sale_items si ON s.sale_id = si.sale_id
                WHERE s.user_id = ? AND DATE(s.sale_date) = ?
                GROUP BY s.user_id`;

            const topProductsQuery = `
                SELECT 
                    st.product_name, 
                    st.quantity_unit as unit,
                    COALESCE(SUM(si.quantity), 0) as totalQuantity
                FROM sale_items si
                LEFT JOIN stock st ON si.product_id = st.id
                WHERE si.sale_id IN (SELECT sale_id FROM sales WHERE user_id = ? AND DATE(sale_date) = ?)
                GROUP BY st.product_name, st.quantity_unit
                ORDER BY totalQuantity DESC
                LIMIT 5`;

            const statsResults = await db.executeQuery(statsQuery, [userId, date]);
            const topProductsResults = await db.executeQuery(topProductsQuery, [userId, date]);

            // Handle case where statsResults might be empty or undefined
            const stats = (statsResults && statsResults.length > 0) ? statsResults[0] : {
                totalSales: 0,
                totalItems: 0,
                finalAmount: 0
            };

            // Handle case where topProductsResults might be empty or undefined
            const topProducts = Array.isArray(topProductsResults) ? topProductsResults : [];

            const response = {
                totalSales: parseFloat(stats.totalSales || 0),
                totalItems: parseFloat(stats.totalItems || 0),
                finalAmount: parseFloat(stats.finalAmount || 0),
                topProducts: topProducts.map(product => ({
                    name: product.product_name || '',
                    quantity: parseFloat(product.totalQuantity || 0),
                    unit: product.unit || ''
                }))
            };

            res.json(response);
        } catch (error) {
            console.error('Error getting daily stats:', error);
            res.status(500).json({ error: 'Failed to get daily statistics' });
        }
    }

    static async archiveSale(req, res) {
        try {
            const saleId = parseInt(req.params.id);
            const userId = parseInt(req.headers.userid);

            if (!saleId || isNaN(saleId)) {
                return res.status(400).json({ error: 'Invalid sale ID' });
            }

            if (!userId || isNaN(userId)) {
                return res.status(400).json({ error: 'Invalid user ID' });
            }

            await db.executeTransaction(async (connection) => {
                // First check if sale exists and belongs to the user
                const [saleRows] = await connection.execute(
                    'SELECT * FROM sales WHERE sale_id = ? AND user_id = ?',
                    [saleId, userId]
                );

                if (!saleRows || saleRows.length === 0) {
                    return res.status(404).json({ error: 'Sale not found' });
                }

                // Update the sale to mark it as archived
                await connection.execute(
                    'UPDATE sales SET is_archived = 1 WHERE sale_id = ? AND user_id = ?',
                    [saleId, userId]
                );
            });

            res.json({ message: 'Sale archived successfully' });
        } catch (error) {
            console.error('Error archiving sale:', error);
            res.status(500).json({ error: 'Failed to archive sale' });
        }
    }

    static async unarchiveSale(req, res) {
        try {
            const saleId = parseInt(req.params.id);
            const userId = parseInt(req.headers.userid);

            if (!saleId || isNaN(saleId)) {
                return res.status(400).json({ error: 'Invalid sale ID' });
            }

            if (!userId || isNaN(userId)) {
                return res.status(400).json({ error: 'Invalid user ID' });
            }

            await db.executeTransaction(async (connection) => {
                // First check if sale exists and belongs to the user
                const [saleRows] = await connection.execute(
                    'SELECT * FROM sales WHERE sale_id = ? AND user_id = ?',
                    [saleId, userId]
                );

                if (!saleRows || saleRows.length === 0) {
                    return res.status(404).json({ error: 'Sale not found' });
                }

                // Update the sale to mark it as unarchived
                await connection.execute(
                    'UPDATE sales SET is_archived = 0 WHERE sale_id = ? AND user_id = ?',
                    [saleId, userId]
                );
            });

            res.json({ message: 'Sale unarchived successfully' });
        } catch (error) {
            console.error('Error unarchiving sale:', error);
            res.status(500).json({ error: 'Failed to unarchive sale' });
        }
    }

    static async createSale(req, res) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const { customerId, products, userId, payment_amount } = req.body;

            // Create the sale first
            const saleId = await Sales.create(customerId, userId, payment_amount, conn);

            // Insert sale items
            await Sales.insertSaleItems(saleId, products, conn);

            // Update stock quantities
            await Stock.updateStockQuantities(products, userId, 'subtract', conn);

            await conn.commit();
            res.status(201).json({ message: 'Sale created successfully', saleId });
        } catch (error) {
            await conn.rollback();
            console.error('Error in createSale:', error);
            res.status(500).json({ error: error.message });
        } finally {
            conn.release();
        }
    }

    static async deleteSale(req, res) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const saleId = req.params.id;
            const userId = req.body.userId;

            // Get the products from the sale before deleting
            const [products] = await conn.execute(
                `SELECT product_id, number_of_items FROM sale_items WHERE sale_id = ?`,
                [saleId]
            );

            // Delete the sale and its items
            await Sales.delete(saleId, conn);

            // Add the quantities back to stock
            if (products.length > 0) {
                await Stock.updateStockQuantities(products, userId, 'add', conn);
            }

            await conn.commit();
            res.json({ message: 'Sale deleted successfully' });
        } catch (error) {
            await conn.rollback();
            console.error('Error in deleteSale:', error);
            res.status(500).json({ error: error.message });
        } finally {
            conn.release();
        }
    }
}

module.exports = SalesController;