const mongoose = require('mongoose');
const dns = require('dns').promises;

async function testConnection() {
  console.log('🔍 MongoDB Atlas Connection Troubleshooting');
  console.log('============================================');
  
  // Test DNS resolution
  try {
    console.log('1. Testing DNS resolution...');
    const result = await dns.resolveSrv('_mongodb._tcp.cluster0.q4epp1p.mongodb.net');
    console.log('✅ DNS resolution successful:', result);
  } catch (dnsError) {
    console.log('❌ DNS resolution failed:', dnsError.message);
    console.log('💡 This is likely a DNS or network issue');
  }
  
  // Test direct connection
  const connectionStrings = [
    'mongodb+srv://gayanthanadeemal:sltb@cluster0.q4epp1p.mongodb.net/nike-shop?retryWrites=true&w=majority&appName=Cluster0',
    'mongodb://gayanthanadeemal:sltb@cluster0.q4epp1p.mongodb.net:27017/nike-shop?retryWrites=true&w=majority&appName=Cluster0'
  ];
  
  for (const uri of connectionStrings) {
    console.log(`\n2. Testing connection: ${uri.replace(/:([^:@]+)@/, ':****@')}`);
    try {
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000
      });
      console.log('✅ Connection successful!');
      await mongoose.connection.close();
      break;
    } catch (error) {
      console.log('❌ Connection failed:', error.message);
    }
  }
  
  console.log('\n3. Troubleshooting steps:');
  console.log('   • Check your internet connection');
  console.log('   • Verify MongoDB Atlas cluster is running');
  console.log('   • Check if your IP is whitelisted in MongoDB Atlas');
  console.log('   • Try using a different network (mobile hotspot)');
  console.log('   • Check firewall/antivirus settings');
}

testConnection().catch(console.error);
