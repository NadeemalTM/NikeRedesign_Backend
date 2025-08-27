const axios = require('axios');

const testAuthEndpoint = async () => {
  try {
    const API_URL = 'http://localhost:5000/api/auth/login';
    
    console.log('Testing admin login...');
    const adminResponse = await axios.post(API_URL, {
      email: 'admin@nike.com',
      password: 'admin123'
    }, {
      timeout: 5000
    });
    
    console.log('Admin login successful:', adminResponse.data);
    
    console.log('\nTesting user login...');
    const userResponse = await axios.post(API_URL, {
      email: 'user1@nike.com',
      password: '123456'
    }, {
      timeout: 5000
    });
    
    console.log('User login successful:', userResponse.data);
    
  } catch (error) {
    if (error.response) {
      console.error('Server responded with error:', error.response.status);
      console.error('Error message:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server. Is the backend running?');
      console.error('Error:', error.message);
    } else {
      console.error('Error setting up request:', error.message);
    }
  }
};

testAuthEndpoint();
