import express from 'express';
import { register, login, getProfile, updateProfile, changePassword, createAdmin } from '../controllers/AuthController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

// Public route - change password by email + current password
router.put('/change-password', changePassword);

// Admin route
router.post('/create-admin', createAdmin);

export default router;
