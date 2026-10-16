// Simple initialization script for website settings
const http = require('http');

const data = JSON.stringify({});

const options = {
  hostname: 'localhost',
  port: 10000,
  path: '/api/website-settings/initialize',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
    try {
      const result = JSON.parse(responseData);
      console.log('Settings initialized:', result);
    } catch (error) {
      console.log('Response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(data);
req.end();
