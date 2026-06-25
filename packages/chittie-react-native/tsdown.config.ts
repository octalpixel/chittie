import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // RN-only runtime deps — never bundle them into the JS output.
  external: ['react', 'react-native', 'react-native-nitro-modules', '@angadie/chittie-text'],
});
