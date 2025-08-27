const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const testLogin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nike-store', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Test admin login
    console.log('\nTesting admin login...');
    const admin = await User.findOne({ email: 'admin@nike.com' }).select('+password');
    if (admin) {
      console.log('Admin found:', admin.email);
      const isMatch = await admin.comparePassword('123456');
      console.log('Password match:', isMatch);
    } else {
      console.log('Admin not found');
    }

    // Test user login
    console.log('\nTesting user login...');
    const user = await User.findOne({ email: 'user1@nike.com' }).select('+password');
    if (user) {
      console.log('User found:', user.email);
      const isMatch = await user.comparePassword('123456');
      console.log('Password match:', isMatch);
    } else {
      console.log('User not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error testing login:', error);
    process.exit(1);
  }
};

testLogin();
