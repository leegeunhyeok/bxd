import { join } from 'path';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: join(__dirname, '../src/index.ts'),
  output: {
    name: 'name',
    exports: 'auto',
  },
  plugins: [json(), commonjs(), typescript()],
};
