const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/User');
const { auth, rateLimitAuth, recordFailedAttempt, clearFailedAttempts } = require('../middleware/auth');

// Input validation helper
const validateInput = {
  email: (email) => {
    if (!email) throw new Error('Email is required');
    if (!validator.isEmail(email)) throw new Error('Invalid email format');
    if (email.length > 254) throw new Error('Email is too long');
    return validator.normalizeEmail(email);
  },
  
  password: (password) => {
    if (!password) throw new Error('Password is required');
    if (password.length < 6) throw new Error('Password must be at least 6 characters long');
    if (password.length > 128) throw new Error('Password is too long');
    // Check for common weak passwords
    const weakPasswords = ['123456', 'password', 'admin', 'qwerty'];
    if (weakPasswords.includes(password.toLowerCase())) {
      throw new Error('Password is too weak. Please choose a stronger password');
    }
    return password;
  },
  
  username: (username) => {
    if (!username) throw new Error('Username is required');
    if (username.length < 3) throw new Error('Username must be at least 3 characters long');
    if (username.length > 20) throw new Error('Username is too long');
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
    }
    return validator.escape(username.trim());
  },
  
  name: (name) => {
    if (name && name.length > 50) throw new Error('Name is too long');
    return name ? validator.escape(name.trim()) : name;
  },
  
  phone: (phone) => {
    if (phone && !validator.isMobilePhone(phone, 'any', { strictMode: false })) {
      throw new Error('Invalid phone number format');
    }
    return phone;
  }
};

// Sanitize user data for response
const sanitizeUserData = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  dateOfBirth: user.dateOfBirth,
  gender: user.gender,
  profilePicture: user.profilePicture,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

// Register new user
router.post('/register', rateLimitAuth, async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      firstName, 
      lastName, 
      phone, 
      dateOfBirth, 
      gender 
    } = req.body;

    // Validate inputs
    const validatedData = {
      username: validateInput.username(username),
      email: validateInput.email(email),
      password: validateInput.password(password),
      firstName: validateInput.name(firstName),
      lastName: validateInput.name(lastName),
      phone: validateInput.phone(phone)
    };

    // Additional validations
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      if (isNaN(birthDate.getTime())) {
        return res.status(400).json({ 
          message: 'Invalid date of birth format',
          code: 'INVALID_DATE'
        });
      }
      validatedData.dateOfBirth = birthDate;
    }

    if (gender && !['male', 'female', 'other', 'prefer-not-to-say'].includes(gender)) {
      return res.status(400).json({ 
        message: 'Invalid gender option',
        code: 'INVALID_GENDER'
      });
    }
    validatedData.gender = gender;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: validatedData.email }, 
        { username: validatedData.username }
      ] 
    });
    
    if (existingUser) {
      recordFailedAttempt(req);
      const field = existingUser.email === validatedData.email ? 'email' : 'username';
      return res.status(409).json({ 
        message: `User with this ${field} already exists`,
        code: 'USER_EXISTS'
      });
    }

    // Create new user
    const user = new User(validatedData);
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.TOKEN_EXPIRY || '7d' }
    );

    clearFailedAttempts(req);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: sanitizeUserData(user)
    });
  } catch (error) {
    console.error('Registration error:', error);
    recordFailedAttempt(req);
    
    if (error.code === 11000) {
      // MongoDB duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ 
        message: `${field} already exists`,
        code: 'DUPLICATE_FIELD'
      });
    }
    
    res.status(400).json({ 
      message: error.message || 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

router.post('/login', rateLimitAuth, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    const validatedEmail = validateInput.email(email);
    const validatedPassword = validateInput.password(password);

    // Find user by email
    const user = await User.findOne({ email: validatedEmail }).select('+password');
    if (!user) {
      recordFailedAttempt(req);
      return res.status(401).json({ 
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(validatedPassword);
    if (!isMatch) {
      recordFailedAttempt(req);
      return res.status(401).json({ 
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(req);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.TOKEN_EXPIRY || '7d' }
    );

    // Update last login time (you might want to add this field to User model)
    // user.lastLogin = new Date();
    // await user.save();

    res.json({
      message: 'Login successful',
      token,
      user: sanitizeUserData(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    recordFailedAttempt(req);
    res.status(500).json({ 
      message: 'Login failed. Please try again.',
      code: 'LOGIN_ERROR'
    });
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
