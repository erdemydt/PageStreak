// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Screens and components read and write data through db/repos/* (and
    // utils/services), never with raw SQL. See CLAUDE.md "Data model".
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db/db'],
              importNames: ['queryAll', 'queryFirst', 'execute', 'default'],
              message: 'Use a repository in db/repos/ instead of raw SQL in screens/components.',
            },
          ],
        },
      ],
    },
  },
]);
