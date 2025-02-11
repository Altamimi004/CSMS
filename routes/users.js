const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Check if first user (will be admin)
const isFirstUser = async () => {
    const count = await User.countDocuments();
    return count === 0;
};

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await User.find().select('-password -__v');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single user
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create user route - modified to handle first user case
router.post('/', async (req, res) => {
    try {
        const { username, password, email, role } = req.body;
        
        // Check if this is the first user
        const firstUser = await isFirstUser();
        
        // If not first user, check for admin rights
        if (!firstUser) {
            // Get the current user from the session/token
            const currentUser = req.user;
            if (!currentUser || currentUser.role !== 'admin') {
                return res.status(403).json({ message: 'Admin privileges required' });
            }
        }

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = new User({
            username,
            password: hashedPassword,
            email,
            role: firstUser ? 'admin' : (role || 'user') // First user is always admin
        });

        await user.save();
        
        // Don't send password in response
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: error.message });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        // Don't allow password updates through this route
        const { password, ...updateData } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Debug route
router.get('/debug/all', async (req, res) => {
    try {
        const users = await User.find().select('-password -__v');
        res.json({
            count: users.length,
            users: users
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;