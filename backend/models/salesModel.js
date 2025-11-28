const db = require('../config/db');

class Sales {
    static async getAll(userId, startDate = null, endDate = null) {
        try {
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
            `;
            const params = [userId];

            if (startDate && endDate) {
                query += ' AND DATE(s.sale_date) BETWEEN ? AND ?';
                params.push(startDate, endDate);
            }

            query += ' GROUP BY s.sale_id ORDER BY s.sale_date DESC';

            const results = await db.executeQuery(query, params);
            const rows = Array.isArray(results) ? results : [];

            return rows.map(sale => ({
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
                totalAmount: parseFloat(sale.total_amount || 0),
                discount: parseFloat(sale.discount || 0),
                finalAmount: parseFloat(sale.final_amount || 0),
                paymentStatus: sale.payment_status,
                creditDetails: sale.credit_amount ? {
                    creditAmount: parseFloat(sale.credit_amount || 0),
                    paidAmount: parseFloat(sale.paid_amount || 0),
                    remainingAmount: parseFloat(sale.remaining_amount || 0),
                    status: sale.credit_status
                } : null
            }));
        } catch (error) {
            console.error('Error in getAll:', error);
            throw new Error('Failed to fetch sales records.');
        }
    }

    static async create(saleData) {
        let connection;
        try {
            const { 
                user_id,
                customer_id,
                sale_date,
                products,
                total_amount,
                discount,
                final_amount,
                payment_status
            } = saleData;
            
            connection = await db.getConnection();
            await connection.beginTransaction();

            // Create sale record
            const [saleResult] = await connection.execute(
                `INSERT INTO sales (
                    user_id, 
                    customer_id, 
                    sale_date, 
                    total_amount, 
                    discount, 
                    final_amount, 
                    payment_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    user_id,
                    customer_id,
                    sale_date || new Date(),
                    total_amount,
                    discount || 0,
                    final_amount,
                    payment_status
                ]
            );

            const saleId = saleResult.insertId;

            // Insert sale items
            for (const product of products) {
                await connection.execute(
                    `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) 
                     VALUES (?, ?, ?, ?)`,
                    [saleId, product.product_id, product.quantity, product.unit_price]
                );

                // Update stock quantity
                await connection.execute(
                    'UPDATE stock SET quantity = quantity - ? WHERE id = ? AND user_id = ?',
                    [product.quantity, product.product_id, user_id]
                );
            }

            // Handle credit sale
            if (payment_status === 'Credit' && customer_id) {
                await connection.execute(
                    `INSERT INTO credit_sales (
                        sale_id, 
                        user_id, 
                        customer_id, 
                        credit_amount,
                        paid_amount, 
                        remaining_amount, 
                        due_date, 
                        status
                    ) VALUES (?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), 'Pending')`,
                    [saleId, user_id, customer_id, final_amount, final_amount]
                );

                // Update customer's outstanding credit
                await connection.execute(
                    'UPDATE customers SET outstanding_credit = outstanding_credit + ? WHERE customer_id = ?',
                    [final_amount, customer_id]
                );
            }

            await connection.commit();
            return { sale_id: saleId, ...saleData };
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error in create:', error);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    static async update(saleId, saleData) {
        try {
            const { customerId, products, totalAmount, paymentStatus, userId } = saleData;
            const result = await db.executeQuery(
                'UPDATE sales SET customer_id = ?, total_amount = ?, payment_status = ? WHERE sale_id = ? AND user_id = ?',
                [customerId, totalAmount, paymentStatus, saleId, userId]
            );
            
            if (result.affectedRows === 0) {
                throw new Error('Sale record not found or unauthorized update attempt.');
            }
            
            return result;
        } catch (error) {
            console.error('Error in update:', error);
            throw new Error('Failed to update sale record.');
        }
    }

    static async delete(saleId, userId) {
        let connection;
        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            // First check if sale exists and belongs to the user
            const [saleRows] = await connection.execute(
                'SELECT * FROM sales WHERE sale_id = ? AND user_id = ?',
                [saleId, userId]
            );

            if (!saleRows || saleRows.length === 0) {
                throw new Error('Sale not found or unauthorized delete attempt.');
            }

            // Delete sale items first
            await connection.execute(
                'DELETE FROM sale_items WHERE sale_id = ?',
                [saleId]
            );

            // Then delete the sale
            const [result] = await connection.execute(
                'DELETE FROM sales WHERE sale_id = ? AND user_id = ?',
                [saleId, userId]
            );
            
            await connection.commit();
            return result;
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error in delete:', error);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    static async getDailyStats(userId, date) {
        try {
            const query = `
                SELECT 
                    COUNT(DISTINCT s.sale_id) as totalSales,
                    COALESCE(SUM(si.quantity), 0) as totalItems,
                    COALESCE(SUM(s.final_amount), 0) as finalAmount,
                    (
                        SELECT GROUP_CONCAT(CONCAT(sub.product_name, ':', sub.totalQuantity, ':', sub.unit) ORDER BY sub.totalQuantity DESC)
                        FROM (
                            SELECT 
                                st.product_name, 
                                st.quantity_unit as unit,
                                COALESCE(SUM(si.quantity), 0) as totalQuantity
                            FROM sale_items si
                            LEFT JOIN stock st ON si.product_id = st.id
                            WHERE si.sale_id IN (SELECT sale_id FROM sales WHERE user_id = ? AND DATE(sale_date) = ?)
                            GROUP BY st.product_name, st.quantity_unit
                            ORDER BY totalQuantity DESC
                            LIMIT 5
                        ) as sub
                    ) as topProducts
                FROM sales s
                LEFT JOIN sale_items si ON s.sale_id = si.sale_id
                WHERE s.user_id = ? AND DATE(s.sale_date) = ?
                GROUP BY s.user_id
            `;

            const results = await db.executeQuery(query, [userId, date, userId, date]);
            const stats = results[0] || {
                totalSales: 0,
                totalItems: 0,
                finalAmount: 0,
                topProducts: ''
            };

            return {
                totalSales: parseFloat(stats.totalSales || 0),
                totalItems: parseFloat(stats.totalItems || 0),
                finalAmount: parseFloat(stats.finalAmount || 0),
                topProducts: stats.topProducts ? 
                    stats.topProducts.split(',').map(product => {
                        const [name, quantity, unit] = product.split(':');
                        return { 
                            name, 
                            quantity: parseFloat(quantity || 0),
                            unit: unit || ''
                        };
                    }) : []
            };
        } catch (error) {
            console.error('Error in getDailyStats:', error);
            throw new Error('Failed to fetch daily statistics.');
        }
    }

    static async getSaleDetails(saleId, userId) {
        try {
            const query = `
                SELECT s.*, c.customer_name, c.phone, c.address,
                    st.product_name, st.quantity_unit,
                    si.quantity, si.unit_price, si.total_price,
                    cs.credit_amount, cs.paid_amount, cs.remaining_amount, cs.status as credit_status,
                    cs.due_date
                FROM sales s
                LEFT JOIN customers c ON s.customer_id = c.customer_id
                LEFT JOIN sale_items si ON s.sale_id = si.sale_id
                LEFT JOIN stock st ON si.product_id = st.id
                LEFT JOIN credit_sales cs ON s.sale_id = cs.credit_id
                WHERE s.sale_id = ? AND s.user_id = ?
            `;
            
            const [rows] = await db.execute(query, [saleId, userId]);
            if (!rows.length) return null;

            const sale = {
                saleId: rows[0].sale_id,
                saleDate: rows[0].sale_date,
                customerName: rows[0].customer_name,
                phone: rows[0].phone,
                address: rows[0].address,
                totalAmount: parseFloat(rows[0].total_amount),
                discount: parseFloat(rows[0].discount || 0),
                finalAmount: parseFloat(rows[0].final_amount),
                paymentStatus: rows[0].payment_status,
                creditDetails: rows[0].credit_amount ? {
                    creditAmount: parseFloat(rows[0].credit_amount),
                    paidAmount: parseFloat(rows[0].paid_amount),
                    remainingAmount: parseFloat(rows[0].remaining_amount),
                    status: rows[0].credit_status,
                    dueDate: rows[0].due_date
                } : null,
                products: rows.map(row => ({
                    name: row.product_name,
                    quantity: parseFloat(row.quantity),
                    unit: row.quantity_unit,
                    unitPrice: parseFloat(row.unit_price),
                    totalPrice: parseFloat(row.total_price)
                }))
            };

            return sale;
        } catch (error) {
            console.error('Error in getSaleDetails:', error);
            throw new Error('Failed to fetch sale details.');
        }
    }

    static async getStats(userId) {
        try {
            const [result] = await db.execute(
                'SELECT COUNT(*) as totalSales, SUM(total_amount) as totalRevenue FROM sales WHERE user_id = ?',
                [userId]
            );
            
            return {
                totalSales: result[0]?.totalSales || 0,
                totalRevenue: result[0]?.totalRevenue || 0
            };
        } catch (error) {
            console.error('Error in getStats:', error);
            throw new Error('Failed to fetch sales statistics.');
        }
    }

    static async archiveSale(saleId, userId) {
        let connection;
        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            // First check if sale exists and belongs to the user
            const [saleRows] = await connection.execute(
                'SELECT * FROM sales WHERE sale_id = ? AND user_id = ?',
                [saleId, userId]
            );

            if (!saleRows || saleRows.length === 0) {
                throw new Error('Sale not found or unauthorized archive attempt.');
            }

            // Update the sale to mark it as archived
            const [result] = await connection.execute(
                'UPDATE sales SET is_archived = 1 WHERE sale_id = ? AND user_id = ?',
                [saleId, userId]
            );

            await connection.commit();
            return result;
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error in archiveSale:', error);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
}

module.exports = Sales;