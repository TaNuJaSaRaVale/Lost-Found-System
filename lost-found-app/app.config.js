// Extends app.json. google-services.json (downloaded from the Firebase console) is what lets
// Android receive push notifications; the app still builds without it, just with no notifications.
// It is not committed: locally it sits next to this file, and EAS builds get it from the
// GOOGLE_SERVICES_JSON file environment variable.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ??
    (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : null);
  if (googleServicesFile) {
    config.android = { ...config.android, googleServicesFile };
  }
  return config;
};
