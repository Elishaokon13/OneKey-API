import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { terser } from '@rollup/plugin-terser';

const packageJson = require('./package.json');

const createConfig = (input, outputDir, external = []) => ({
  input,
  external: ['react', 'react-dom', ...external],
  output: [
    {
      file: `dist/${outputDir}/index.js`,
      format: 'cjs',
      sourcemap: true,
      exports: 'auto'
    },
    {
      file: `dist/${outputDir}/index.esm.js`,
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    peerDepsExternal(),
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declarationDir: `dist/${outputDir}`,
      rootDir: 'src'
    }),
    terser({
      compress: {
        drop_console: false,
        drop_debugger: true
      },
      format: {
        comments: false
      }
    })
  ]
});

export default [
  // Main bundle (everything)
  {
    input: 'src/index.ts',
    external: ['react', 'react-dom'],
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
        exports: 'auto'
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true
      }
    ],
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        rootDir: 'src'
      }),
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true
        },
        format: {
          comments: false
        }
      })
    ]
  },
  // Core bundle (no React)
  createConfig('src/core/index.ts', 'core'),
  // React bundle
  createConfig('src/react/index.ts', 'react', ['react', 'react-dom']),
  // Crypto bundle
  createConfig('src/crypto/index.ts', 'crypto')
]; 