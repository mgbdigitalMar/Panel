// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // `@shared/*` is resolved by metro.config.js to ../shared (code shared with the web).
      'import/no-unresolved': ['error', { ignore: ['^@shared/'] }],
    },
  },
]);
