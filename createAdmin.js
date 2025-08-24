const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nike-store', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@nike.com' });
    
    if (existingAdmin) {
      console.log('Admin already exists:', {
        email: 'admin@nike.com',
        password: 'admin123'
      });
      process.exit(0);
    }

    // Create new admin user
    const adminUser = new User({
      username: 'admin',
      email: 'admin@nike.com',
      password: 'admin123',
      role: 'admin'
    });

    await adminUser.save();
    
    console.log('Admin user created successfully!');
    console.log('Admin Credentials:');
    console.log('Email: admin@nike.com');
    console.log('Password: admin123');
    console.log('Role: admin');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();
