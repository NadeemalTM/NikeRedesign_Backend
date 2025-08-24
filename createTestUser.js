const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const createTestUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nike-store', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'user1@nike.com' });
    
    if (existingUser) {
      console.log('Test user already exists:', {
        email: 'user1@nike.com',
        password: '123456'
      });
      process.exit(0);
    }

    // Create new test user
    const testUser = new User({
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      email: 'user1@nike.com',
      password: '123456',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      role: 'user'
    });

    await testUser.save();
    
    console.log('Test user created successfully!');
    console.log('User Credentials:');
    console.log('Email: user1@nike.com');
    console.log('Password: 123456');
    console.log('Role: user');

    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
};

createTestUser();
