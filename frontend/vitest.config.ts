import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Keep DOM test processes bounded on fresh/demo laptops as the suite grows.
    maxWorkers: 2,
    restoreMocks: true,
    clearMocks: true,
  },
}));
