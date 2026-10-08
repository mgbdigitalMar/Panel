// Extends app.json. google-services.json (Firebase / FCM) is only wired in when
// present, so the app still builds without it — push just won't register on
// Android until it's added (see README › Probar notificaciones push).
const fs = require('fs');
const path = require('path');

const GOOGLE_SERVICES = './google-services.json';

module.exports = ({ config }) => {
  const hasGoogleServices = fs.existsSync(path.join(__dirname, GOOGLE_SERVICES));
  return {
    ...config,
    android: {
      ...config.android,
      ...(hasGoogleServices && { googleServicesFile: GOOGLE_SERVICES }),
    },
  };
};
