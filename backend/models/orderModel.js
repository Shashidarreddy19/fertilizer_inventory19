const db = require('../config/db');

class Order {
    static async getAll(userId) {
        try {
            const query = `
                SELECT 
                    o.id,
                    o.user_id,
                    o.supplier_id,
                    o.product_name,
                    o.quantity,
                    o.quantity_unit,
                    o.number_of_items,
                    DATE_FORMAT(o.order_date, '%Y-%m-%d') as order_date,
                    o.status,
                    s.name as supplier_name
                FROM orders o
                LEFT JOIN suppliers s ON o.supplier_id = s.id
                WHERE o.user_id = ?
                ORDER BY o.order_date DESC, o.id DESC
            `;
            
            const rows = await db.executeQuery(query, [userId]);
            
            if (!Array.isArray(rows)) {
                console.error('Invalid response from database:', rows);
                return [];
            }

            return rows.map(row => ({
                id: row.id,
                user_id: row.user_id,
                supplier_id: row.supplier_id,
                product_name: row.product_name,
                quantity: row.quantity,
                quantity_unit: row.quantity_unit,
                number_of_items: row.number_of_items,
                order_date: row.order_date,
                status: row.status,
                supplier_name: row.supplier_name || 'N/A'
            }));
        } catch (error) {
            console.error('Error in Order.getAll:', error);
            throw new Error('Failed to retrieve orders');
        }
    }

    static async create(orderData) {
        try {
            const { 
                userId,
                supplierId,
                productName,
                quantity,
                quantityUnit,
                numberOfItems,
                orderDate,
                status
            } = orderData;
            
            const query = `
                INSERT INTO orders 
                (user_id, supplier_id, product_name, quantity, quantity_unit, 
                number_of_items, order_date, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const [result] = await db.executeQuery(query, [
                userId,
                supplierId,
                productName,
                quantity,
                quantityUnit,
                numberOfItems,
                orderDate || new Date(),
                status || 'Pending'
            ]);
            
            return result;
        } catch (error) {
            console.error('Error in Order.create:', error);
            throw new Error('Failed to create order');
        }
    }

    static async update(orderId, orderData) {
        try {
            const { 
                supplierId, 
                productName, 
                quantity, 
                quantityUnit, 
                numberOfItems, 
                orderDate,
                status, 
                userId 
            } = orderData;
    
            const query = `
                UPDATE orders 
                SET supplier_id = ?, 
                    product_name = ?, 
                    quantity = ?, 
                    quantity_unit = ?, 
                    number_of_items = ?, 
                    order_date = ?,
                    status = ?
                WHERE id = ? AND user_id = ?
            `;
            
            const [result] = await db.executeQuery(query, [
                supplierId,
                productName,
                quantity,
                quantityUnit,
                numberOfItems,
                orderDate,
                status || 'Pending',
                orderId,
                userId
            ]);

            if (result.affectedRows === 0) {
                throw new Error('Order not found or you do not have permission to update it');
            }

            return result;
        } catch (error) {
            console.error('Error in Order.update:', error);
            throw new Error('Failed to update order: ' + error.message);
        }
    }

    static async delete(orderId, userId) {
        try {
            const query = `
                DELETE FROM orders 
                WHERE id = ? AND user_id = ?
            `;
            const [result] = await db.executeQuery(query, [orderId, userId]);
            
            if (result.affectedRows === 0) {
                throw new Error('Order not found or you do not have permission to delete it');
            }
            
            return result;
        } catch (error) {
            console.error('Error in Order.delete:', error);
            throw new Error('Failed to delete order');
        }
    }

    static async getCount(userId) {
        try {
            const query = `
                SELECT COUNT(*) as count 
                FROM orders 
                WHERE user_id = ?
            `;
            const [result] = await db.executeQuery(query, [userId]);
            return result[0]?.count || 0;
        } catch (error) {
            console.error('Error in Order.getCount:', error);
            throw new Error('Failed to retrieve order count');
        }
    }
}

module.exports = Order;