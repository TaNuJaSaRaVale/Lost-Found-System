// Extends app.json. google-services.json (downloaded from the Firebase console) is what lets
// Android receive push notifications; the app still builds without it, just with no notifications.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
