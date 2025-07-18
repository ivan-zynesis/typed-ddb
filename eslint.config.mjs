import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import jest from 'eslint-plugin-jest';

export default [
  js.configs.recommended,
  {
    ignores: ['eslint.config.mjs'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Stricter rules for unused imports and variables
      '@typescript-eslint/no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'ignoreRestSiblings': true 
      }],
      'no-unused-vars': 'off', // Turn off base rule as it can report incorrect errors
      
      // Import/export rules
      'no-duplicate-imports': 'error',
      
      // TypeScript specific rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off', // Allow ! in tests
      
      // General code quality rules
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',
      'eqeqeq': 'error',
      'curly': 'error',
      
      // Let TypeScript handle undefined variables instead of ESLint
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    plugins: {
      'jest': jest,
    },
    rules: {
      // Jest recommended rules
      ...jest.configs.recommended.rules,
      
      // More lenient rules for test files
      '@typescript-eslint/no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'ignoreRestSiblings': true 
      }],
      
      // Let TypeScript handle undefined variables instead of ESLint
      'no-undef': 'off',
    }
  }
];