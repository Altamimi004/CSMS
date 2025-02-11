const jwt = require('jsonwebtoken');
const User = require('../models/User');

function isAuthenticated(req, res, next) {
    try {
        // Get token from Authorization header or cookie
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            console.log('No token found');
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ message: 'Invalid or expired token' });
    }
}

async function isAdmin(req, res, next) {
    try {
        const user = await User.findById(req.user.userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin privileges required' });
        }
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

module.exports = { isAuthenticated, isAdmin };