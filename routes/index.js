const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { router: transactionRoutes } = require('./transactions'); // Destructure router from transactions

// Import routes
const authRoutes = require('./auth');
const dashboardRoutes = require('./dashboard');
const chargerRoutes = require('./chargers');
const ocppRoutes = require('./ocpp');
const userRoutes = require('./users');

// Auth routes (no authentication required)
router.use('/api/auth', authRoutes);

// Protected API Routes
router.use('/api/dashboard', isAuthenticated, dashboardRoutes);
router.use('/api/chargers', isAuthenticated, chargerRoutes);
router.use('/api/transactions', isAuthenticated, transactionRoutes);
router.use('/api/ocpp', isAuthenticated, ocppRoutes);
router.use('/api/users', isAuthenticated, userRoutes);

// UI Routes
router.get('/', (req, res) => res.render('login', { title: 'Login' }));
router.get('/dashboard', isAuthenticated, (req, res) => res.render('dashboard', { title: 'Dashboard' }));
router.get('/chargers', isAuthenticated, (req, res) => res.render('chargers', { title: 'Chargers' }));
router.get('/ocpp', isAuthenticated, (req, res) => res.render('ocpp', { title: 'OCPP Control' }));
router.get('/transactions', isAuthenticated, (req, res) => res.render('transactions', { title: 'Transactions' }));
router.get('/users', isAuthenticated, (req, res) => res.render('users', { title: 'Users' }));

module.exports = router;