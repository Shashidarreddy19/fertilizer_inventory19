const db = require('../config/db');

class Supplier {
    static async getAll(userId) {
        try {
            const query = `
                SELECT id, name as supplier_name, license_number, phone, email 
                FROM suppliers 
                WHERE user_id = ?
                ORDER BY name ASC
            `;
            const results = await db.executeQuery(query, [userId]);
            return results;
        } catch (error) {
            console.error('Error in getAll:', error);
            throw new Error('Failed to fetch suppliers');
        }
    }

    static async create(supplierData) {
        try {
            // First check if supplier with same name exists for this user
            const checkQuery = `
                SELECT id FROM suppliers 
                WHERE user_id = ? AND name = ?
            `;
            const existing = await db.executeQuery(checkQuery, [
                supplierData.userId,
                supplierData.supplierName
            ]);

            if (existing && existing.length > 0) {
                throw new Error('A supplier with this name already exists for your account');
            }

            // Check for duplicate license number
            const licenseCheck = `
                SELECT id FROM suppliers 
                WHERE user_id = ? AND license_number = ?
            `;
            const existingLicense = await db.executeQuery(licenseCheck, [
                supplierData.userId,
                supplierData.licenseNumber
            ]);

            if (existingLicense && existingLicense.length > 0) {
                throw new Error('A supplier with this license number already exists');
            }

            // Check for duplicate phone
            const phoneCheck = `
                SELECT id FROM suppliers 
                WHERE user_id = ? AND phone = ?
            `;
            const existingPhone = await db.executeQuery(phoneCheck, [
                supplierData.userId,
                supplierData.phone
            ]);

            if (existingPhone && existingPhone.length > 0) {
                throw new Error('A supplier with this phone number already exists');
            }

            // Check for duplicate email
            const emailCheck = `
                SELECT id FROM suppliers 
                WHERE user_id = ? AND email = ?
            `;
            const existingEmail = await db.executeQuery(emailCheck, [
                supplierData.userId,
                supplierData.email
            ]);

            if (existingEmail && existingEmail.length > 0) {
                throw new Error('A supplier with this email already exists');
            }

            const insertQuery = `
                INSERT INTO suppliers 
                (user_id, name, license_number, phone, email) 
                VALUES (?, ?, ?, ?, ?)
            `;
            const result = await db.executeQuery(insertQuery, [
                supplierData.userId,
                supplierData.supplierName,
                supplierData.licenseNumber,
                supplierData.phone,
                supplierData.email
            ]);
            return result;
        } catch (error) {
            console.error('Error in create:', error);
            if (error.message.includes('already exists')) {
                throw error;
            }
            throw new Error('Failed to create supplier');
        }
    }

    static async update(supplierId, updates) {
        try {
            const query = `
                UPDATE suppliers 
                SET name = ?,
                    license_number = ?,
                    phone = ?,
                    email = ?
                WHERE id = ? AND user_id = ?
            `;
            const result = await db.executeQuery(query, [
                updates.supplierName,
                updates.licenseNumber,
                updates.phone,
                updates.email,
                supplierId,
                updates.userId
            ]);
            
            if (result.affectedRows === 0) {
                throw new Error('Supplier not found or you do not have permission to update it');
            }
            
            return result;
        } catch (error) {
            console.error('Error in update:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                if (error.message.includes('license_number')) {
                    throw new Error('A supplier with this license number already exists');
                } else if (error.message.includes('phone')) {
                    throw new Error('A supplier with this phone number already exists');
                } else if (error.message.includes('email')) {
                    throw new Error('A supplier with this email already exists');
                } else {
                    throw new Error('A supplier with this name already exists for this user');
                }
            }
            throw new Error('Failed to update supplier');
        }
    }

    static async getById(supplierId, userId) {
        try {
            const query = 'SELECT * FROM suppliers WHERE id = ? AND user_id = ?';
            const results = await db.executeQuery(query, [supplierId, userId]);
            if (!results || results.length === 0) {
                throw new Error('Supplier not found');
            }
            return results[0];
        } catch (error) {
            console.error('Error in getById:', error);
            throw new Error('Failed to fetch supplier');
        }
    }

    static async delete(supplierId, userId) {
        const connection = await db.pool.getConnection();
        try {
            await connection.beginTransaction();

            // Check if supplier has any associated stock items
            const [stockItems] = await connection.execute(
                'SELECT COUNT(*) as count FROM stock WHERE supplier_id = ?',
                [supplierId]
            );

            if (stockItems[0].count > 0) {
                throw new Error('Cannot delete supplier as they have associated stock items');
            }

            // Delete the supplier
            const [result] = await connection.execute(
                'DELETE FROM suppliers WHERE id = ? AND user_id = ?',
                [supplierId, userId]
            );

            if (result.affectedRows === 0) {
                throw new Error('Supplier not found or you do not have permission to delete it');
            }

            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            console.error('Error in delete:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getCount(userId) {
        try {
            const query = 'SELECT COUNT(*) as count FROM suppliers WHERE user_id = ?';
            const result = await db.executeQuery(query, [userId]);
            return result[0].count;
        } catch (error) {
            console.error('Error in getCount:', error);
            throw new Error('Failed to get supplier count');
        }
    }
}

module.exports = Supplier; 