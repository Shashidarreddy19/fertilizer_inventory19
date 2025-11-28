const Stock = require('../models/stockModel');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const Sales = require('../models/salesModel');

// Ensure upload directories exist
const createUploadDirs = () => {
    const uploadDirs = [
        path.join(__dirname, '..', 'public'),
        path.join(__dirname, '..', 'public', 'uploads'),
        path.join(__dirname, '..', 'public', 'uploads', 'products'),
        path.join(__dirname, '..', 'public', 'images')
    ];

    uploadDirs.forEach(dir => {
        const absolutePath = path.resolve(dir);
        if (!fs.existsSync(absolutePath)) {
            console.log('Creating directory:', absolutePath);
            fs.mkdirSync(absolutePath, { recursive: true });
        } else {
            console.log('Directory exists:', absolutePath);
        }
    });

    // Create default product image if it doesn't exist
    const defaultImagePath = path.join(__dirname, '..', 'public', 'images', 'default-product.png');
    if (!fs.existsSync(defaultImagePath)) {
        // Create a simple default image (1x1 transparent pixel)
        const defaultImageContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        fs.writeFileSync(defaultImagePath, defaultImageContent);
    }
};

// Create directories when the controller is loaded
createUploadDirs();

class StockController {
    static async getAll(req, res) {
        try {
            const userId = req.query.userId;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const results = await Stock.getAll(userId);
            
            // Format image URLs - ensure they're always valid and properly formatted
            const formattedResults = results.map(item => {
                // Ensure image_url is properly formatted
                let imageUrl = item.image_url;
                
                // If image_url exists but doesn't start with /, add it
                if (imageUrl && !imageUrl.startsWith('/')) {
                    imageUrl = '/' + imageUrl;
                }
                
                // If no image_url or invalid, use default
                if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || imageUrl.trim() === '') {
                    imageUrl = '/images/default-product.png';
                } else {
                    // Verify the image file actually exists on the server
                    const imagePath = path.join(__dirname, '..', 'public', imageUrl);
                    const absoluteImagePath = path.resolve(imagePath);
                    
                    if (!fs.existsSync(absoluteImagePath)) {
                        console.warn(`Image file not found: ${absoluteImagePath}`);
                        console.warn(`Looking for image: ${imageUrl}`);
                        console.warn(`Resolved path: ${absoluteImagePath}`);
                        console.warn(`Directory exists: ${fs.existsSync(path.dirname(absoluteImagePath))}`);
                        imageUrl = '/images/default-product.png';
                    } else {
                        console.log(`Image found: ${absoluteImagePath}`);
                    }
                }
                
                return {
                    ...item,
                    image_url: imageUrl
                };
            });

            res.json(formattedResults);
        } catch (err) {
            console.error('Error getting stock:', err);
            res.status(500).json({ error: 'Failed to get stock' });
        }
    }

    static async create(req, res) {
        try {
            // Ensure all required fields are present and properly formatted
            const formData = {
                userId: req.body.userId,
                supplierId: req.body.supplier,
                productName: req.body.productname,
                category: req.body.category,
                numberOfItems: parseInt(req.body.numberofitems) || 0,
                packageSize: req.body.packageSize ? parseFloat(req.body.packageSize) : null,
                quantityUnit: req.body.category === 'Pesticides' ? 'ml' : 'kg',
                expiryDate: req.body.expirydate,
                actualPrice: parseFloat(req.body.actualprice) || 0,
                sellingPrice: parseFloat(req.body.sellingprice) || 0,
                fixedQuantity: req.body.fixedQuantity ? parseFloat(req.body.fixedQuantity) : null
            };

            // Validate required fields
            if (!formData.userId || !formData.productName || !formData.category) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Validate package size based on category
            if (formData.category === 'Pesticides' || formData.category === 'Fertilizers' || formData.category === 'Seeds') {
                if (!formData.packageSize) {
                    return res.status(400).json({ error: `Package size is required for ${formData.category}` });
                }
                
                // Check if package size is within valid range
                if (formData.packageSize <= 0) {
                    return res.status(400).json({ error: 'Package size must be greater than 0' });
                }
                
                // Apply different validations based on category
                if (formData.category === 'Pesticides' && formData.packageSize > 10000) {
                    return res.status(400).json({ error: 'Package size for pesticides must be between 0.1 and 10000' });
                }
                
                if ((formData.category === 'Fertilizers' || formData.category === 'Seeds') && formData.packageSize > 1000) {
                    return res.status(400).json({ error: `Package size for ${formData.category.toLowerCase()} must be between 0.1 and 1000` });
                }
            }

            // Calculate quantity
            if (formData.packageSize && formData.numberOfItems) {
                formData.quantity = parseFloat((formData.packageSize * formData.numberOfItems).toFixed(2));
            } else {
                formData.quantity = 0;
            }

            // Handle image upload
            let imageUrl = null;
            if (req.files && req.files.productImage) {
                const file = req.files.productImage;
                
                // Ensure uploads directory exists
                createUploadDirs();

                // Generate unique filename - sanitize filename
                const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
                const fileName = `${Date.now()}-${sanitizedOriginalName}`;
                
                // Use absolute path for file saving
                const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
                const absoluteFilePath = path.resolve(uploadsDir, fileName);

                // Ensure directory exists
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                    console.log('Created uploads directory:', uploadsDir);
                }

                console.log('=== Image Upload Debug ===');
                console.log('Original filename:', file.name);
                console.log('Sanitized filename:', fileName);
                console.log('Upload directory:', uploadsDir);
                console.log('Absolute file path:', absoluteFilePath);
                console.log('File size:', file.size, 'bytes');
                console.log('File type:', file.mimetype);

                // Move the file
                try {
                    // Use absolute path for file.mv
                    await file.mv(absoluteFilePath);
                    
                    // Wait a bit and verify file was saved
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Verify file was saved with absolute path
                    if (!fs.existsSync(absoluteFilePath)) {
                        console.error('ERROR: File was not saved to:', absoluteFilePath);
                        throw new Error('Failed to save image file - file does not exist after upload');
                    }
                    
                    // Verify file size matches
                    const stats = fs.statSync(absoluteFilePath);
                    if (stats.size !== file.size) {
                        console.warn('WARNING: File size mismatch. Expected:', file.size, 'Got:', stats.size);
                    }
                    
                    console.log('SUCCESS: Image saved successfully');
                    console.log('File exists at:', absoluteFilePath);
                    console.log('File size on disk:', stats.size, 'bytes');
                    console.log('========================');
                    
                    // Set the URL path for database (relative path from public directory)
                    imageUrl = `/uploads/products/${fileName}`;
                } catch (mvError) {
                    console.error('ERROR moving file:', mvError);
                    console.error('Error details:', {
                        message: mvError.message,
                        code: mvError.code,
                        path: absoluteFilePath
                    });
                    throw new Error(`Failed to upload image: ${mvError.message}`);
                }
            }

            // Create stock with parsed data
            const result = await Stock.create({
                ...formData,
                imageUrl
            });

            res.status(201).json({
                message: 'Stock created successfully',
                stockId: result.insertId,
                imageUrl: imageUrl || '/images/default-product.png'
            });
        } catch (error) {
            console.error('Error creating stock:', error);
            if (error.message.includes('already exists')) {
                return res.status(409).json({ error: error.message });
            }
            res.status(500).json({ error: error.message || 'Failed to create stock' });
        }
    }

    static async getById(req, res) {
        try {
            const stockId = req.params.id;
            const userId = req.query.userId;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            if (!stockId) {
                return res.status(400).json({ error: 'Stock ID is required' });
            }

            const stock = await Stock.getById(stockId, userId);
            
            if (!stock) {
                return res.status(404).json({ error: 'Stock item not found' });
            }

            // Ensure image_url is properly formatted and file exists
            let imageUrl = stock.image_url;
            if (imageUrl && !imageUrl.startsWith('/')) {
                imageUrl = '/' + imageUrl;
            }
            if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || imageUrl.trim() === '') {
                imageUrl = '/images/default-product.png';
            } else {
                // Verify the image file actually exists
                const imagePath = path.join(__dirname, '..', 'public', imageUrl);
                if (!fs.existsSync(imagePath)) {
                    console.warn(`Image file not found: ${imagePath}, using default`);
                    imageUrl = '/images/default-product.png';
                }
            }

            res.status(200).json({
                ...stock,
                image_url: imageUrl
            });
        } catch (error) {
            console.error('Error fetching stock item:', error);
            res.status(500).json({ error: 'Failed to fetch stock item' });
        }
    }

    static async update(req, res) {
        try {
            const stockId = req.params.id;
            const userId = req.query.userId || req.body.userId;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            // Get the current stock record
            const currentStock = await Stock.getById(stockId, userId);

            if (!currentStock) {
                return res.status(404).json({ error: 'Stock item not found or unauthorized' });
            }

            // Handle image upload if provided
            let imageUrl = currentStock.image_url;
            if (req.files && req.files.productImage) {
                const file = req.files.productImage;
                
                // Create uploads directory if it doesn't exist
                createUploadDirs();

                // Generate unique filename - sanitize filename
                const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
                const fileName = `${Date.now()}-${sanitizedOriginalName}`;
                
                // Use absolute path for file saving
                const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
                const absoluteFilePath = path.resolve(uploadsDir, fileName);

                // Ensure directory exists
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }

                try {
                    // Move the file using absolute path
                    await file.mv(absoluteFilePath);
                    
                    // Verify file was saved
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    if (!fs.existsSync(absoluteFilePath)) {
                        throw new Error('Failed to save image file');
                    }
                    
                    // Set the URL path for database
                    imageUrl = `/uploads/products/${fileName}`;

                    // SAFE deletion of old image file
                    if (currentStock.image_url && !currentStock.image_url.includes('default-product.png')) {
                        const oldImagePath = path.join(__dirname, '..', 'public', currentStock.image_url);
                        try {
                            if (fs.existsSync(oldImagePath)) {
                                fs.unlinkSync(oldImagePath);
                                console.log('Deleted old image:', oldImagePath);
                            }
                        } catch (err) { 
                            console.log("Error deleting old image:", err.message); 
                        }
                    }


                } catch (fileError) {
                    console.error('Error handling file upload:', fileError);
                    return res.status(500).json({ error: 'Failed to upload image' });
                }
            }

            // Prepare update data with proper type conversion
            const updates = {
                userId,
                productName: req.body.productname,
                category: req.body.category,
                numberOfItems: parseInt(req.body.numberofitems) || 0,
                packageSize: req.body.packageSize ? parseFloat(req.body.packageSize) : null,
                quantityUnit: req.body.category === 'Pesticides' ? 'ml' : 'kg',
                actualPrice: parseFloat(req.body.actualprice) || 0,
                sellingPrice: parseFloat(req.body.sellingprice) || 0,
                expiryDate: req.body.expirydate || null,
                fixedQuantity: req.body.fixedQuantity ? parseFloat(req.body.fixedQuantity) : null,
                imageUrl: imageUrl,
                supplierId: req.body.supplier || null
            };

            // Calculate quantity
            if (updates.packageSize && updates.numberOfItems) {
                updates.quantity = parseFloat((updates.packageSize * updates.numberOfItems).toFixed(2));
            } else {
                updates.quantity = 0;
            }

            // Validate package size based on category
            if (updates.category === 'Pesticides' || updates.category === 'Fertilizers' || updates.category === 'Seeds') {
                if (!updates.packageSize) {
                    return res.status(400).json({ error: `Package size is required for ${updates.category}` });
                }
                
                // Check if package size is within valid range
                if (updates.packageSize <= 0) {
                    return res.status(400).json({ error: 'Package size must be greater than 0' });
                }
                
                // Apply different validations based on category
                if (updates.category === 'Pesticides' && updates.packageSize > 10000) {
                    return res.status(400).json({ error: 'Package size for pesticides must be between 0.1 and 10000' });
                }
                
                if ((updates.category === 'Fertilizers' || updates.category === 'Seeds') && updates.packageSize > 1000) {
                    return res.status(400).json({ error: `Package size for ${updates.category.toLowerCase()} must be between 0.1 and 1000` });
                }
            }

            // Update the stock record
            const updatedStock = await Stock.update(stockId, updates);

            if (!updatedStock) {
                throw new Error('Failed to update stock item');
            }

            res.json({ 
                message: 'Product updated successfully',
                stock: updatedStock
            });
        } catch (error) {
            console.error('Error updating stock:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to update stock item',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

// DELETE stock item
static async delete(req, res) {
    try {
        const stockId = req.params.id;
        
        // Safely check userId from multiple sources (query, body, headers)
        // Note: req.body might be undefined for DELETE requests, so check safely
        let userId = null;
        
        // Priority: query string > headers > body (if exists)
        if (req.query && req.query.userId) {
            userId = req.query.userId;
        } else if (req.headers && (req.headers.userid || req.headers['userid'])) {
            userId = req.headers.userid || req.headers['userid'];
        } else if (req.body && typeof req.body === 'object' && req.body.userId) {
            userId = req.body.userId;
        }

        if (!userId) {
            console.error('Delete: userId not found in query, headers, or body');
            return res.status(400).json({
                success: false,
                message: "User ID is required. Please provide userId in query string or headers."
            });
        }

        if (!stockId) {
            return res.status(400).json({
                success: false,
                message: "Stock ID is required"
            });
        }

        const result = await Stock.delete(stockId, userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error("Delete error in controller:", error);
        console.error("Error stack:", error.stack);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal delete error"
        });
    }
}

    static async getLowStock(req, res) {
        try {
            const { userId } = req.query;
            
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const lowStockItems = await Stock.getLowStock(userId);
            
            // Format the response
            const alerts = lowStockItems.map(item => ({
                id: item.id,
                product_name: item.product_name,
                category: item.category,
                quantity: parseFloat(item.quantity),
                quantity_unit: item.quantity_unit,
                number_of_items: parseInt(item.number_of_items),
                low_stock_threshold: parseInt(item.low_stock_threshold) || 10,
                updated_at: item.updated_at,
                image_url: item.image_url || '/images/default-product.png'
            }));

            res.json({
                count: alerts.length,
                alerts: alerts
            });
        } catch (error) {
            console.error('Error getting low stock:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to fetch low stock alerts',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    static async getExpiringSoon(req, res) {
        try {
            const userId = req.query.userId;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const currentDate = new Date().toISOString().split('T')[0];
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            const results = await Stock.getExpiringSoon(userId, currentDate, futureDateStr);
            res.json(results);
        } catch (err) {
            console.error('Error getting expiring soon items:', err);
            res.status(500).json({ error: 'Failed to get expiring soon items' });
        }
    }

    static async getStockCounts(req, res) {
        try {
            const userId = req.query.userId;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const counts = await Stock.getStockCounts(userId);
            res.json(counts);
        } catch (err) {
            console.error('Error getting stock counts:', err);
            res.status(500).json({ error: 'Failed to get stock counts' });
        }
    }
}

module.exports = StockController; 