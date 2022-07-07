require('esbuild')
  .build({
    logLevel: 'info',
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'dist/index.js',
    platform: 'node',
    external: [
      '../../node_modules/knex/*',
      '../../node_modules/@vscode/sqlite3/*',
      '../../node_modules/level/*',
      '../../node_modules/classic-level/*',
    ],
  })
  .catch(() => process.exit(1))
