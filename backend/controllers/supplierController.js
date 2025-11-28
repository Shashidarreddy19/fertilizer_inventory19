const Supplier = require('../models/supplierModel');

class SupplierController {
    static async getAll(req, res) {
        try {
            const userId = req.query.userId;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const results = await Supplier.getAll(userId);
            res.status(200).json(results);
        } catch (err) {
            console.error('Error fetching suppliers:', err);
            res.status(500).json({ error: err.message || 'Failed to fetch suppliers' });
        }
    }

    static async create(req, res) {
        try {
            const { supplierName, licenseNumber, phone, email, userId } = req.body;

            if (!supplierName || !licenseNumber || !phone || !email || !userId) {
                return res.status(400).json({ 
                    error: 'All fields are required',
                    required: ['supplierName', 'licenseNumber', 'phone', 'email', 'userId']
                });
            }

            const result = await Supplier.create({ 
                supplierName, 
                licenseNumber, 
                phone, 
                email, 
                userId 
            });

            res.status(201).json({ 
                message: 'Supplier added successfully',
                supplierId: result.insertId
            });
        } catch (err) {
            console.error('Error adding supplier:', err);
            if (err.message.includes('already exists')) {
                return res.status(400).json({ error: err.message });
            }
            res.status(500).json({ error: 'Failed to add supplier. Please try again.' });
        }
    }

    static async update(req, res) {
        try {
            const supplierId = req.params.id;
            const { supplierName, licenseNumber, phone, email, userId } = req.body;

            if (!supplierName || !licenseNumber || !phone || !email || !userId) {
                return res.status(400).json({ 
                    error: 'All fields are required',
                    required: ['supplierName', 'licenseNumber', 'phone', 'email', 'userId']
                });
            }

            const result = await Supplier.update(supplierId, { 
                supplierName, 
                licenseNumber, 
                phone, 
                email, 
                userId 
            });

            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    error: 'Supplier not found or you do not have permission to edit it' 
                });
            }

            res.status(200).json({ message: 'Supplier updated successfully' });
        } catch (err) {
            console.error('Error updating supplier:', err);
            res.status(500).json({ error: 'Failed to update supplier' });
        }
    }

    static async delete(req, res) {
        try {
            const supplierId = req.params.id;
            const userId = req.query.userId;

            // Validate required parameters
            if (!supplierId || !userId) {
                return res.status(400).json({ 
                    error: 'Both supplier ID and user ID are required' 
                });
            }

            // First check if supplier exists and belongs to user
            const supplier = await Supplier.getById(supplierId, userId);
            if (!supplier) {
                return res.status(404).json({ 
                    error: 'Supplier not found or you do not have permission to delete it' 
                });
            }

            // Delete the supplier
            const result = await Supplier.delete(supplierId, userId);
            
            res.status(200).json({ 
                message: 'Supplier deleted successfully',
                supplierId: supplierId
            });
        } catch (err) {
            console.error('Error deleting supplier:', err);
            if (err.message.includes('referenced')) {
                return res.status(400).json({ 
                    error: 'Cannot delete supplier as they have associated stock items' 
                });
            }
            res.status(500).json({ 
                error: err.message || 'Failed to delete supplier' 
            });
        }
    }

    static async getSupplierCount(req, res) {
        try {
            const userId = req.query.userId;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const count = await Supplier.getCount(userId);
            res.status(200).json({ count });
        } catch (err) {
            console.error('Error getting supplier count:', err);
            res.status(500).json({ error: 'Failed to get supplier count' });
        }
    }
}

module.exports = SupplierController; 