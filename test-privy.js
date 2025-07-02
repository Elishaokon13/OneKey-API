const express = require('express');
const app = express();

// Mock the Privy service status
app.get('/test/privy-status', (req, res) => {
  const privyHealth = {
    configured: false,
    initialized: false,
    appId: null
  };
  
  res.json({
    success: true,
    data: {
      service: 'Privy Authentication',
      status: privyHealth.configured && privyHealth.initialized ? 'operational' : 'unavailable',
      configured: privyHealth.configured,
      initialized: privyHealth.initialized,
      appId: privyHealth.appId,
      message: 'Privy integration architecture ready, awaiting SDK configuration'
    }
  });
});

app.listen(3002, () => {
  console.log('Privy test server running on port 3002');
});
