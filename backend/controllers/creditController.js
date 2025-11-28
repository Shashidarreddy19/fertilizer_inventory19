const CreditModel = require('../models/creditModel');
const db = require('../config/db');
const Stock = require('../models/stockModel');

class CreditController {
    static async createCredit(req, res) {
        try {
            const { customerId, products, userId, interest_rate, notes, partial_payment, creditDate } = req.body;

            // Validate required fields
            if (!customerId || !products || !Array.isArray(products) || !userId || interest_rate === undefined) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Validate products
            if (products.length === 0) {
                return res.status(400).json({ error: 'At least one product is required' });
            }

            // Calculate total credit amount and total items from products
            let totalCreditAmount = 0;
            let totalItems = 0;
            for (const product of products) {
                if (!product.productId || !product.number_of_items || !product.price_per_unit) {
                    return res.status(400).json({ error: 'Invalid product data. Required fields: productId, number_of_items, price_per_unit' });
                }
                totalCreditAmount += product.number_of_items * product.price_per_unit;
                totalItems += parseInt(product.number_of_items);
            }

            const creditData = {
                customer_id: customerId,
                user_id: userId,
                credit_amount: totalCreditAmount,
                interest_rate: parseFloat(interest_rate),
                notes: notes || '',
                partial_payment: parseFloat(partial_payment || 0),
                credit_date: creditDate || new Date().toISOString().split('T')[0],
                total_items: totalItems,
                products: products.map(p => ({
                    product_id: p.productId,
                    number_of_items: parseInt(p.number_of_items),
                    quantity_unit: p.quantity_unit || 'units',
                    price_per_unit: parseFloat(p.price_per_unit)
                }))
            };

            const creditId = await CreditModel.createCreditSale(creditData);
            const credit = await CreditModel.getCreditById(creditId, userId);
            
            res.status(201).json({ 
                message: 'Credit sale created successfully', 
                creditId,
                credit_amount: totalCreditAmount,
                total_items: totalItems,
                paid_amount: parseFloat(partial_payment || 0),
                remaining_amount: totalCreditAmount - parseFloat(partial_payment || 0),
                total_interest_amount: 0,
                credit_date: creditData.credit_date
            });

        } catch (error) {
            console.error('Error creating credit:', error);
            res.status(500).json({ 
                error: 'Failed to create credit sale',
                details: error.message 
            });
        }
    }

    static async createCreditSale(req, res) {
        try {
            const {
                customer_id,
                user_id,
                credit_amount,
                interest_rate,
                due_date,
                partial_payment,
                products
            } = req.body;

            if (!customer_id || !credit_amount || !interest_rate || !due_date || !Array.isArray(products)) {
                return res.status(400).json({ message: 'Missing required fields' });
            }

            // Validate products have required fields
            for (const product of products) {
                if (
                  !product.product_id ||
                  !product.number_of_items ||
                  !product.price_per_unit
                ) {
                  return res.status(400).json({
                    message: "Each product must have product_id, number_of_items, and price_per_unit",
                  });
                }
              }              

            const credit_id = await CreditModel.createCreditSale({
                customer_id,
                user_id,
                credit_amount,
                interest_rate,
                due_date,
                partial_payment
            });

            if (products.length > 0) {
                await CreditModel.addCreditProducts(credit_id, products);
            }

            res.status(201).json({ message: 'Credit sale created', credit_id });
        } catch (error) {
            console.error('Error creating credit sale:', error);
            res.status(500).json({ error: 'Failed to create credit sale' });
        }
    }

    static async getCreditById(req, res) {
        try {
            const creditId = req.params.id;
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const credit = await CreditModel.getCreditById(creditId, userId);
            if (!credit) {
                return res.status(404).json({ error: 'Credit not found' });
            }

            // Format products with names
            const products = await Promise.all(credit.products.map(async (p) => {
                const [product] = await db.executeQuery(
                    'SELECT product_name FROM stock WHERE id = ?',
                    [p.product_id]
                );
                return {
                    ...p,
                    product_name: product ? product.product_name : 'Unknown Product'
                };
            }));

            res.json({
                ...credit,
                products
            });
        } catch (error) {
            console.error('Error fetching credit:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async makePayment(req, res) {
        try {
            const creditId = req.params.id;
            const { userId, payment_amount, payment_date, payment_notes } = req.body;

            if (!userId || !payment_amount || !payment_date) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const result = await CreditModel.addPartialPayment({
                credit_id: creditId,
                user_id: userId,
                payment_amount: parseFloat(payment_amount),
                payment_date: new Date(payment_date),
                payment_notes: payment_notes || ''
            });

            // Get updated credit details
            const credit = await CreditModel.getCreditById(creditId, userId);

            res.json({
                message: 'Payment processed successfully',
                credit_id: creditId,
                paid_amount: parseFloat(credit.paid_amount || 0),
                remaining_amount: parseFloat(credit.remaining_amount || 0),
                total_interest_amount: parseFloat(credit.total_interest_amount || 0),
                credit_date: credit.credit_date,
                payment: {
                    amount: parseFloat(payment_amount),
                    date: payment_date,
                    notes: payment_notes || ''
                }
            });
        } catch (error) {
            console.error('Error processing payment:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async getAllCredits(req, res) {
        try {
            const { userId, showArchived } = req.query;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const credits = await CreditModel.getCredits(userId, showArchived === 'true');
            
            // Ensure credits is an array
            const creditsArray = Array.isArray(credits) ? credits : [];
            
            const formattedCredits = creditsArray.map(credit => ({
                credit_id: credit.credit_id,
                customer_id: credit.customer_id,
                customer_name: credit.customer_name,
                credit_amount: parseFloat(credit.credit_amount || 0),
                paid_amount: parseFloat(credit.paid_amount || 0),
                remaining_amount: parseFloat(credit.remaining_amount || credit.credit_amount || 0),
                interest_rate: parseFloat(credit.interest_rate || 0),
                due_date: credit.due_date,
                status: credit.status || 'Pending',
                products: credit.products || '[]',
                created_at: credit.created_at,
                credit_date: credit.credit_date,
                last_interest_calculation: credit.last_interest_calculation,
                total_interest_amount: parseFloat(credit.total_interest_amount || 0),
                overdue_days: credit.overdue_days || 0,
                notes: credit.notes || ''
            }));

            res.status(200).json(formattedCredits);
        } catch (error) {
            console.error('Error fetching credit data:', error);
            res.status(500).json({ error: 'Failed to fetch credit transactions' });
        }
    }

    static async getInterestHistory(req, res) {
        try {
            const creditId = req.params.id;
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
            }

            // First check if credit exists and belongs to user
            const credit = await CreditModel.getCreditById(creditId, userId);
            if (!credit) {
                return res.status(404).json({
                    success: false,
                    message: 'Credit not found or unauthorized'
                });
            }

            // Get interest history
            const result = await CreditModel.getInterestHistory(creditId);

            // Format the response
            const formattedHistory = result.history.map(entry => ({
                calculation_id: entry.calculation_id,
                calculation_date: entry.calculation_date,
                principal_amount: parseFloat(entry.principal_amount || 0),
                payment_amount: parseFloat(entry.payment_amount || 0),
                remaining_balance: parseFloat(entry.remaining_balance || 0),
                duration_days: parseInt(entry.duration_days || 0),
                interest_rate: parseFloat(entry.interest_rate || 0),
                interest_amount: parseFloat(entry.interest_amount || 0)
            }));

            res.json({
                success: true,
                history: formattedHistory,
                total_interest: result.total_interest,
                credit_details: {
                    customer_name: credit.customer_name,
                    credit_amount: credit.credit_amount,
                    remaining_amount: credit.remaining_amount
                }
            });
        } catch (error) {
            console.error('Error in getInterestHistory:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch interest history',
                error: error.message
            });
        }
    }

    static async getAllInterestCalculations(req, res) {
        try {
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const calculations = await CreditModel.getAllInterestCalculations();
            
            res.status(200).json(calculations.map(calc => ({
                credit_id: calc.credit_id,
                month: calc.month_year,
                principal_amount: calc.principal_amount,
                remaining_balance: calc.remaining_balance,
                interest_rate: calc.interest_rate,
                interest_amount: calc.interest_amount
            })));
        } catch (error) {
            console.error('Error fetching all interest calculations:', error);
            res.status(500).json({ error: 'Failed to fetch interest calculations' });
        }
    }

    static async getPayments(req, res) {
        try {
            const credit_id = req.params.id;
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const credit = await CreditModel.getCreditById(credit_id, userId);
            if (!credit) {
                return res.status(404).json({ 
                    error: `Credit record not found for ID: ${credit_id}` 
                });
            }

            const payments = await CreditModel.getPayments(credit_id, userId) || [];
            const formattedPayments = (Array.isArray(payments) ? payments : []).map(payment => ({
                payment_id: payment.payment_id,
                payment_date: payment.payment_date,
                payment_amount: parseFloat(payment.payment_amount || 0),
                payment_notes: payment.payment_notes || '',
                user_id: payment.user_id
            }));

            res.status(200).json(formattedPayments);
        } catch (error) {
            console.error('Error fetching payments:', error);
            res.status(500).json({ error: 'Failed to fetch payment history' });
        }
    }

    static async getCustomerScore(req, res) {
        try {
            const customer_id = req.params.customer_id;
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const score = await CreditModel.getCustomerCreditScore(customer_id, userId);
            res.status(200).json({ credit_score: score });
        } catch (error) {
            console.error('Error fetching credit score:', error);
            res.status(500).json({ error: 'Failed to get customer credit score' });
        }
    }

    static async deleteCredit(req, res) {
        try {
            const creditId = req.params.id;
            const { userId } = req.query;

            // Validate required parameters
            if (!creditId || !userId) {
                return res.status(400).json({ 
                    error: 'Credit ID and user ID are required' 
                });
            }

            // Check if credit exists and belongs to user
            const credit = await CreditModel.getCreditById(creditId, userId);
            if (!credit) {
                return res.status(404).json({ 
                    error: 'Credit not found or unauthorized' 
                });
            }

            // Delete the credit
            await CreditModel.deleteCredit(creditId, userId);

            res.status(200).json({ 
                message: 'Credit deleted successfully',
                creditId: creditId
            });

        } catch (error) {
            console.error('Error deleting credit:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to delete credit' 
            });
        }
    }

    static async archiveCredit(req, res) {
        try {
            const credit_id = req.params.id;
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            await CreditModel.archiveCredit(credit_id, userId);
            res.status(200).json({ message: 'Credit archived successfully' });
        } catch (error) {
            console.error('Error archiving credit:', error);
            res.status(500).json({ error: 'Failed to archive credit' });
        }
    }

    static async unarchiveCredit(req, res) {
        try {
            const credit_id = req.params.id;
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            await CreditModel.unarchiveCredit(credit_id, userId);
            res.status(200).json({ message: 'Credit unarchived successfully' });
        } catch (error) {
            console.error('Error unarchiving credit:', error);
            res.status(500).json({ error: 'Failed to unarchive credit' });
        }
    }

    static async updateCredit(req, res) {
        try {
            const creditId = req.params.id;
            const userId = req.query.userId;
            const updateData = req.body;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            if (!creditId) {
                return res.status(400).json({ error: 'Credit ID is required' });
            }

            // Check if credit exists and belongs to user
            const credit = await CreditModel.getCreditById(creditId, userId);
            if (!credit) {
                return res.status(404).json({ error: 'Credit not found or unauthorized' });
            }

            // Validate products if provided
            if (updateData.products) {
                if (!Array.isArray(updateData.products)) {
                    return res.status(400).json({ error: 'Products must be an array' });
                }

                for (const product of updateData.products) {
                    if (!product.product_id || !product.number_of_items || !product.price_per_unit) {
                        return res.status(400).json({ 
                            error: 'Each product must have product_id, number_of_items, and price_per_unit' 
                        });
                    }
                }
            }

            // Calculate new credit amount from products
            if (updateData.products && updateData.products.length > 0) {
                updateData.credit_amount = updateData.products.reduce((sum, product) => 
                    sum + (product.number_of_items * product.price_per_unit), 0
                );
            }

            const result = await CreditModel.updateCredit(creditId, userId, updateData);
            
            res.status(200).json({
                message: 'Credit updated successfully',
                credit: result
            });

        } catch (error) {
            console.error('Error updating credit:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to update credit'
            });
        }
    }

    static async getCredits(req, res) {
        try {
            const { userId } = req.query;
            const customerId = req.params.customerId;
            
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            // Get credits with customer and product details
            const credits = await CreditModel.getCredits(userId, false, customerId);

            // Calculate overdue days and format response
            const formattedCredits = credits.map(credit => {
                const dueDate = new Date(credit.due_date);
                const today = new Date();
                const overdueDays = today > dueDate ? Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)) : 0;

                return {
                    ...credit,
                    overdue_days: overdueDays,
                    products: credit.products ? JSON.parse(credit.products) : []
                };
            });

            res.json(formattedCredits);
        } catch (error) {
            console.error('Error in getCredits:', error);
            res.status(500).json({ error: 'Failed to fetch credits' });
        }
    }

    static async calculateInterest(req, res) {
        try {
            const creditId = req.params.id;
            const { userId, days } = req.body;

            if (!userId || !days) {
                return res.status(400).json({
                    error: 'User ID and days are required'
                });
            }

            // Call the updated model function
            const result = await CreditModel.calculateInterest(creditId, days, userId);

            res.status(200).json({
                success: true,
                message: result.message,
                interest_amount: result.interest_amount,
                updated_balance: result.new_remaining_amount
            });
        } catch (error) {
            console.error('Error calculating interest:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to calculate interest',
                error: error.message
            });
        }
    }

    static async generateInterest(req, res) {
        try {
            const credit_id = req.params.id;
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            // Check if credit exists and belongs to user
            const credit = await CreditModel.getCreditById(credit_id, userId);
            if (!credit) {
                return res.status(404).json({ error: 'Credit not found' });
            }

            if (credit.isArchived) {
                return res.status(400).json({ error: 'Cannot generate interest for archived credit' });
            }

            const result = await CreditModel.generateMonthlyInterest(credit_id);
            res.status(200).json({
                message: 'Interest generated successfully',
                ...result
            });
        } catch (error) {
            console.error('Error generating interest:', error);
            res.status(500).json({ error: 'Failed to generate interest' });
        }
    }

    static async getAllInterestCalculations() {
        try {
            const sql = `
                SELECT 
                    calculation_id,
                    credit_id,
                    DATE_FORMAT(calculation_date, '%M') AS month_name,
                    DATE_FORMAT(calculation_date, '%Y') AS year,
                    principal_amount,
                    COALESCE(remaining_balance, principal_amount) as remaining_balance,
                    interest_rate,
                    interest_amount,
                    CONCAT(DATE_FORMAT(calculation_date, '%M'), ' ', DATE_FORMAT(calculation_date, '%Y')) as month_year
                FROM credit_interest_calculations
                ORDER BY calculation_date DESC
            `;
            
            const results = await db.executeQuery(sql);
            
            // Format the results
            return results.map(item => ({
                calculation_id: item.calculation_id,
                credit_id: item.credit_id,
                month: item.month_year,
                principal_amount: parseFloat(item.principal_amount).toFixed(2),
                remaining_balance: parseFloat(item.remaining_balance).toFixed(2),
                interest_rate: parseFloat(item.interest_rate).toFixed(2),
                interest_amount: parseFloat(item.interest_amount).toFixed(2)
            }));
        } catch (error) {
            console.error('Error getting all interest calculations:', error);
            throw error;
        }
    }

    static async deleteInterestCalculation(req, res) {
        try {
            const { id: creditId, calculationId } = req.params;
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            // First check if the credit exists and belongs to the user
            const credit = await CreditModel.getCreditById(creditId, userId);
            if (!credit) {
                return res.status(404).json({ error: 'Credit not found or unauthorized' });
            }

            // Delete the interest calculation
            const deleted = await CreditModel.deleteInterestCalculation(calculationId, creditId, userId);
            if (!deleted) {
                return res.status(404).json({ error: 'Interest calculation not found or unauthorized' });
            }

            // Get updated interest history
            const interestHistory = await CreditModel.getInterestHistory(creditId);
            
            res.json({
                message: 'Interest calculation deleted successfully',
                history: interestHistory
            });
        } catch (error) {
            console.error('Error deleting interest calculation:', error);
            res.status(500).json({ error: 'Failed to delete interest calculation' });
        }
    }

    // Utility function to calculate monthly interest
    static calculateMonthlyInterest(remainingBalance, interestRate) {
        const interest = (remainingBalance * (interestRate / 100));
        return Math.round(interest * 100) / 100; // Round to 2 decimal places
    }
}

module.exports = CreditController;