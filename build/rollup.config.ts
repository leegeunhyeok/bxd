import { join } from 'path';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import dts from 'rollup-plugin-dts';

export default [
  {
    input: join(__dirname, '../src/index.ts'),
    output: [
      {
        name: 'BoxDB',
        file: 'dist/bxd.js',
        format: 'umd',
        exports: 'named',
      },
      {
        name: 'BoxDB',
        file: 'dist/bxd.min.js',
        format: 'umd',
        exports: 'named',
        plugins: [terser()],
      },
      {
        file: 'dist/bxd.esm.js',
        format: 'esm',
      },
    ],
    plugins: [json(), commonjs(), typescript()],
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'types/index.d.ts', format: 'es' }],
    plugins: [dts()],
  },
];
