const db = require('../config/db');

class Customer {
    static async getAll(userId) {
        try {
            const rows = await db.executeQuery(
                'SELECT * FROM customers WHERE user_id = ? ORDER BY customer_name',
                [userId]
            );
            return rows;
        } catch (error) {
            console.error('Error in getAll:', error);
            throw new Error('Failed to fetch customers.');
        }
    }

    static async getById(customerId, userId) {
        try {
            const rows = await db.executeQuery(
                'SELECT * FROM customers WHERE customer_id = ? AND user_id = ?',
                [customerId, userId]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('Error in getById:', error);
            throw new Error('Failed to fetch customer details.');
        }
    }

    static async findByPhone(phone, userId) {
        try {
            const rows = await db.executeQuery(
                'SELECT * FROM customers WHERE phone_number = ? AND user_id = ?',
                [phone, userId]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('Error in findByPhone:', error);
            throw new Error('Failed to check phone number.');
        }
    }

    static async create(customerData) {
        try {
            // Get the last customer_id
            const lastCustomerResult = await db.executeQuery(
                'SELECT customer_id FROM customers ORDER BY customer_id DESC LIMIT 1'
            );

            // Generate new customer_id
            let nextCustomerId = 'CUST001';
            if (lastCustomerResult && lastCustomerResult.length > 0) {
                const lastId = lastCustomerResult[0].customer_id;
                const numPart = parseInt(lastId.substring(4)) + 1;
                nextCustomerId = `CUST${String(numPart).padStart(3, '0')}`;
            }

            const { name, phone, notes, address, userId } = customerData;

            // Insert new customer
            await db.executeQuery(
                `INSERT INTO customers (
                    customer_id, 
                    user_id, 
                    customer_name, 
                    phone_number, 
                    notes, 
                    address, 
                    total_purchases,
                    total_spent, 
                    outstanding_credit,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 0.00, 0.00, NOW())`,
                [nextCustomerId, userId, name, phone, notes || null, address || null]
            );

            // Return the created customer
            const rows = await db.executeQuery(
                'SELECT * FROM customers WHERE customer_id = ?',
                [nextCustomerId]
            );
            
            return rows[0];
        } catch (error) {
            console.error('Error in create:', error);
            throw new Error(error.message || 'Failed to create customer.');
        }
    }

    static async update(customerId, customerData) {
        try {
            const { name, phone, notes, address, userId } = customerData;

            await db.executeQuery(
                `UPDATE customers 
                SET customer_name = ?, 
                    phone_number = ?, 
                    notes = ?, 
                    address = ? 
                WHERE customer_id = ? AND user_id = ?`,
                [name, phone, notes || null, address || null, customerId, userId]
            );

            // Return the updated customer
            const rows = await db.executeQuery(
                'SELECT * FROM customers WHERE customer_id = ?',
                [customerId]
            );
            
            return rows[0] || null;
        } catch (error) {
            console.error('Error in update:', error);
            throw new Error('Failed to update customer.');
        }
    }

    static async delete(customerId, userId) {
        try {
            // First check if customer exists and belongs to the user
            const customer = await db.executeQuery(
                'SELECT * FROM customers WHERE customer_id = ? AND user_id = ?',
                [customerId, userId]
            );

            if (!customer || customer.length === 0) {
                return {
                    success: false,
                    message: 'Customer not found or does not belong to you'
                };
            }

            // Delete sale_items first (they reference sales)
            await db.executeQuery(
                `DELETE si FROM sale_items si 
                 INNER JOIN sales s ON si.sale_id = s.sale_id 
                 WHERE s.customer_id = ?`,
                [customerId]
            );

            // Delete credit_sales records
            await db.executeQuery(
                'DELETE FROM credit_sales WHERE customer_id = ?',
                [customerId]
            );

            // Delete sales records
            await db.executeQuery(
                'DELETE FROM sales WHERE customer_id = ?',
                [customerId]
            );

            // Finally, delete the customer
            await db.executeQuery(
                'DELETE FROM customers WHERE customer_id = ? AND user_id = ?',
                [customerId, userId]
            );

            return {
                success: true,
                message: 'Customer deleted successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: 'An error occurred while deleting the customer'
            };
        }
    }

    static async updateFinancials(customerId, userId, { totalSpent, outstandingCredit }) {
        try {
            await db.executeQuery(
                `UPDATE customers 
                SET total_spent = ?, 
                    outstanding_credit = ? 
                WHERE customer_id = ? AND user_id = ?`,
                [totalSpent, outstandingCredit, customerId, userId]
            );

            // Return the updated customer
            const rows = await db.executeQuery(
                'SELECT * FROM customers WHERE customer_id = ?',
                [customerId]
            );
            
            return rows[0] || null;
        } catch (error) {
            console.error('Error in updateFinancials:', error);
            throw new Error('Failed to update customer financials.');
        }
    }
}

module.exports = Customer;