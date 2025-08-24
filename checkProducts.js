const mongoose = require('mongoose');
const Product = require('./models/Product');

async function checkProducts() {
  try {
    await mongoose.connect('mongodb://localhost:27017/nike-shop');
    console.log('Connected to MongoDB');
    
    const products = await Product.find({});
    console.log('Products in database:');
    
    if (products.length === 0) {
      console.log('No products found in database');
    } else {
      products.forEach(p => {
        console.log(`ID: ${p._id}, Name: ${p.name}, Image: ${p.image}`);
      });
    }
    
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkProducts();
