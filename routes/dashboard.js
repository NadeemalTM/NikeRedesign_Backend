const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const Contact = require('../models/Contact');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth, adminAuth } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadsDir = 'uploads/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Enhanced file validation
const validateFile = (file) => {
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'jpeg,jpg,png,gif,webp').split(',');
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5242880; // 5MB default
  
  // Check file size
  if (file.size > maxSize) {
    throw new Error(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
  }
  
  // Check file type
  const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
  if (!allowedTypes.includes(fileExtension)) {
    throw new Error(`File type .${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }
  
  // Check MIME type
  const allowedMimeTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 
    'image/gif', 'image/webp'
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`MIME type ${file.mimetype} is not allowed`);
  }
  
  return true;
};

// Sanitize filename
const sanitizeFilename = (filename) => {
  // Remove potentially dangerous characters
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
};

// Configure multer for file uploads with enhanced security
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    try {
      validateFile(file);
      const sanitizedName = sanitizeFilename(file.originalname);
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + sanitizedName;
      cb(null, uniqueName);
    } catch (error) {
      cb(error);
    }
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB default
    files: 5 // Maximum 5 files per request
  },
  fileFilter: function (req, file, cb) {
    try {
      validateFile(file);
      cb(null, true);
    } catch (error) {
      cb(error, false);
    }
  }
});

router.get('/stats', auth, adminAuth, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const newProducts = await Product.countDocuments({ category: 'new' });
    const activeProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({ stock: { $lt: 5 } });
    
    res.json({
      totalProducts,
      newProducts,
      activeProducts,
      lowStockProducts
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch dashboard statistics',
      code: 'STATS_ERROR'
    });
  }
});

router.get('/users', auth, adminAuth, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ users });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all products for dashboard
router.get('/products', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '' } = req.query;
    
    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.category = category;
    
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Product.countDocuments(query);
    
    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new product
router.post('/products', auth, upload.array('images', 5), async (req, res) => {
  try {
    const productData = {
      ...req.body,
      images: req.files ? req.files.map(file => `/uploads/${file.filename}`) : []
    };
    
    const product = new Product(productData);
    const savedProduct = await product.save();
    
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update product
router.put('/products/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete product
router.delete('/products/:id', auth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk update products
router.put('/products/bulk/update', auth, async (req, res) => {
  try {
    const { ids, updates } = req.body;
    
    const result = await Product.updateMany(
      { _id: { $in: ids } },
      { $set: updates }
    );
    
    res.json({ 
      message: `${result.modifiedCount} products updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get new items for ShopPage
router.get('/new-items', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const newItems = await Product.find({ 
      category: 'new', 
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));
    
    res.json(newItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all contact messages for admin dashboard
router.get('/contacts', auth, adminAuth, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ contacts });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
