const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');

dotenv.config();

const setupDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nike-shop');
    console.log('Connected to MongoDB');

    // Check if database is empty
    const productCount = await Product.countDocuments();
    const userCount = await User.countDocuments();

    console.log(`Found ${productCount} products and ${userCount} users`);

    if (productCount === 0) {
      console.log('Database is empty. You can add sample data using:');
      console.log('1. Admin dashboard at /admin');
      console.log('2. API endpoints at /api/products');
    }

    console.log('Database setup complete!');
  } catch (error) {
    console.error('Database setup error:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
