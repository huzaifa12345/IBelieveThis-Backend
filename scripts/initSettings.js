import fetch from 'node-fetch';

const initializeSettings = async () => {
  try {
    const response = await fetch('http://localhost:10000/api/website-settings/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('Settings initialized:', result);
  } catch (error) {
    console.error('Error initializing settings:', error);
  }
};

initializeSettings();
