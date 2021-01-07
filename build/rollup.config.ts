import { join } from 'path';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

export default {
  input: join(__dirname, '../src/index.ts'),
  output: [
    {
      name: 'BoxDB',
      file: 'dist/bxd.js',
      format: 'umd',
      exports: 'default',
    },
    {
      name: 'BoxDB',
      file: 'dist/bxd.min.js',
      format: 'umd',
      exports: 'default',
      plugins: [terser()],
    },
    {
      file: 'dist/bxd.esm.js',
      format: 'esm',
    },
  ],
  plugins: [json(), commonjs(), typescript()],
};
