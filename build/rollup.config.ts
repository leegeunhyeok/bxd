import { join } from 'path';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import dts from 'rollup-plugin-dts';

const plugins = [
  json(),
  resolve({
    browser: true,
  }),
  commonjs(),
  typescript(),
];

export default [
  {
    input: join(__dirname, '../src/index.es.ts'),
    output: [
      {
        file: 'dist/bxd.esm.js',
        format: 'esm',
      },
    ],
    plugins,
  },
  {
    input: join(__dirname, '../src/index.ts'),
    output: [
      {
        name: 'BoxDB',
        file: 'dist/bxd.js',
        format: 'umd',
      },
      {
        name: 'BoxDB',
        file: 'dist/bxd.min.js',
        format: 'umd',
        plugins: [terser()],
      },
    ],
    plugins: [
      ...plugins,
      babel({
        babelHelpers: 'bundled',
        presets: [
          [
            '@babel/preset-env',
            {
              targets: '> 0.5%, ie >= 11',
              modules: false,
              spec: true,
              useBuiltIns: 'usage',
              forceAllTransforms: true,
              corejs: {
                version: 3,
                proposals: false,
              },
            },
          ],
          '@babel/preset-typescript',
        ],
      }),
    ],
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'types/index.d.ts', format: 'es' }],
    plugins: [dts()],
  },
];
