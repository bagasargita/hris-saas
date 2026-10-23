import { baseConfig } from '@saas/config/eslint';

export default [
  { ignores: ['dist/**', 'src/generated/**', 'coverage/**'] },
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    rules: {
      // Type-only imports would erase the constructor parameter types Nest's DI reads via emitDecoratorMetadata.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    // Supertest response bodies are typed `any`; tests assert their shape at runtime instead.
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    // Jest config and global setup are loaded by Jest as CommonJS.
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['prisma/seed.ts'],
    rules: { 'no-console': 'off' },
  },
];
