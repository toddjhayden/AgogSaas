module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  root: true,
  env: {
    browser: true,
    es2020: true,
  },
  ignorePatterns: ['.eslintrc.cjs', 'dist', 'node_modules', 'vite.config.ts'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Type safety rules - enforced as errors
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-require-imports': 'error',
    '@typescript-eslint/no-empty-object-type': 'error',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    'prefer-const': 'error',

    // React rules
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Disable React Compiler rules - too strict for existing code
    'react-hooks/purity': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/incompatible-library': 'off',
  },
};
