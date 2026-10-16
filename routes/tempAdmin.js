import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Temporary route to update user role to admin
router.post('/update-admin', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        message: 'Email is required' 
      });
    }

    // Find the user by email
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    // Update user role to admin
    await user.update({ role: 'admin' });
    
    console.log(`User ${email} updated to admin role`);
    
    res.status(200).json({ 
      message: 'User role updated to admin successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('ERROR updating user role:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Get all users (for checking roles)
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'first_name', 'last_name', 'role', 'created_at']
    });
    
    res.status(200).json({ 
      message: 'Users retrieved successfully',
      users: users
    });
    
  } catch (error) {
    console.error('ERROR retrieving users:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

export default router;
