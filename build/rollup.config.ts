import { join } from 'path';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import dts from 'rollup-plugin-dts';
import analyze from 'rollup-plugin-analyzer';

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
        format: 'iife',
      },
      {
        name: 'BoxDB',
        file: 'dist/bxd.min.js',
        format: 'iife',
        plugins: [
          terser({
            output: {
              comments: false,
            },
          }),
        ],
      },
    ],
    plugins: [
      ...plugins,
      babel({
        babelHelpers: 'bundled',
        presets: ['@babel/preset-typescript'],
        exclude: [/\/core-js\//],
      }),
      analyze({
        summaryOnly: true,
      }),
    ],
  },
  {
    input: 'src/index.es.ts',
    output: [{ file: 'types/index.d.ts', format: 'es' }],
    plugins: [dts()],
  },
];
