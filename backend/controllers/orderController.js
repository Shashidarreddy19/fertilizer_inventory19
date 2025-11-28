const Order = require('../models/orderModel');

class OrderController {
    static async getAll(req, res) {
        try {
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }
    
            const orders = await Order.getAll(userId);
            
            // Ensure we're sending an array
            const response = Array.isArray(orders) ? orders : [];
            
            res.json(response);
        } 
        catch (err) {
            console.error('Error in OrderController.getAll:', err);
            res.status(500).json({ error: err.message || 'Failed to fetch orders' });
        }
    }

    static async create(req, res) {
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
            } = req.body;

            // Validate required fields
            if (!supplierId || !productName || !quantity || !quantityUnit || !numberOfItems || !userId) {
                return res.status(400).json({ 
                    error: 'Missing required fields',
                    required: [
                        'supplierId',
                        'productName',
                        'quantity',
                        'quantityUnit',
                        'numberOfItems',
                        'userId'
                    ]
                });
            }

            // Validate quantity and numberOfItems are positive numbers
            if (quantity <= 0 || numberOfItems <= 0) {
                return res.status(400).json({ 
                    error: 'Quantity and number of items must be positive numbers' 
                });
            }

            const result = await Order.create({
                userId,
                supplierId,
                productName,
                quantity,
                quantityUnit,
                numberOfItems,
                orderDate: orderDate || new Date(),
                status: status || 'Pending'
            });

            res.status(201).json({ 
                message: 'Order created successfully', 
                orderId: result.insertId 
            });
        } catch (err) {
            console.error('Error in OrderController.create:', err);
            res.status(500).json({ error: err.message || 'Failed to create order' });
        }
    }

    static async update(req, res) {
        try {
            const { id: orderId } = req.params;
            const { 
                supplierId, 
                productName, 
                quantity, 
                quantityUnit, 
                numberOfItems, 
                orderDate, 
                status,
                userId 
            } = req.body;
    
            // Validate required fields
            if (!supplierId || !productName || !quantity || !quantityUnit || !numberOfItems || !orderDate || !userId) {
                return res.status(400).json({ 
                    error: 'All fields are required',
                    required: [
                        'supplierId',
                        'productName',
                        'quantity',
                        'quantityUnit',
                        'numberOfItems',
                        'orderDate',
                        'userId'
                    ]
                });
            }
    
            // Validate quantity and numberOfItems are positive numbers
            if (quantity <= 0 || numberOfItems <= 0) {
                return res.status(400).json({ 
                    error: 'Quantity and number of items must be positive numbers' 
                });
            }

            const result = await Order.update(orderId, {
                supplierId,
                productName,
                quantity,
                quantityUnit,
                numberOfItems,
                orderDate,
                status: status || 'Pending',
                userId
            });
    
            res.json({ 
                message: 'Order updated successfully',
                orderId: orderId
            });
        } catch (err) {
            console.error('Error in OrderController.update:', err);
            if (err.message.includes('not found') || err.message.includes('permission')) {
                return res.status(404).json({ error: err.message });
            }
            res.status(500).json({ error: err.message || 'Failed to update order' });
        }
    }

    static async delete(req, res) {
        try {
            const { id: orderId } = req.params;
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const result = await Order.delete(orderId, userId);
            res.json({ message: 'Order deleted successfully' });
        } catch (err) {
            console.error('Error in OrderController.delete:', err);
            if (err.message.includes('not found') || err.message.includes('permission')) {
                return res.status(404).json({ error: err.message });
            }
            res.status(500).json({ error: err.message || 'Failed to delete order' });
        }
    }

    static async getOrderCount(req, res) {
        try {
            const { userId } = req.query;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const count = await Order.getCount(userId);
            res.json({ count });
        } catch (err) {
            console.error('Error in OrderController.getOrderCount:', err);
            res.status(500).json({ error: err.message || 'Failed to get order count' });
        }
    }
}

module.exports = OrderController;