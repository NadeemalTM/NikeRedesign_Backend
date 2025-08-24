const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email or username already exists' 
      });
    }

    // Create new user
    const user = new User({ username, email, password });
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  console.log('Login attempt:', req.body); // Log login attempt
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    // The auth middleware already sets req.user with the user object
    // We just need to return it
    res.json(req.user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, phone, dateOfBirth, gender } = req.body;
    
    // Parse date if provided
    let parsedDateOfBirth = dateOfBirth;
    if (dateOfBirth) {
      parsedDateOfBirth = new Date(dateOfBirth);
      if (isNaN(parsedDateOfBirth.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id, // Use _id from the user object
      { 
        firstName, 
        lastName, 
        phone, 
        dateOfBirth: parsedDateOfBirth, 
        gender,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update profile picture
router.put('/profile/picture', auth, async (req, res) => {
  try {
    const { profilePicture } = req.body;
    
    // Validate that profilePicture is provided
    if (!profilePicture) {
      return res.status(400).json({ message: 'Profile picture is required' });
    }

    // For now, accept base64 strings directly
    // In production, you might want to validate the base64 format
    // or implement proper file upload with multer
    
    const user = await User.findByIdAndUpdate(
      req.user._id, // Use _id from the user object
      { 
        profilePicture,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile picture updated successfully',
      user
    });
  } catch (error) {
    console.error('Profile picture update error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Create default admin and user accounts if they don't exist
const createDefaultAccounts = async () => {
  try {
    const adminExists = await User.findOne({ email: 'admin@nike.com' });
    if (!adminExists) {
      const admin = new User({
        username: 'admin@nike.com',
        email: 'admin@nike.com',
        password: '123456',
        role: 'admin'
      });
      await admin.save();
      console.log('Default admin account created');
    }

    const userExists = await User.findOne({ email: 'user1@nike.com' });
    if (!userExists) {
      const user = new User({
        username: 'user1@nike.com',
        email: 'user1@nike.com',
        password: '123456',
        role: 'user'
      });
      await user.save();
      console.log('Default user account created');
    }
  } catch (error) {
    console.error('Error creating default accounts:', error);
  }
};

// Call the function to create default accounts
createDefaultAccounts();

module.exports = router;
