// Simple test to verify admin user exists
const mongoose = require('mongoose');
const User = require('./models/User');

const testAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nike-store');
    
    const admin = await User.findOne({ email: 'admin@nike.com' });
    
    if (admin) {
      console.log('✅ Admin user exists:', {
        email: admin.email,
        role: admin.role,
        username: admin.username
      });
    } else {
      console.log('❌ Admin user not found. Run createAdmin.js when MongoDB is running.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

testAdmin();
