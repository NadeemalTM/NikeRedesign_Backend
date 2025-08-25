const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const contactRoutes = require('./routes/contacts'); // Import contacts route

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/contacts', contactRoutes); // Use contacts route

// MongoDB connection with DNS error handling
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nike-shop';

console.log('Attempting to connect to MongoDB...');
console.log('Connection string:', mongoURI.replace(/:([^:@]+)@/, ':****@')); // Hide password in logs

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000, // 10 second timeout
  socketTimeoutMS: 45000, // 45 second timeout
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log('📊 Database:', mongoose.connection.name);
  console.log('🌐 Host:', mongoose.connection.host);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.error('🔍 Error code:', err.code);
  
  if (err.code === 'ENOTFOUND') {
    console.error('💡 DNS Resolution Error - Please check:');
    console.error('   1. Your internet connection');
    console.error('   2. The connection string format');
    console.error('   3. Your cluster name in MongoDB Atlas');
    console.error('   4. Try using direct connection instead');
  }
  
  // Don't exit on connection error in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('⚠️  Continuing with local fallback...');
    // Fallback to local MongoDB
    mongoose.connect('mongodb://localhost:27017/nike-shop', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log('✅ Connected to local MongoDB as fallback');
    })
    .catch(localErr => {
      console.error('❌ Local MongoDB also failed:', localErr.message);
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
