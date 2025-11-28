const db = require('../config/db');

class Stock {
    static async getAll(userId) {
        try {
            const query = `
                SELECT 
                    s.*,
                    sup.name as supplier_name,
                    s.image_url as image_url
                FROM stock s 
                LEFT JOIN suppliers sup ON s.supplier_id = sup.id 
                WHERE s.user_id = ?
                ORDER BY s.product_name ASC
            `;
            const results = await db.executeQuery(query, [userId]);
            return results;
        } catch (error) {
            console.error('Error in getAll:', error);
            throw new Error('Failed to fetch stock data');
        }
    }

    static async create(stockData) {
        try {
            // First check if a product with the same name already exists for this user
            const checkExisting = `
                SELECT id FROM stock 
                WHERE user_id = ? AND product_name = ?
            `;
            const existingProduct = await db.executeQuery(checkExisting, [
                stockData.userId,
                stockData.productName
            ]);

            if (existingProduct && existingProduct.length > 0) {
                throw new Error(`A product with the name "${stockData.productName}" already exists for this user`);
            }

            // Sanitize and validate the input data
            const sanitizedData = {
                userId: stockData.userId || null,
                supplierId: stockData.supplierId || null,
                productName: stockData.productName || null,
                category: stockData.category || null,
                packageSize: stockData.packageSize ? parseFloat(stockData.packageSize) : null,
                numberOfItems: parseInt(stockData.numberOfItems) || 0,
                quantityUnit: stockData.category === 'Pesticides' ? 'ml' : 'kg', // Default unit based on category
                quantity: stockData.quantity || 0,
                expiryDate: stockData.expiryDate || null,
                actualPrice: parseFloat(stockData.actualPrice) || 0,
                sellingPrice: parseFloat(stockData.sellingPrice) || 0,
                fixedQuantity: stockData.fixedQuantity ? parseFloat(stockData.fixedQuantity) : null,
                imageUrl: stockData.imageUrl || null
            };

            // Validate required fields
            if (!sanitizedData.userId || !sanitizedData.productName || !sanitizedData.category) {
                throw new Error('Missing required fields');
            }

            // Ensure package size is a valid number and within reasonable range
            if (sanitizedData.packageSize) {
                // Ensure package size doesn't exceed database field limits
                if (sanitizedData.category === 'Pesticides' && sanitizedData.packageSize > 10000) {
                    throw new Error('Package size for pesticides must be between 0.1 and 10000');
                }
                
                if ((sanitizedData.category === 'Fertilizers' || sanitizedData.category === 'Seeds') && 
                    sanitizedData.packageSize > 1000) {
                    throw new Error(`Package size for ${sanitizedData.category.toLowerCase()} must be between 0.1 and 1000`);
                }
            }

            // Calculate quantity if package size and number of items are provided
            if (sanitizedData.packageSize && sanitizedData.numberOfItems) {
                sanitizedData.quantity = parseFloat((sanitizedData.packageSize * sanitizedData.numberOfItems).toFixed(2));
            }

            const query = `
                INSERT INTO stock 
                (user_id, supplier_id, product_name, category, package_size, 
                number_of_items, quantity_unit, quantity, expiry_date, 
                actual_price, selling_price, fixed_quantity, image_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                sanitizedData.userId,
                sanitizedData.supplierId,
                sanitizedData.productName,
                sanitizedData.category,
                sanitizedData.packageSize,
                sanitizedData.numberOfItems,
                sanitizedData.quantityUnit,
                sanitizedData.quantity,
                sanitizedData.expiryDate,
                sanitizedData.actualPrice,
                sanitizedData.sellingPrice,
                sanitizedData.fixedQuantity,
                sanitizedData.imageUrl
            ];

            const result = await db.executeQuery(query, params);
            return result;
        } catch (error) {
            console.error('Error in create:', error);
            
            // Improved error handling for duplicate entries
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('A product with this name already exists for this user');
            }
            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                throw new Error('Invalid supplier ID');
            }
            
            // Re-throw the original error if it's already a custom message
            if (error.message.includes('already exists')) {
                throw error;
            }
            
            throw new Error('Failed to create stock entry');
        }
    }

    static async update(stockId, updates) {
        try {
            const updateFields = [];
            const values = [];

            // Calculate quantity if package size and number of items are provided
            if (updates.packageSize && updates.numberOfItems) {
                updates.quantity = parseFloat((updates.packageSize * updates.numberOfItems).toFixed(2));
            }

            // Build dynamic update query
            if (updates.productName) {
                updateFields.push('product_name = ?');
                values.push(updates.productName);
            }
            if (updates.category) {
                updateFields.push('category = ?');
                values.push(updates.category);
            }
            if (updates.packageSize !== undefined) {
                updateFields.push('package_size = ?');
                values.push(updates.packageSize);
            }
            if (typeof updates.numberOfItems === 'number') {
                updateFields.push('number_of_items = ?');
                values.push(updates.numberOfItems);
            }
            if (updates.quantityUnit) {
                updateFields.push('quantity_unit = ?');
                values.push(updates.quantityUnit);
            }
            if (typeof updates.quantity === 'number') {
                updateFields.push('quantity = ?');
                values.push(updates.quantity);
            }
            if (typeof updates.actualPrice === 'number') {
                updateFields.push('actual_price = ?');
                values.push(updates.actualPrice);
            }
            if (typeof updates.sellingPrice === 'number') {
                updateFields.push('selling_price = ?');
                values.push(updates.sellingPrice);
            }
            if (updates.expiryDate !== undefined) {
                updateFields.push('expiry_date = ?');
                values.push(updates.expiryDate);
            }
            if (updates.fixedQuantity !== undefined) {
                updateFields.push('fixed_quantity = ?');
                values.push(updates.fixedQuantity);
            }
            if (updates.imageUrl) {
                updateFields.push('image_url = ?');
                values.push(updates.imageUrl);
            }
            if (updates.supplierId !== undefined) {
                updateFields.push('supplier_id = ?');
                values.push(updates.supplierId);
            }

            // Add updated_at timestamp
            updateFields.push('updated_at = CURRENT_TIMESTAMP');

            // Add stock_id and user_id to values array for WHERE clause
            values.push(stockId);
            values.push(updates.userId);

            const query = `
                UPDATE stock 
                SET ${updateFields.join(', ')}
                WHERE id = ? AND user_id = ?
            `;

            const result = await db.executeQuery(query, values);

            // executeQuery returns array, but for UPDATE we need to check affectedRows
            // Check if result is array and get first element, or use result directly
            const updateResult = Array.isArray(result) ? result[0] : result;
            
            if (!updateResult || (updateResult.affectedRows !== undefined && updateResult.affectedRows === 0)) {
                return null;
            }

            // Fetch and return the updated record
            const updatedStock = await this.getById(stockId, updates.userId);
            return updatedStock;
        } catch (error) {
            console.error('Error in Stock.update:', error);
            throw new Error('Failed to update stock item');
        }
    }

    static async getById(stockId, userId) {
        try {
            const query = `
                SELECT s.*, sup.name as supplier_name 
                FROM stock s 
                LEFT JOIN suppliers sup ON s.supplier_id = sup.id 
                WHERE s.id = ? AND s.user_id = ?
            `;
            const results = await db.executeQuery(query, [stockId, userId]);
            return results[0];
        } catch (error) {
            console.error('Error in getById:', error);
            throw new Error('Failed to fetch stock item');
        }
    }

    static async updateQuantity(stockId, userId, newQuantity) {
        try {
            const query = `
                UPDATE stock 
                SET number_of_items = ?,
                    quantity = ? * package_size
                WHERE id = ? AND user_id = ?
            `;
            const result = await db.executeQuery(query, [newQuantity, newQuantity, stockId, userId]);
            
            // executeQuery returns array, check affectedRows properly
            const updateResult = Array.isArray(result) ? result[0] : result;
            
            if (!updateResult || (updateResult.affectedRows !== undefined && updateResult.affectedRows === 0)) {
                throw new Error('Stock item not found');
            }
            
            return result;
        } catch (error) {
            console.error('Error in updateQuantity:', error);
            throw new Error('Failed to update stock quantity');
        }
    }

    static async getLowStock(userId) {
        try {
            const query = `
                SELECT 
                    s.*,
                    COALESCE(sup.name, 'N/A') as supplier_name,
                    COALESCE(s.low_stock_threshold, 10) as low_stock_threshold
                FROM stock s 
                LEFT JOIN suppliers sup ON s.supplier_id = sup.id 
                WHERE s.user_id = ? 
                AND (
                    s.quantity <= COALESCE(s.low_stock_threshold, 10)
                    OR s.number_of_items <= COALESCE(s.low_stock_threshold, 10)
                )
                ORDER BY 
                    CASE 
                        WHEN s.quantity <= COALESCE(s.low_stock_threshold, 10) 
                        AND s.number_of_items <= COALESCE(s.low_stock_threshold, 10) 
                        THEN 1
                        ELSE 2
                    END,
                    s.quantity ASC,
                    s.number_of_items ASC
            `;

            const results = await db.executeQuery(query, [userId]);
            
            if (!results || results.length === 0) {
                return [];
            }

            return results;
        } catch (error) {
            console.error('Error in getLowStock:', error);
            throw new Error('Failed to fetch low stock items');
        }
    }

    static async getExpiringSoon(userId) {
        try {
            const query = `
                SELECT 
                    s.*,
                    sup.name as supplier_name,
                    DATEDIFF(s.expiry_date, CURDATE()) as days_until_expiry
                FROM stock s 
                LEFT JOIN suppliers sup ON s.supplier_id = sup.id 
                WHERE s.user_id = ? 
                    AND s.expiry_date IS NOT NULL 
                    AND s.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                    AND s.expiry_date >= CURDATE()
                ORDER BY s.expiry_date ASC
            `;

            const results = await db.executeQuery(query, [userId]);

            if (!results || results.length === 0) {
                return [];
            }

            // Format the results
            return results.map(item => ({
                id: item.id,
                product_name: item.product_name,
                category: item.category,
                supplier_name: item.supplier_name || 'N/A',
                quantity: parseFloat(item.quantity) || 0,
                quantity_unit: item.quantity_unit || 'units',
                number_of_items: parseInt(item.number_of_items) || 0,
                expiry_date: item.expiry_date,
                days_until_expiry: item.days_until_expiry,
                image_url: item.image_url
            }));
        } catch (error) {
            console.error('Error in getExpiringSoon:', error);
            throw new Error('Failed to fetch expiring items');
        }
    }

    static async getStockCounts(userId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock,
                    SUM(CASE 
                        WHEN expiry_date IS NOT NULL 
                        AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) 
                        THEN 1 ELSE 0 END) as expiring_soon
                FROM stock 
                WHERE user_id = ?
            `;
            const results = await db.executeQuery(query, [userId]);
            return results[0];
        } catch (error) {
            console.error('Error in getStockCounts:', error);
            throw new Error('Failed to fetch stock counts');
        }
    }

    static async delete(stockId, userId) {
        let connection;
    try {
            connection = await db.pool.getConnection();
            
        // Check if stock exists
            const [stockItems] = await connection.execute(
            'SELECT * FROM stock WHERE id = ? AND user_id = ?',
            [stockId, userId]
        );

        if (!stockItems || stockItems.length === 0) {
            return {
                success: false,
                message: 'Stock item not found or unauthorized'
            };
        }

        // Check references safely
        let creditCount = 0;
        let salesCount = 0;

        try {
                const [creditReferences] = await connection.execute(
                'SELECT COUNT(*) AS count FROM credit_products WHERE product_id = ?',
                [stockId]
            );
                creditCount = creditReferences[0]?.count || 0;
        } catch (err) {
            console.warn("credit_products check failed:", err.message);
        }

        try {
                const [salesReferences] = await connection.execute(
                'SELECT COUNT(*) AS count FROM sale_items WHERE product_id = ?',
                [stockId]
            );
                salesCount = salesReferences[0]?.count || 0;
        } catch (err) {
            console.warn("sale_items check failed:", err.message);
        }

        if (creditCount > 0) {
            return { success: false, message: "Cannot delete: used in credit transactions" };
        }

        if (salesCount > 0) {
            return { success: false, message: "Cannot delete: used in sales records" };
        }

        // DELETE now
            const [deleteResult] = await connection.execute(
            'DELETE FROM stock WHERE id = ? AND user_id = ?',
            [stockId, userId]
        );

            if (!deleteResult || deleteResult.affectedRows === 0) {
                return { 
                    success: false, 
                    message: "Delete failed - item may have already been deleted or you don't have permission" 
                };
        }

        return {
            success: true,
            message: 'Stock deleted successfully'
        };

    } catch (error) {
            console.error('Delete error in stockModel:', error);
        return {
            success: false,
                message: error.message || 'Internal delete error'
        };
        } finally {
            if (connection) {
                connection.release();
            }
    }
}

    static async updateStockQuantities(products, userId, operation = 'subtract', connection = null) {
        try {
            const useProvidedConnection = !!connection;
            const conn = connection || await db.getConnection();
            
            if (!useProvidedConnection) {
                await conn.beginTransaction();
            }

            try {
                for (const product of products) {
                    const productId = product.productId || product.product_id;
                    const numberOfItems = parseInt(product.number_of_items || product.quantity);

                    // Get current stock
                    const [stockRows] = await conn.execute(
                        'SELECT number_of_items, package_size FROM stock WHERE id = ? AND user_id = ?',
                        [productId, userId]
                    );

                    if (stockRows.length === 0) {
                        throw new Error(`Product with ID ${productId} not found in stock`);
                    }

                    const currentStock = stockRows[0];
                    const operator = operation === 'subtract' ? '-' : '+';

                    // Check if operation would result in negative stock
                    if (operation === 'subtract' && numberOfItems > currentStock.number_of_items) {
                        throw new Error(`Insufficient stock for product ID ${productId}. Available: ${currentStock.number_of_items} items`);
                    }

                    // Update stock - both number_of_items and quantity
                    await conn.execute(
                        `UPDATE stock 
                         SET number_of_items = number_of_items ${operator} ?,
                             quantity = (number_of_items ${operator} ?) * COALESCE(package_size, 1)
                         WHERE id = ? AND user_id = ?`,
                        [numberOfItems, numberOfItems, productId, userId]
                    );
                }

                if (!useProvidedConnection) {
                    await conn.commit();
                }

                return true;
            } catch (error) {
                if (!useProvidedConnection) {
                    await conn.rollback();
                }
                throw error;
            } finally {
                if (!useProvidedConnection && conn) {
                    conn.release();
                }
            }
        } catch (error) {
            console.error('Error in updateStockQuantities:', error);
            throw error;
        }
    }
}

module.exports = Stock; 