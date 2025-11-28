const db = require('../config/db');

class CreditModel {
    static async initializeTables() {
        try {
            // First, check if the table exists
            const checkTable = await db.executeQuery(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'credit_interest_calculations'
            `);

            if (checkTable[0].count === 0) {
                // Create table if it doesn't exist
                await db.executeQuery(`
                    CREATE TABLE credit_interest_calculations (
                        calculation_id INT PRIMARY KEY AUTO_INCREMENT,
                        credit_id INT NOT NULL,
                        calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        principal_amount DECIMAL(10,2) NOT NULL,
                        interest_rate DECIMAL(5,2) NOT NULL,
                        interest_amount DECIMAL(10,2) NOT NULL,
                        month_name VARCHAR(20) NOT NULL,
                        year INT NOT NULL,
                        remaining_balance DECIMAL(10,2) DEFAULT 0.00,
                        duration_days INT DEFAULT NULL,
                        FOREIGN KEY (credit_id) REFERENCES credit_sales(credit_id) ON DELETE CASCADE,
                        INDEX idx_credit_date (credit_id, calculation_date)
                    )
                `);
                console.log('Credit interest calculations table created successfully');
            } else {
                // Check if we need to add any missing columns
                const columns = await db.executeQuery(`
                    SHOW COLUMNS FROM credit_interest_calculations
                `);
                
                const columnNames = columns.map(col => col.Field);
                
                if (!columnNames.includes('duration_days')) {
                    await db.executeQuery(`
                        ALTER TABLE credit_interest_calculations 
                        ADD COLUMN duration_days INT DEFAULT NULL
                    `);
                    console.log('Added duration_days column to credit_interest_calculations');
                }
                
                if (!columnNames.includes('remaining_balance')) {
                    await db.executeQuery(`
                        ALTER TABLE credit_interest_calculations 
                        ADD COLUMN remaining_balance DECIMAL(10,2) DEFAULT 0.00
                    `);
                    console.log('Added remaining_balance column to credit_interest_calculations');
                }
            }
            
            console.log('Credit interest calculations table initialized');
        } catch (error) {
            console.error('Error initializing tables:', error);
            throw error;
        }
    }

    static async createCreditSale(creditData) {
        const connection = await db.pool.getConnection();
        try {
            await connection.beginTransaction();

            const { customer_id, user_id, credit_amount, interest_rate, notes, products, credit_date, partial_payment } = creditData;

            // Insert credit sale
            const [result] = await connection.execute(`
                INSERT INTO credit_sales (
                    customer_id, user_id, credit_amount, interest_rate, 
                    credit_date, notes, status, remaining_amount, paid_amount
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                customer_id, 
                user_id, 
                credit_amount, 
                interest_rate, 
                credit_date || new Date().toISOString().split('T')[0], 
                notes || '', 
                partial_payment > 0 ? 'Partially Paid' : 'Pending',
                credit_amount - (partial_payment || 0),
                partial_payment || 0
            ]);

            const creditId = result.insertId;

            // Insert credit products and update stock quantities
            if (products && products.length > 0) {
                for (const product of products) {
                    // Insert into credit_products
                    await connection.execute(`
                        INSERT INTO credit_products (
                            credit_id, product_id, number_of_items, 
                            quantity_unit, price_per_unit
                        ) VALUES (?, ?, ?, ?, ?)
                    `, [
                        creditId,
                        product.product_id || product.productId,
                        parseInt(product.number_of_items),
                        product.quantity_unit || 'units',
                        parseFloat(product.price_per_unit)
                    ]);

                    // Update stock quantity
                    const [stockResult] = await connection.execute(`
                        SELECT number_of_items, package_size, quantity 
                        FROM stock 
                        WHERE id = ? AND user_id = ?
                    `, [product.product_id || product.productId, user_id]);

                    if (!stockResult || stockResult.length === 0) {
                        throw new Error(`Product with ID ${product.product_id || product.productId} not found in stock`);
                    }

                    const currentStock = stockResult[0];
                    const newNumberOfItems = currentStock.number_of_items - parseInt(product.number_of_items);
                    const newQuantity = newNumberOfItems * (currentStock.package_size || 1);

                    if (newNumberOfItems < 0) {
                        throw new Error(`Insufficient stock for product ID ${product.product_id || product.productId}`);
                    }

                    await connection.execute(`
                        UPDATE stock 
                        SET number_of_items = ?,
                            quantity = ?
                        WHERE id = ? AND user_id = ?
                    `, [newNumberOfItems, newQuantity, product.product_id || product.productId, user_id]);
                }
            }

            // Handle partial payment if provided
            if (partial_payment && partial_payment > 0) {
                await connection.execute(`
                    INSERT INTO credit_payments (
                        credit_id, user_id, payment_amount, payment_date, payment_notes
                    ) VALUES (?, ?, ?, CURRENT_DATE, ?)
                `, [
                    creditId,
                    user_id,
                    partial_payment,
                    'Initial payment on credit creation'
                ]);
            }

            await connection.commit();
            return creditId;

        } catch (error) {
            await connection.rollback();
            console.error('Error creating credit sale:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async insertCreditProducts(creditId, products, conn) {
        try {
            for (const product of products) {
                // Ensure all values are properly formatted and not undefined
                const safeProductId = product.productId || product.product_id;
                const safeNumberOfItems = parseInt(product.number_of_items) || 0;
                const safePricePerUnit = parseFloat(product.price_per_unit) || 0;
                const safeQuantityUnit = product.quantity_unit || 'units';

                if (!safeProductId || safeNumberOfItems <= 0 || safePricePerUnit <= 0) {
                    throw new Error('Invalid product data');
                }

                await conn.execute(`
                    INSERT INTO credit_products (
                        credit_id,
                        product_id,
                        number_of_items,
                        quantity_unit,
                        price_per_unit
                    ) VALUES (?, ?, ?, ?, ?)
                `, [
                    creditId,
                    safeProductId,
                    safeNumberOfItems,
                    safeQuantityUnit,
                    safePricePerUnit
                ]);
            }
        } catch (error) {
            console.error('Error in insertCreditProducts:', error);
            throw error;
        }
    }

    static async addCreditProducts(credit_id, products) {
        const values = products.map(p => [
            credit_id,
            p.product_id,
            p.quantity_unit,
            p.price_per_unit,
            p.number_of_items
        ]);

        const sql = `
            INSERT INTO credit_products (
                credit_id, 
                product_id, 
                quantity_unit, 
                price_per_unit,
                number_of_items
            ) VALUES ?
        `;

        return await db.executeQuery(sql, [values]);
    }

    static async addPartialPayment({ credit_id, user_id, payment_amount, payment_date, payment_notes }) {
        try {
            return await db.executeTransaction(async (conn) => {
                // Get current credit details
                const [credit] = await conn.execute(`
                    SELECT credit_amount, remaining_amount, credit_date 
                    FROM credit_sales 
                    WHERE credit_id = ? AND user_id = ?
                `, [credit_id, user_id]);

                if (!credit || credit.length === 0) {
                    throw new Error('Credit not found or unauthorized');
                }

                const currentCredit = credit[0];
                const newRemainingAmount = currentCredit.remaining_amount - payment_amount;

                // Insert payment record
                await conn.execute(`
                    INSERT INTO credit_payments (
                        credit_id, user_id, payment_amount, 
                        payment_date, payment_notes
                    ) VALUES (?, ?, ?, ?, ?)
                `, [credit_id, user_id, payment_amount, payment_date, payment_notes]);

                // Update credit remaining amount and status
                await conn.execute(`
                    UPDATE credit_sales 
                    SET remaining_amount = ?,
                        status = CASE
                            WHEN ? <= 0 THEN 'Paid'
                            WHEN ? < credit_amount THEN 'Partially Paid'
                            ELSE 'Pending'
                        END
                    WHERE credit_id = ? AND user_id = ?
                `, [newRemainingAmount, newRemainingAmount, newRemainingAmount, credit_id, user_id]);

                return {
                    message: 'Payment processed successfully',
                    remaining_amount: newRemainingAmount
                };
            });
        } catch (error) {
            console.error('Error processing payment:', error);
            throw error;
        }
    }

    static calculateSimpleInterest(principal, rate, durationDays) {
        const years = durationDays / 365;
        const interest = (principal * rate * years) / 100;
        return parseFloat(interest.toFixed(2));
    }

    static async getCredits(userId, showArchived = false) {
        try {
            const query = `
                SELECT 
                    cs.*,
                    c.customer_name,
                    cs.notes,
                    DATEDIFF(CURRENT_DATE, cs.credit_date) as duration_days,
                    (
                        SELECT COALESCE(SUM(cp2.number_of_items), 0)
                        FROM credit_products cp2 
                        WHERE cp2.credit_id = cs.credit_id
                    ) as total_items,
                    CONCAT(
                        '[',
                        COALESCE(
                            GROUP_CONCAT(
                                JSON_OBJECT(
                                    'product_id', cp.product_id,
                                    'product_name', s.product_name,
                                    'number_of_items', cp.number_of_items,
                                    'quantity_unit', cp.quantity_unit,
                                    'price_per_unit', cp.price_per_unit,
                                    'total_price', (cp.number_of_items * cp.price_per_unit)
                                )
                            ),
                            '[]'
                        ),
                        ']'
                    ) AS products,
                    COALESCE(
                        (SELECT SUM(payment_amount) 
                         FROM credit_payments 
                         WHERE credit_id = cs.credit_id
                        ), 0
                    ) as total_paid_amount
                FROM credit_sales cs
                LEFT JOIN customers c ON cs.customer_id = c.customer_id
                LEFT JOIN credit_products cp ON cs.credit_id = cp.credit_id
                LEFT JOIN stock s ON cp.product_id = s.id
                WHERE cs.user_id = ?
                ${showArchived ? '' : "AND cs.status != 'Archived'"}
                GROUP BY cs.credit_id, cs.notes
                ORDER BY cs.created_at DESC
            `;

            const credits = await db.executeQuery(query, [userId]);
            
            return credits.map(credit => {
                const creditAmount = parseFloat(credit.credit_amount || 0);
                const interestRate = parseFloat(credit.interest_rate || 0);
                const durationDays = parseInt(credit.duration_days || 0);
                const totalPaid = parseFloat(credit.total_paid_amount || 0);
                const totalInterest = parseFloat(credit.total_interest_amount || 0);
                const products = JSON.parse(credit.products || '[]');
                const totalItems = parseInt(credit.total_items || 0);

                return {
                    credit_id: credit.credit_id,
                    customer_id: credit.customer_id,
                    customer_name: credit.customer_name,
                    credit_amount: creditAmount,
                    paid_amount: totalPaid,
                    remaining_amount: parseFloat(credit.remaining_amount || creditAmount),
                    interest_rate: interestRate,
                    credit_date: credit.credit_date,
                    due_date: credit.due_date,
                    status: credit.status || 'Pending',
                    notes: credit.notes || '',
                    products: products,
                    total_items: totalItems,
                    created_at: credit.created_at,
                    last_interest_calculation: credit.last_interest_calculation,
                    total_interest_amount: totalInterest,
                    duration_days: durationDays
                };
            });
        } catch (error) {
            console.error('Error in getCredits:', error);
            throw error;
        }
    }

    static async getInterestHistory(creditId) {
        try {
            const sql = `
                SELECT 
                    cic.calculation_id,
                    cic.calculation_date,
                    cic.principal_amount,
                    cic.remaining_balance,
                    cic.interest_rate,
                    cic.interest_amount,
                    cic.duration_days,
                    cic.month_name,
                    cic.year,
                    COALESCE(
                        (SELECT SUM(cp.payment_amount)
                         FROM credit_payments cp
                         WHERE cp.credit_id = cic.credit_id
                         AND cp.payment_date <= cic.calculation_date
                        ), 0
                    ) as payment_amount
                FROM credit_interest_calculations cic
                WHERE cic.credit_id = ?
                ORDER BY cic.calculation_date DESC
            `;

            const history = await db.executeQuery(sql, [creditId]);

            // Calculate total interest
            const totalInterest = history.reduce((sum, record) => 
                sum + parseFloat(record.interest_amount || 0), 0
            );

            return {
                history: history || [],
                total_interest: totalInterest
            };
        } catch (error) {
            console.error('Error fetching interest history:', error);
            throw error;
        }
    }

    static async getAllInterestCalculations() {
        try {
    const sql = `
                SELECT 
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
                ...item,
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

    static async getPayments(credit_id, userId) {
    const sql = `
        SELECT * FROM credit_payments
            WHERE credit_id = ? AND user_id = ?
        ORDER BY payment_date DESC
    `;
        return await db.executeQuery(sql, [credit_id, userId]);
}

    static async getCustomerCreditScore(customer_id, userId) {
    const sql = `
            SELECT credit_score 
            FROM customers 
            WHERE customer_id = ? AND user_id = ?
    `;
        const result = await db.executeQuery(sql, [customer_id, userId]);
    return result[0]?.credit_score || 100;
}

    static async deleteCredit(creditId, userId) {
        const connection = await db.pool.getConnection();
        try {
            await connection.beginTransaction();

            // First check if the credit exists and belongs to the user
            const [credit] = await connection.execute(
                'SELECT * FROM credit_sales WHERE credit_id = ? AND user_id = ?',
                [creditId, userId]
            );

            if (!credit.length) {
                throw new Error('Credit not found or unauthorized');
            }

            // Get the products from the credit before deleting
            const [products] = await connection.execute(
                'SELECT product_id, number_of_items FROM credit_products WHERE credit_id = ?',
                [creditId]
            );

            // Delete related records in order
            await connection.execute('DELETE FROM credit_interest_calculations WHERE credit_id = ?', [creditId]);
            await connection.execute('DELETE FROM credit_payments WHERE credit_id = ?', [creditId]);
            await connection.execute('DELETE FROM credit_products WHERE credit_id = ?', [creditId]);
            
            // Finally delete the credit sale
            const [result] = await connection.execute(
                'DELETE FROM credit_sales WHERE credit_id = ? AND user_id = ?',
                [creditId, userId]
            );

            if (result.affectedRows === 0) {
                throw new Error('Failed to delete credit');
            }

            await connection.commit();
            return true;

        } catch (error) {
            await connection.rollback();
            console.error('Error in deleteCredit:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async archiveCredit(credit_id, userId) {
        const sql = `
            UPDATE credit_sales 
            SET status = 'Pending'
            WHERE credit_id = ? AND user_id = ?
        `;
        
        const result = await db.executeQuery(sql, [credit_id, userId]);
        
        if (result.affectedRows === 0) {
            throw new Error('Credit not found or unauthorized');
        }
        
        return result;
    }

    static async unarchiveCredit(credit_id, userId) {
        const sql = `
            UPDATE credit_sales 
            SET status = CASE
                WHEN paid_amount >= credit_amount THEN 'Pending'
                WHEN paid_amount > 0 THEN 'Partially Paid'
                ELSE 'Pending'
            END
            WHERE credit_id = ? AND user_id = ?
        `;
        
        const result = await db.executeQuery(sql, [credit_id, userId]);
        
        if (result.affectedRows === 0) {
            throw new Error('Credit not found or unauthorized');
        }
        
        return result;
    }

    static async generateMonthlyInterest(credit_id) {
        try {
            await this.initializeTables();

            return await db.executeTransaction(async (conn) => {
                // Get the latest credit details
                const [credit] = await conn.execute(`
                    SELECT 
                        cs.*,
                        COALESCE(SUM(cp.payment_amount), 0) as total_paid,
                        COALESCE((
                            SELECT remaining_balance 
                            FROM credit_interest_calculations 
                            WHERE credit_id = cs.credit_id 
                            ORDER BY calculation_date DESC 
                            LIMIT 1
                        ), cs.credit_amount) as last_remaining_balance,
                        COALESCE((
                            SELECT calculation_date 
                            FROM credit_interest_calculations 
                            WHERE credit_id = cs.credit_id 
                            ORDER BY calculation_date DESC 
                            LIMIT 1
                        ), cs.created_at) as last_calculation_date
                    FROM credit_sales cs
                    LEFT JOIN credit_payments cp ON cs.credit_id = cp.credit_id
                    WHERE cs.credit_id = ?
                    GROUP BY cs.credit_id
                `, [credit_id]);

                if (!credit || credit.length === 0) {
                    throw new Error('Credit not found');
                }

                const creditData = credit[0];
                const currentDate = new Date();
                const lastCalculationDate = new Date(creditData.last_calculation_date);
                
                // Check if a month has passed since last calculation
                const monthsDiff = (currentDate.getFullYear() - lastCalculationDate.getFullYear()) * 12 + 
                                 (currentDate.getMonth() - lastCalculationDate.getMonth());
                
                if (monthsDiff < 1) {
                    return { message: 'No new interest calculation needed' };
                }

                // Calculate new interest using the auto-generated remaining_amount
                const interest = (creditData.remaining_amount * (creditData.interest_rate / 100));
                const month = currentDate.toLocaleString('default', { month: 'long' });
                const year = currentDate.getFullYear();

                // Insert new interest calculation
                await conn.execute(`
                    INSERT INTO credit_interest_calculations (
                        credit_id, 
                        calculation_date,
                        month_name,
                        year,
                        principal_amount,
                        remaining_balance, 
                        interest_rate, 
                        interest_amount
                    ) VALUES (?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?)
                `, [
                    credit_id,
                    month,
                    year,
                    creditData.credit_amount,
                    creditData.remaining_amount,
                    creditData.interest_rate,
                    interest
                ]);

                // Update credit sale
                await conn.execute(`
                    UPDATE credit_sales
                    SET total_interest_amount = COALESCE(total_interest_amount, 0) + ?,
                        last_interest_calculation = CURRENT_DATE(),
                        status = CASE
                            WHEN (credit_amount - paid_amount) <= 0 THEN 'Paid'
                            WHEN paid_amount > 0 THEN 'Partially Paid'
                            ELSE 'Pending'
                        END
                    WHERE credit_id = ?
                `, [interest, credit_id]);

                return {
                    message: 'Interest calculated successfully',
                    interest_amount: interest,
                    remaining_balance: creditData.remaining_amount
                };
            });
        } catch (error) {
            console.error('Error generating monthly interest:', error);
            throw error;
        }
    }

    static async getCreditById(creditId, userId) {
        try {
            const sql = `
                SELECT cs.*, 
                       c.customer_name,
                       (
                           SELECT SUM(cp2.number_of_items) 
                           FROM credit_products cp2 
                           WHERE cp2.credit_id = cs.credit_id
                       ) as total_items,
                       GROUP_CONCAT(
                           JSON_OBJECT(
                               'product_id', cp.product_id,
                               'product_name', s.product_name,
                               'number_of_items', cp.number_of_items,
                               'quantity_unit', cp.quantity_unit,
                               'price_per_unit', cp.price_per_unit
                           )
                       ) as products,
                       COALESCE(
                           (SELECT SUM(payment_amount) 
                            FROM credit_payments 
                            WHERE credit_id = cs.credit_id
                           ), 0
                       ) as total_paid_amount
                FROM credit_sales cs
                LEFT JOIN customers c ON cs.customer_id = c.customer_id
                LEFT JOIN credit_products cp ON cs.credit_id = cp.credit_id
                LEFT JOIN stock s ON cp.product_id = s.id
                WHERE cs.credit_id = ? AND cs.user_id = ?
                GROUP BY cs.credit_id`;

            const results = await db.executeQuery(sql, [creditId, userId]);
            
            if (!results || results.length === 0) {
                return null;
            }

            const credit = results[0];
            return {
                credit_id: credit.credit_id,
                customer_id: credit.customer_id,
                customer_name: credit.customer_name,
                credit_amount: parseFloat(credit.credit_amount || 0),
                paid_amount: parseFloat(credit.total_paid_amount || 0),
                remaining_amount: parseFloat(credit.remaining_amount || credit.credit_amount || 0),
                interest_rate: parseFloat(credit.interest_rate || 0),
                credit_date: credit.credit_date,
                due_date: credit.due_date,
                status: credit.status || 'Pending',
                notes: credit.notes || '',
                products: JSON.parse(`[${credit.products || ''}]`),
                total_items: parseInt(credit.total_items || 0),
                created_at: credit.created_at,
                last_interest_calculation: credit.last_interest_calculation,
                total_interest_amount: parseFloat(credit.total_interest_amount || 0)
            };
        } catch (error) {
            console.error('Error in getCreditById:', error);
            throw error;
        }
    }

    static async updateCredit(credit_id, user_id, updateData) {
        try {
            return await db.executeTransaction(async (conn) => {
                const [credit] = await conn.execute(
                    'SELECT * FROM credit_sales WHERE credit_id = ? AND user_id = ?',
                    [credit_id, user_id]
                );
                if (!credit.length) {
                    throw new Error('Credit not found or unauthorized');
                }

                const { customer_id, interest_rate, duration_days, status, notes, products } = updateData;
                
                // Prepare fields and values for dynamic update
                const updateFields = [];
                const updateValues = [];

                if (customer_id !== undefined) { updateFields.push('customer_id = ?'); updateValues.push(customer_id); }
                if (interest_rate !== undefined) { updateFields.push('interest_rate = ?'); updateValues.push(parseFloat(interest_rate)); }
                if (duration_days !== undefined) { updateFields.push('duration_days = ?'); updateValues.push(parseInt(duration_days)); }
                if (status !== undefined) { updateFields.push('status = ?'); updateValues.push(status); }
                if (notes !== undefined) { updateFields.push('notes = ?'); updateValues.push(notes); }

                 // Recalculate credit_amount based on products if products are updated
                 let currentCreditAmount = credit[0].credit_amount;
                 if (Array.isArray(products) && products.length > 0) { 
                      currentCreditAmount = products.reduce((sum, p) => 
                          sum + (parseFloat(p.number_of_items || 0) * parseFloat(p.price_per_unit || 0)), 0);
                      updateFields.push('credit_amount = ?'); 
                      updateValues.push(currentCreditAmount);
                 }

                 // Recalculate remaining_amount (This might need adjustment based on how payments/interest affect it during edit)
                 // For simplicity, let's assume remaining = new_credit_amount - paid_amount + total_interest
                 // This needs careful review based on business logic.
                 const paidAmount = credit[0].paid_amount;
                 const totalInterest = credit[0].total_interest_amount;
                 const newRemainingAmount = currentCreditAmount - paidAmount + totalInterest;
                 updateFields.push('remaining_amount = ?');
                 updateValues.push(newRemainingAmount);

                 // Always update the timestamp
                 updateFields.push('updated_at = CURRENT_TIMESTAMP');

                if (updateFields.length > 0) {
                    const sql = `UPDATE credit_sales SET ${updateFields.join(', ')} WHERE credit_id = ? AND user_id = ?`;
                    await conn.execute(sql, [...updateValues, credit_id, user_id]);
                }

                // Update products if provided
                if (Array.isArray(products)) { // Allow empty array to remove all products
                    await conn.execute('DELETE FROM credit_products WHERE credit_id = ?', [credit_id]);
                    if (products.length > 0) {
                        const productValues = products.map(p => [
                            credit_id,
                            p.product_id,
                            p.quantity_unit || 'units',
                            parseFloat(p.price_per_unit || 0),
                            parseInt(p.number_of_items || 0)
                        ]);
                        await conn.query('INSERT INTO credit_products (credit_id, product_id, quantity_unit, price_per_unit, number_of_items) VALUES ?', [productValues]);
                    }
                }

                // Fetch and return the updated full credit details
                const updatedCredit = await this.getCreditById(credit_id, user_id); // Use getCreditById for consistency
                 if (!updatedCredit) { // Add check in case getCreditById fails or returns null
                    throw new Error('Failed to fetch updated credit details after update.');
                 }
                return updatedCredit;
            });
        } catch (error) {
            console.error('Error updating credit:', error);
            throw error;
        }
    }

    static async calculateInterest(creditId, days, userId) {
        return await db.executeTransaction(async (conn) => {
            // 1. Get credit record
            const [credit] = await conn.execute(`
                SELECT credit_amount, remaining_amount, interest_rate, total_interest_amount
                FROM credit_sales
                WHERE credit_id = ? AND user_id = ?
            `, [creditId, userId]);

            if (!credit || credit.length === 0) {
                throw new Error('Credit not found or unauthorized');
            }

            const creditData = credit[0];
            const balance = parseFloat(creditData.remaining_amount);
            const rate = parseFloat(creditData.interest_rate);
            const totalInterest = parseFloat(creditData.total_interest_amount || 0);

            // 2. Calculate interest using simple prorated formula
            const rawInterest = ((balance * rate) / 100) * (days / 30);
            const interest = Math.round(rawInterest * 100) / 100;

            // 3. Prepare date details
            const now = new Date();
            const date = now.toISOString().split("T")[0];
            const month = now.toLocaleString("default", { month: "long" });
            const year = now.getFullYear();

            // 4. Insert interest calculation record
            await conn.execute(`
                INSERT INTO credit_interest_calculations (
                    credit_id, calculation_date, principal_amount,
                    remaining_balance, interest_rate, interest_amount,
                    duration_days, month_name, year
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                creditId,
                date,
                creditData.credit_amount,
                balance,
                rate,
                interest,
                days,
                month,
                year
            ]);

            // 5. Update credit_sale totals
            const newInterestTotal = totalInterest + interest;
            const newRemaining = balance + interest;

            await conn.execute(`
                UPDATE credit_sales
                SET total_interest_amount = ?, 
                    remaining_amount = ?, 
                    last_interest_calculation = ?
                WHERE credit_id = ? AND user_id = ?
            `, [newInterestTotal, newRemaining, date, creditId, userId]);

            return {
                message: 'Interest stored successfully',
                interest_amount: interest,
                new_remaining_amount: newRemaining
            };
        });
    }

    static async calculateMonthlyInterest(credit_id) {
        try {
            // Get credit details with payments
            const [credit] = await db.executeQuery(`
                SELECT 
                    cs.*,
                    COALESCE(SUM(cp.payment_amount), 0) as total_paid
                FROM credit_sales cs
                LEFT JOIN credit_payments cp ON cs.credit_id = cp.credit_id
                WHERE cs.credit_id = ?
                GROUP BY cs.credit_id
            `, [credit_id]);

            if (!credit) {
                throw new Error('Credit not found');
            }

            // Get the last calculation date or use credit creation date
            const [lastCalculation] = await db.executeQuery(`
                SELECT calculation_date, outstanding_balance
                FROM credit_interest_calculations
                WHERE credit_id = ?
                ORDER BY calculation_date DESC
                LIMIT 1
            `, [credit_id]);

            const startDate = lastCalculation 
                ? new Date(lastCalculation.calculation_date) 
                : new Date(credit.credit_date);
            startDate.setMonth(startDate.getMonth() + 1); // Move to next month

            const currentDate = new Date();
            let outstandingBalance = lastCalculation 
                ? parseFloat(lastCalculation.outstanding_balance) 
                : parseFloat(credit.credit_amount);

            // If no calculation is needed yet
            if (startDate > currentDate) {
                return null;
            }

            // Calculate this month's interest
            const monthName = startDate.toLocaleString('default', { month: 'long' });
            const year = startDate.getFullYear();

            // Get payments made since last calculation
            const payments = await db.executeQuery(`
                SELECT COALESCE(SUM(payment_amount), 0) as paid_amount
                FROM credit_payments
                WHERE credit_id = ? 
                AND payment_date > ? 
                AND payment_date <= ?
            `, [credit_id, lastCalculation ? lastCalculation.calculation_date : credit.credit_date, startDate]);

            // Adjust outstanding balance with payments
            outstandingBalance -= parseFloat(payments[0].paid_amount || 0);

            // Calculate interest if there's outstanding balance
            if (outstandingBalance > 0) {
                const interestAmount = (outstandingBalance * (parseFloat(credit.interest_rate) / 100));
                
                // Insert the calculation
                await db.executeQuery(`
                    INSERT INTO credit_interest_calculations (
                        credit_id,
                        calculation_date,
                        month_name,
                        year,
                        principal_amount,
                        outstanding_balance,
                        interest_rate,
                        interest_amount,
                        is_generated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
                `, [
                    credit_id,
                    startDate,
                    monthName,
                    year,
                    credit.credit_amount,
                    outstandingBalance,
                    credit.interest_rate,
                    interestAmount
                ]);

                return {
                    month: `${monthName} ${year}`,
                    outstanding_balance: outstandingBalance.toFixed(2),
                    interest_amount: interestAmount.toFixed(2),
                    new_balance: (outstandingBalance + interestAmount).toFixed(2)
                };
            }

            return null;
        } catch (error) {
            console.error('Error calculating monthly interest:', error);
            throw error;
        }
    }

    static async processAllPendingInterest() {
        try {
            // Get all active credits
            const credits = await db.executeQuery(`
                SELECT credit_id 
                FROM credit_sales 
                WHERE status != 'Paid' 
                AND status != 'Archived'
            `);

            const results = [];
            for (const credit of credits) {
                try {
                    const result = await this.calculateMonthlyInterest(credit.credit_id);
                    if (result) {
                        results.push({
                            credit_id: credit.credit_id,
                            ...result
                        });
                    }
                } catch (err) {
                    console.error(`Error processing interest for credit ${credit.credit_id}:`, err);
                    results.push({
                        credit_id: credit.credit_id,
                        error: err.message
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error processing pending interest:', error);
            throw error;
        }
    }

    static async recordInterestCalculation(creditId, calculationData) {
        try {
            const sql = `
                INSERT INTO credit_interest_calculations (
                    credit_id,
                    calculation_date,
                    principal_amount,
                    remaining_balance,
                    interest_rate,
                    interest_amount,
                    month_name,
                    year
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const result = await db.executeQuery(sql, [
                creditId,
                calculationData.calculation_date,
                calculationData.principal_amount,
                calculationData.remaining_balance,
                calculationData.interest_rate,
                calculationData.interest_amount,
                calculationData.month_name,
                calculationData.year
            ]);

            return result.insertId;
        } catch (error) {
            console.error('Error recording interest calculation:', error);
            throw error;
        }
    }

    static async getInterestCalculationForMonth(creditId, month, year) {
        try {
            const sql = `
                SELECT * FROM credit_interest_calculations
                WHERE credit_id = ?
                AND month_name = ?
                AND year = ?
            `;
            
            const [result] = await db.executeQuery(sql, [creditId, month, year]);
            return result;
        } catch (error) {
            console.error('Error checking interest calculation:', error);
            throw error;
        }
    }

    static async deleteInterestCalculation(calculationId, creditId, userId) {
        try {
            return await db.executeTransaction(async (conn) => {
                // First verify the calculation exists and belongs to the user's credit
                const [verifyResult] = await conn.execute(`
                    SELECT ic.calculation_id, ic.interest_amount 
                    FROM credit_interest_calculations ic
                    JOIN credit_sales cs ON cs.credit_id = ic.credit_id
                    WHERE ic.calculation_id = ? 
                    AND ic.credit_id = ? 
                    AND cs.user_id = ?
                `, [calculationId, creditId, userId]);

                if (!verifyResult || verifyResult.length === 0) {
                    return false;
                }

                // Delete the calculation
                const [deleteResult] = await conn.execute(`
                    DELETE FROM credit_interest_calculations 
                    WHERE calculation_id = ? AND credit_id = ?
                `, [calculationId, creditId]);

                if (deleteResult.affectedRows === 0) {
                    return false;
                }

                // Update the credit's total interest
                await conn.execute(`
                    UPDATE credit_sales cs
                    SET total_interest_amount = (
                        SELECT COALESCE(SUM(interest_amount), 0)
                        FROM credit_interest_calculations
                        WHERE credit_id = ?
                    ),
                    remaining_amount = (
                        SELECT credit_amount - COALESCE(SUM(payment_amount), 0) + COALESCE(SUM(interest_amount), 0)
                        FROM credit_payments cp
                        LEFT JOIN credit_interest_calculations cic ON cic.credit_id = cp.credit_id
                        WHERE cp.credit_id = ?
                        GROUP BY cp.credit_id
                    )
                    WHERE credit_id = ? AND user_id = ?
                `, [creditId, creditId, creditId, userId]);

                return true;
            });
        } catch (error) {
            console.error('Error in deleteInterestCalculation:', error);
            throw error;
        }
    }

    static async updateCreditAfterInterest(creditId, updates) {
        try {
            const sql = `
                UPDATE credit_sales
                SET 
                    remaining_amount = ?,
                    total_interest_amount = ?,
                    last_interest_calculation = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE credit_id = ?
            `;
            
            await db.executeQuery(sql, [
                updates.remaining_amount,
                updates.total_interest_amount,
                creditId
            ]);
            
            return true;
        } catch (error) {
            console.error('Error updating credit after interest:', error);
            throw error;
        }
    }

    static async create({ customerId, userId, products, totalAmount }) {
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');

            // Insert credit record
            const creditQuery = `
                INSERT INTO credits (customer_id, user_id, total_amount, created_at)
                VALUES ($1, $2, $3, NOW())
                RETURNING id
            `;
            const creditResult = await client.query(creditQuery, [customerId, userId, totalAmount]);
            const creditId = creditResult.rows[0].id;

            // Insert credit products
            const productQuery = `
                INSERT INTO credit_products (
                    credit_id, product_id, number_of_items, 
                    quantity_unit, price_per_unit, total_price
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `;

            for (const product of products) {
                const total_price = product.number_of_items * product.price_per_unit;
                await client.query(productQuery, [
                    creditId,
                    product.productId,
                    product.number_of_items,
                    product.quantity_unit || 'units',
                    product.price_per_unit,
                    total_price
                ]);

                // Update stock quantity
                const updateStockQuery = `
                    UPDATE stock 
                    SET number_of_items = number_of_items - $1
                    WHERE id = $2 AND user_id = $3
                `;
                await client.query(updateStockQuery, [
                    product.number_of_items,
                    product.productId,
                    userId
                ]);
            }

            await client.query('COMMIT');

            return {
                id: creditId,
                customerId,
                userId,
                totalAmount,
                products
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async calculateInterestForDateRange(creditId, startDate, endDate, userId) {
        try {
            return await db.executeTransaction(async (conn) => {
                // Get credit details with payments
                const [credit] = await conn.execute(`
                    SELECT 
                        cs.*,
                        c.customer_name,
                        DATEDIFF(?, cs.credit_date) as duration_days,
                        COALESCE(
                            (
                                SELECT SUM(payment_amount) 
                                FROM credit_payments 
                                WHERE credit_id = cs.credit_id 
                                AND payment_date <= ?
                            ),
                            0
                        ) as total_paid_amount
                    FROM credit_sales cs
                    LEFT JOIN customers c ON cs.customer_id = c.customer_id
                    WHERE cs.credit_id = ? AND cs.user_id = ?
                `, [endDate, endDate, creditId, userId]);

                if (!credit || credit.length === 0) {
                    throw new Error('Credit not found or unauthorized');
                }

                const creditData = credit[0];
                const principal = parseFloat(creditData.credit_amount);
                const interestRate = parseFloat(creditData.interest_rate);
                const durationDays = parseInt(creditData.duration_days);
                const totalPaid = parseFloat(creditData.total_paid_amount);

                // Calculate simple interest
                const interestAmount = this.calculateSimpleInterest(principal, interestRate, durationDays);
                
                // Calculate outstanding amount
                const outstandingAmount = principal + interestAmount - totalPaid;

                // Record the interest calculation
                await this.recordInterestCalculation(creditId, {
                    calculation_date: endDate,
                    principal_amount: principal,
                    remaining_balance: outstandingAmount,
                    interest_rate: interestRate,
                    interest_amount: interestAmount,
                    month_name: new Date(endDate).toLocaleString('default', { month: 'long' }),
                    year: new Date(endDate).getFullYear(),
                    duration_days: durationDays
                });

                // Update credit with new interest and remaining amount
                await this.updateCreditAfterInterest(creditId, {
                    remaining_amount: outstandingAmount,
                    total_interest_amount: interestAmount
                });

                return {
                    credit_details: {
                        credit_id: creditId,
                        customer_name: creditData.customer_name,
                        credit_amount: principal,
                        interest_rate: interestRate,
                        duration_days: durationDays,
                        total_paid: totalPaid,
                        interest_amount: interestAmount,
                        current_outstanding: Math.max(0, outstandingAmount)
                    },
                    interest_breakdown: [{
                        date: new Date().toISOString().split('T')[0],
                        principal: principal,
                        payment: totalPaid,
                        outstanding: outstandingAmount,
                        days: durationDays,
                        interest_rate: interestRate,
                        interest: interestAmount
                    }],
                    summary: {
                        total_interest: interestAmount,
                        total_payments: totalPaid,
                        total_outstanding: Math.max(0, outstandingAmount)
                    }
                };
            });
        } catch (error) {
            console.error('Error calculating interest for date range:', error);
            throw error;
        }
    }
}

module.exports = CreditModel;
