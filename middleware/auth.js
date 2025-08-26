const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Rate limiting map for failed attempts
const failedAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Access denied. No valid token provided.',
        code: 'NO_TOKEN'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        message: 'Access denied. No valid token provided.',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token has expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ 
        message: 'Token has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Find user and exclude sensitive information
    const user = await User.findById(decoded.userId).select('-password -__v');
    
    if (!user) {
      return res.status(401).json({ 
        message: 'User not found. Token is invalid.',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Check if user account is active (you might want to add this field to User model)
    // if (user.status === 'inactive') {
    //   return res.status(401).json({ 
    //     message: 'Account is deactivated.',
    //     code: 'ACCOUNT_INACTIVE'
    //   });
    // }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token format.',
        code: 'INVALID_TOKEN'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      message: 'Internal server error during authentication.',
      code: 'AUTH_ERROR'
    });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required.',
        code: 'NOT_AUTHENTICATED'
      });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Administrator privileges required.',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ 
      message: 'Internal server error during authorization.',
      code: 'AUTH_ERROR'
    });
  }
};

// Rate limiting middleware for sensitive operations
const rateLimitAuth = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (failedAttempts.has(clientIP)) {
    const attempts = failedAttempts.get(clientIP);
    
    // Check if still in lockout period
    if (attempts.count >= MAX_FAILED_ATTEMPTS && 
        (now - attempts.lastAttempt) < LOCKOUT_DURATION) {
      const remainingTime = Math.ceil((LOCKOUT_DURATION - (now - attempts.lastAttempt)) / 1000 / 60);
      return res.status(429).json({ 
        message: `Too many failed attempts. Try again in ${remainingTime} minutes.`,
        code: 'RATE_LIMITED'
      });
    }
    
    // Reset if lockout period has passed
    if ((now - attempts.lastAttempt) >= LOCKOUT_DURATION) {
      failedAttempts.delete(clientIP);
    }
  }
  
  next();
};

// Function to record failed attempts
const recordFailedAttempt = (req) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (failedAttempts.has(clientIP)) {
    const attempts = failedAttempts.get(clientIP);
    attempts.count += 1;
    attempts.lastAttempt = now;
  } else {
    failedAttempts.set(clientIP, { count: 1, lastAttempt: now });
  }
};

// Function to clear failed attempts on successful login
const clearFailedAttempts = (req) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  failedAttempts.delete(clientIP);
};

module.exports = { 
  auth, 
  adminAuth, 
  rateLimitAuth, 
  recordFailedAttempt, 
  clearFailedAttempts 
};
