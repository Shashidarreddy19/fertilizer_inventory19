const Customer = require('../models/customerModel');
const db = require('../config/db');

class CustomerController {
    static async getAllCustomers(req, res) {
        try {
            const userId = req.userId;
            function getUserId(req) {
                return req.userId 
                        || req.body?.userId 
                        || req.query?.userId 
                        || null;
                    }


            // Get all customers with their basic information
            const customers = await Customer.getAll(userId);

            // Get sales history for all customers using existing tables
            const salesQuery = `
                SELECT s.*, 
                    s.customer_id,
                    GROUP_CONCAT(
                        JSON_OBJECT(
                            'product_id', si.product_id,
                            'name', st.product_name,
                            'quantity', si.quantity,
                            'unit', st.quantity_unit,
                            'price', si.unit_price
                        )
                    ) as products,
                    cs.credit_amount,
                    cs.paid_amount,
                    cs.remaining_amount,
                    cs.status as credit_status
                FROM sales s
                LEFT JOIN sale_items si ON s.sale_id = si.sale_id
                LEFT JOIN stock st ON si.product_id = st.id
                LEFT JOIN credit_sales cs ON s.sale_id = cs.credit_id
                WHERE s.user_id = ?
                GROUP BY s.sale_id
                ORDER BY s.sale_date DESC`;

            const allSales = await db.executeQuery(salesQuery, [userId]);

            // Format the response with sales history
            const formattedCustomers = customers.map(customer => {
                const customerSales = allSales.filter(s => s.customer_id === customer.customer_id)
                    .map(sale => ({
                        id: sale.sale_id,
                        date: sale.sale_date,
                        type: sale.payment_type || 'cash',
                        status: sale.credit_status || 'completed',
                        total: parseFloat(sale.final_amount),
                        products: JSON.parse(`[${sale.products}]`),
                        creditDetails: sale.credit_amount ? {
                            creditAmount: parseFloat(sale.credit_amount),
                            paidAmount: parseFloat(sale.paid_amount),
                            remainingAmount: parseFloat(sale.remaining_amount),
                            status: sale.credit_status
                        } : null
                    }));

                return {
                    id: customer.customer_id,
                    name: customer.customer_name,
                    phone: customer.phone_number,
                    notes: customer.notes,
                    address: customer.address,
                    createdAt: customer.created_at,
                    totalPurchases: parseInt(customer.total_purchases || 0),
                    totalSpent: parseFloat(customer.total_spent || 0),
                    outstandingCredit: parseFloat(customer.outstanding_credit || 0),
                    sales: customerSales
                };
            });

            res.json(formattedCustomers);
        } catch (error) {
            console.error('Error fetching customers:', error);
            res.status(500).json({ error: 'Error fetching customers' });
        }
    }

    static async getCustomerById(req, res) {
        try {
            const userId = req.userId;
            const customerId = req.params.id;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const customer = await Customer.getById(customerId, userId);
            if (!customer) {
                return res.status(404).json({ message: 'Customer not found' });
            }

            // Get customer's sales history
            const sales = await db.executeQuery(
                `SELECT s.*, 
                    GROUP_CONCAT(
                        JSON_OBJECT(
                            'product_id', si.product_id,
                            'name', st.product_name,
                            'quantity', si.quantity,
                            'unit', st.quantity_unit,
                            'price', si.unit_price
                        )
                    ) as products,
                    cs.credit_amount,
                    cs.paid_amount,
                    cs.remaining_amount,
                    cs.status as credit_status
                FROM sales s
                LEFT JOIN sale_items si ON s.sale_id = si.sale_id
                LEFT JOIN stock st ON si.product_id = st.id
                LEFT JOIN credit_sales cs ON s.sale_id = cs.credit_id
                WHERE s.customer_id = ? AND s.user_id = ?
                GROUP BY s.sale_id
                ORDER BY s.sale_date DESC`,
                [customerId, userId]
            );

            const formattedCustomer = {
                id: customer.customer_id,
                name: customer.customer_name,
                phone: customer.phone_number,
                notes: customer.notes,
                address: customer.address,
                createdAt: customer.created_at,
                totalPurchases: parseInt(customer.total_purchases || 0),
                totalSpent: parseFloat(customer.total_spent || 0),
                outstandingCredit: parseFloat(customer.outstanding_credit || 0),
                sales: sales.map(sale => ({
                    id: sale.sale_id,
                    date: sale.sale_date,
                    type: sale.payment_type || 'cash',
                    status: sale.credit_status || 'completed',
                    total: parseFloat(sale.final_amount),
                    products: JSON.parse(`[${sale.products}]`),
                    creditDetails: sale.credit_amount ? {
                        creditAmount: parseFloat(sale.credit_amount),
                        paidAmount: parseFloat(sale.paid_amount),
                        remainingAmount: parseFloat(sale.remaining_amount),
                        status: sale.credit_status
                    } : null
                }))
            };

            res.json(formattedCustomer);
        } catch (error) {
            console.error('Error fetching customer:', error);
            res.status(500).json({ message: 'Error fetching customer details' });
        }
    }

    static async createCustomer(req, res) {
        try {
            const { name, phone, notes, address} = req.body;
            const userId = req.userId;

            // Validate required fields
            if (!name || !phone || !userId) {
                return res.status(400).json({ message: 'Name, phone, and user ID are required' });
            }

            // Check if phone number already exists
            const existingCustomer = await Customer.findByPhone(phone, userId);
            if (existingCustomer) {
                return res.status(400).json({ message: 'Phone number already registered' });
            }

            const customer = await Customer.create({
                name,
                phone,
                notes,
                address,
                userId
            });

            res.status(201).json({
                id: customer.customer_id,
                name: customer.customer_name,
                phone: customer.phone_number,
                notes: customer.notes,
                address: customer.address,
                createdAt: customer.created_at,
                totalPurchases: parseInt(customer.total_purchases || 0),
                totalSpent: parseFloat(customer.total_spent || 0),
                outstandingCredit: parseFloat(customer.outstanding_credit || 0)
            });
        } catch (error) {
            console.error('Error creating customer:', error);
            res.status(500).json({ message: 'Error creating customer' });
        }
    }

    static async updateCustomer(req, res) {
        try {
            const { name, phone, notes, address} = req.body;
            const customerId = req.params.id;
            const userId = req.userId;

            // Validate required fields
            if (!name || !phone || !userId) {
                return res.status(400).json({ message: 'Name, phone, and user ID are required' });
            }

            // Check if phone number exists for other customers
            const existingCustomer = await Customer.findByPhone(phone, userId);
            if (existingCustomer && existingCustomer.customer_id !== customerId) {
                return res.status(400).json({ message: 'Phone number already registered to another customer' });
            }

            const customer = await Customer.update(customerId, {
                name,
                phone,
                notes,
                address,
                userId
            });

            if (!customer) {
                return res.status(404).json({ message: 'Customer not found' });
            }

            res.json({
                id: customer.customer_id,
                name: customer.customer_name,
                phone: customer.phone_number,
                notes: customer.notes,
                address: customer.address,
                totalPurchases: parseInt(customer.total_purchases || 0),
                totalSpent: parseFloat(customer.total_spent || 0),
                outstandingCredit: parseFloat(customer.outstanding_credit || 0)
            });
        } catch (error) {
            console.error('Error updating customer:', error);
            res.status(500).json({ message: 'Error updating customer' });
        }
    }

    static async deleteCustomer(req, res) {
        try {
            const customerId = req.params.id;
            const userId = req.userId;
    
            if (!userId) {
                return res.status(200).json({ 
                    success: false,
                    message: 'User ID is required for customer deletion'
                });
            }

            const result = await Customer.delete(customerId, userId);
            return res.status(200).json(result);
            
        } catch (error) {
            return res.status(200).json({ 
                success: false,
                message: 'An error occurred while deleting the customer'
            });
        }
    }

    static async getCustomerPurchases(req, res) {
        try {
            const userId = req.userId;
            const customerId = req.params.id;

            if (!userId) {
                return res.status(400).json({ message: 'User ID is required' });
            }

            const sales = await db.executeQuery(
                `SELECT s.*, 
                    GROUP_CONCAT(
                        JSON_OBJECT(
                            'product_id', si.product_id,
                            'name', st.product_name,
                            'quantity', si.quantity,
                            'unit', st.quantity_unit,
                            'price', si.unit_price
                        )
                    ) as products
                FROM sales s
                LEFT JOIN sale_items si ON s.sale_id = si.sale_id
                LEFT JOIN stock st ON si.product_id = st.id
                WHERE s.customer_id = ? AND s.user_id = ?
                GROUP BY s.sale_id
                ORDER BY s.sale_date DESC`,
                [customerId, userId]
            );

            const formattedSales = sales.map(sale => ({
                id: sale.sale_id,
                date: sale.sale_date,
                type: sale.payment_type || 'cash',
                status: sale.credit_status || 'completed',
                total: parseFloat(sale.final_amount),
                products: JSON.parse(`[${sale.products}]`),
                creditDetails: sale.credit_amount ? {
                    creditAmount: parseFloat(sale.credit_amount),
                    paidAmount: parseFloat(sale.paid_amount),
                    remainingAmount: parseFloat(sale.remaining_amount),
                    status: sale.credit_status
                } : null
            }));

            res.json(formattedSales);
        } catch (error) {
            console.error('Error fetching customer sales:', error);
            res.status(500).json({ message: 'Error fetching sales history' });
        }
    }
}

module.exports = CustomerController;