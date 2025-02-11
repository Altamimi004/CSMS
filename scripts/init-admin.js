require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function initializeAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Check if admin user exists
        const existingAdmin = await User.findOne({ username: process.env.ADMIN_USERNAME });
        
        if (existingAdmin) {
            console.log('Admin user already exists');
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

        // Create admin user
        const adminUser = new User({
            username: process.env.ADMIN_USERNAME,
            email: process.env.ADMIN_EMAIL,
            password: hashedPassword,
            role: 'admin'
        });

        await adminUser.save();
        console.log('Admin user created successfully');

    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await mongoose.disconnect();
    }
}

initializeAdmin(); 