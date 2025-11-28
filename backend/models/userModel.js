const db = require('../config/db');
const bcrypt = require('bcrypt');

class User {
    static async create(userData) {
        try {
            // Hash the password before storing
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            
            const query = `
                INSERT INTO users 
                (shop_name, owner_name, email, phone, password) 
                VALUES (?, ?, ?, ?, ?)
            `;
            
            const result = await db.executeQuery(query, [
                userData.shopName,
                userData.ownerName,
                userData.email,
                userData.phone,
                hashedPassword
            ]);
            
            return result;
        } catch (error) {
            console.error('Error in create:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                if (error.message.includes('email')) {
                    throw new Error('Email already exists');
                } else if (error.message.includes('phone')) {
                    throw new Error('Phone number already exists');
                }
            }
            throw error;
        }
    }

    static async findByContact(contact) {
        try {
            const query = 'SELECT * FROM users WHERE email = ? OR phone = ?';
            const results = await db.executeQuery(query, [contact, contact]);
            return results[0];
        } catch (error) {
            console.error('Error in findByContact:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const query = 'SELECT id, shop_name, owner_name, email, phone FROM users WHERE id = ?';
            const results = await db.executeQuery(query, [id]);
            return results[0];
        } catch (error) {
            console.error('Error in findById:', error);
            throw error;
        }
    }

    static async update(id, updates) {
        try {
            const query = 'UPDATE users SET shop_name = ?, owner_name = ?, email = ?, phone = ? WHERE id = ?';
            const result = await db.executeQuery(query, [
                updates.shopName,
                updates.ownerName,
                updates.email,
                updates.phone,
                id
            ]);
            return result;
        } catch (error) {
            console.error('Error in update:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                if (error.message.includes('email')) {
                    throw new Error('Email already exists');
                } else if (error.message.includes('phone')) {
                    throw new Error('Phone number already exists');
                }
            }
            throw error;
        }
    }

    static async delete(id) {
        try {
            const query = 'DELETE FROM users WHERE id = ?';
            const result = await db.executeQuery(query, [id]);
            return result;
        } catch (error) {
            console.error('Error in delete:', error);
            throw error;
        }
    }

    static async validatePassword(inputPassword, hashedPassword) {
        try {
            // Check if both arguments are provided
            if (!inputPassword || !hashedPassword) {
                throw new Error('Both password and hash are required for validation');
            }
            
            // Ensure both arguments are strings
            if (typeof inputPassword !== 'string' || typeof hashedPassword !== 'string') {
                throw new Error('Password and hash must be strings');
            }

            // Compare the password
            const isValid = await bcrypt.compare(inputPassword, hashedPassword);
            return isValid;
        } catch (error) {
            console.error('Error validating password:', error);
            throw error;
        }
    }
}

module.exports = User; 