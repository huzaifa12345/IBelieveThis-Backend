import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Register new user
const register = async (req, res) => {
  try {
    console.log('ERROR AT [AUTH/REGISTER]: Starting registration process');
    const { first_name, last_name, email, password, phone } = req.body;

    console.log('ERROR AT [AUTH/REGISTER]: Request data:', { first_name, last_name, email, phone: phone ? 'provided' : 'not provided' });

    // Check if user already exists
    console.log('ERROR AT [AUTH/REGISTER]: Checking if user exists');
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      console.log('ERROR AT [AUTH/REGISTER]: User already exists:', email);
      return res.status(400).json({ error: 'User with this email already exists', message: 'User with this email already exists' });
    }

    // Hash password
    console.log('ERROR AT [AUTH/REGISTER]: Hashing password');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    console.log('ERROR AT [AUTH/REGISTER]: Creating user');
    const user = await User.create({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      phone,
      // Staff roles are never self-assignable from a public signup.
      role: 'customer'
    });

    // Generate JWT token
    console.log('ERROR AT [AUTH/REGISTER]: Generating JWT token');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const userResponse = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at
    };

    console.log('ERROR AT [AUTH/REGISTER]: Registration successful for:', email);
    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('ERROR AT [AUTH/REGISTER]:', error);
    console.error('ERROR AT [AUTH/REGISTER]: Stack:', error.stack);
    res.status(400).json({ 
      message: error.message, 
      stack: error.stack,
      error: 'Registration failed'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    console.log('ERROR AT [AUTH/LOGIN]: Starting login process');
    const { email, password } = req.body;
    
    console.log('ERROR AT [AUTH/LOGIN]: Login attempt for:', email);

    // Find user
    console.log('ERROR AT [AUTH/LOGIN]: Finding user');
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log('ERROR AT [AUTH/LOGIN]: User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials', message: 'User not found' });
    }

    // Check if user is active
    if (!user.is_active) {
      console.log('ERROR AT [AUTH/LOGIN]: Account deactivated:', email);
      return res.status(401).json({ error: 'Account is deactivated', message: 'Account is deactivated' });
    }

    // Check password
    console.log('ERROR AT [AUTH/LOGIN]: Comparing password');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('ERROR AT [AUTH/LOGIN]: Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials', message: 'Invalid password' });
    }

    // Generate JWT token
    console.log('ERROR AT [AUTH/LOGIN]: Generating JWT token');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const userResponse = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at
    };

    console.log('ERROR AT [AUTH/LOGIN]: Login successful for:', email);
    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('ERROR AT [AUTH/LOGIN]:', error);
    console.error('ERROR AT [AUTH/LOGIN]: Stack:', error.stack);
    res.status(500).json({ 
      message: error.message, 
      stack: error.stack,
      error: 'Login failed'
    });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone } = req.body;
    
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({
      first_name: first_name || user.first_name,
      last_name: last_name || user.last_name,
      phone: phone || user.phone
    });

    // Remove password from response
    const userResponse = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      is_active: user.is_active,
      updated_at: user.updated_at
    };

    res.json({
      message: 'Profile updated successfully',
      user: userResponse
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { email, current_password, new_password } = req.body;

    if (!email || !current_password || !new_password) {
      return res.status(400).json({ error: 'Email, current password, and new password are required' });
    }

    const requestedEmail = email.toLowerCase();
    const authenticatedEmail = req.user?.email?.toLowerCase();

    if (authenticatedEmail && authenticatedEmail !== requestedEmail) {
      return res.status(403).json({ error: 'You can only change your own password' });
    }

    const user = await User.findOne({ where: { email: requestedEmail } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(new_password, salt);

    await user.update({ password: hashedNewPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Create admin user (for seeding)
const createAdmin = async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;

    // Check if admin already exists
    const existingAdmin = await User.findOne({ where: { email, role: 'admin' } });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin user already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const admin = await User.create({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      role: 'admin'
    });

    res.status(201).json({
      message: 'Admin user created successfully',
      admin: {
        id: admin.id,
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  createAdmin
};
