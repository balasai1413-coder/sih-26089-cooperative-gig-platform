import eslint from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/coverage/**',
      '**/next-env.d.ts',
    ],
  },
  eslint.configs.recommended,
  ...compat.extends('next/core-web-vitals'),
  {
    settings: {
      next: { rootDir: 'apps/web/' },
    },
    rules: {
      // This App Router-only starter has no legacy pages directory to inspect.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
);
