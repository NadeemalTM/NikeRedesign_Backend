const mongoose = require('mongoose');
require('dotenv').config();

console.log('🔍 MongoDB Connection Troubleshooter');
console.log('=====================================');

// Check environment variables
console.log('📋 Environment Check:');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');

// Test connection with detailed logging
const testConnection = async () => {
  try {
    console.log('\n🔄 Testing MongoDB Atlas connection...');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Successfully connected to MongoDB Atlas!');
    console.log('📊 Database:', conn.connection.name);
    console.log('🌐 Host:', conn.connection.host);
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected successfully');
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    
    if (error.message.includes('whitelist')) {
      console.error('\n🔧 SOLUTION: Add your IP to MongoDB Atlas whitelist');
      console.error('1. Go to https://cloud.mongodb.com');
      console.error('2. Navigate to your cluster → Network Access');
      console.error('3. Click "Add IP Address"');
      console.error('4. Choose "Allow access from anywhere" (0.0.0.0/0) for testing');
      console.error('   OR add your specific IP address');
    }
    
    if (error.message.includes('authentication')) {
      console.error('\n🔧 SOLUTION: Check your username/password');
      console.error('1. Verify your MongoDB Atlas username and password');
      console.error('2. Ensure special characters in password are URL encoded');
    }
  }
};

testConnection();
