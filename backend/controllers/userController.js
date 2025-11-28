const User = require('../models/userModel');
const bcrypt = require('bcrypt');

async function signup(req, res) {
    try {
        const { shopName, ownerName, email, phone, password } = req.body;

        // Validate required fields
        if (!shopName || !ownerName || !email || !phone || !password) {
            return res.status(400).json({ 
                success: false,
                error: 'All fields are required: shopName, ownerName, email, phone, password' 
            });
        }

        // Create new user
        const result = await User.create({
            shopName,
            ownerName,
            email,
            phone,
            password
        });

        res.status(201).json({ 
            success: true,
            message: 'User registered successfully',
            userId: result.insertId 
        });
    } catch (error) {
        console.error('Error in signup:', error);
        
         // ⭐ Detect MySQL duplicate error wrapped by db.js
        if (error.message.includes("Duplicate entry") && error.message.includes("users.email")) {
            return res.status(400).json({
                success: false,
                error: "This email is already registered. Please use another email."
            });
        }

        return res.status(500).json({
            success: false,
            error: "Error registering user. Please try again."
        });
    }
}

async function login(req, res) {
    try {
        const { contact, password } = req.body;

        // Validate required fields
        if (!contact || !password) {
            return res.status(400).json({ 
                success: false,
                error: 'Both contact (email/phone) and password are required' 
            });
        }

        // Find user by email or phone
        const user = await User.findByContact(contact);
        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid credentials' 
            });
        }

        try {
            // Verify password
            const isValid = await User.validatePassword(password, user.password);
            if (!isValid) {
                return res.status(401).json({ 
                    success: false,
                    error: 'Invalid credentials' 
                });
            }

            // Return user data (excluding password)
            const { password: _, ...userData } = user;
            res.json({
                success: true,
                message: 'Login successful',
                user: userData
            });
        } catch (validationError) {
            console.error('Password validation error:', validationError);
            return res.status(500).json({ 
                success: false,
                error: 'Error validating credentials. Please try again.' 
            });
        }
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error during login. Please try again.' 
        });
    }
}

module.exports = {
    signup,
    login
}; 