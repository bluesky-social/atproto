import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { log } from 'node:console'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execPath } from 'node:process'

const root = resolve(import.meta.dirname, '../../..')
const compiler = join(root, 'node_modules/.bin/tsc')
const schemaPackage = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../lex-schema/package.json'),
    'utf8',
  ),
)
const consumer = mkdtempSync(join(tmpdir(), 'lex-declarations-'))

/** @param {string} command @param {string[]} args @param {string} cwd */
function run(command, args, cwd) {
  log(`> ${command} ${args.join(' ')}`)
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}

try {
  assert(
    existsSync(join(import.meta.dirname, 'dist/index.d.ts')),
    'Run the workspace codegen and Lex build before verifying declarations',
  )
  run('pnpm', ['pack', '--pack-destination', consumer], import.meta.dirname)
  const pkg = JSON.parse(
    readFileSync(join(import.meta.dirname, 'package.json'), 'utf8'),
  )
  const tarball = join(consumer, `atproto-lex-${pkg.version}.tgz`)
  assert(existsSync(tarball), `Missing packed artifact: ${tarball}`)

  // @NOTE the 0.3 umbrella must keep its original export surface and schema range.
  const schemaRange = `^${schemaPackage.version}`
  const versions = JSON.parse(
    execFileSync(
      'pnpm',
      ['view', `@atproto/lex-schema@${schemaRange}`, 'version', '--json'],
      { cwd: consumer, encoding: 'utf8' },
    ),
  )
  const latest = Array.isArray(versions) ? versions.at(-1) : versions
  assert.equal(typeof latest, 'string')

  for (const version of new Set([schemaPackage.version, latest])) {
    const directory = join(consumer, version)
    mkdirSync(directory)
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    )
    run(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        tarball,
        `@atproto/lex-schema@${version}`,
        '@types/node@22',
      ],
      directory,
    )

    const lock = JSON.parse(
      readFileSync(join(directory, 'package-lock.json'), 'utf8'),
    )
    assert.equal(
      lock.packages['node_modules/@atproto/lex-schema'].version,
      version,
    )
    const installed = lock.packages['node_modules/@atproto/lex']
    assert(
      installed?.resolved?.startsWith('file:'),
      'Lex must be a local tarball',
    )
    assert.equal(resolve(directory, installed.resolved.slice(5)), tarball)
    const installedPackage = JSON.parse(
      readFileSync(
        join(directory, 'node_modules/@atproto/lex/package.json'),
        'utf8',
      ),
    )
    assert.equal(
      installedPackage.dependencies['@atproto/lex-schema'],
      schemaRange,
    )
    assert(!('@atproto/lex-cbor' in installedPackage.dependencies))
    const requireConsumer = createRequire(join(directory, 'package.json'))
    const lexEntry = requireConsumer.resolve('@atproto/lex')
    const schemaEntry = requireConsumer.resolve('@atproto/lex-schema')
    assert.equal(
      realpathSync(createRequire(lexEntry).resolve('@atproto/lex-schema')),
      realpathSync(schemaEntry),
      'Lex must resolve the schema version under test, not a nested copy',
    )
    log(
      `Lex ${pkg.version}: ${installed.resolved}; schema ${version}: ${schemaEntry}`,
    )

    writeFileSync(
      join(directory, 'consumer.ts'),
      `import assert from 'node:assert/strict'
import { Client, l, walk, type Schema, type Procedure, type Query, type Subscription } from '@atproto/lex'

assert.equal(typeof Client, 'function')
const schema = l.object({ text: l.string() })
const parsed: { text: string } = schema.parse({ text: 'hello' })
assert.deepEqual(parsed, { text: 'hello' })
const ns = {
  main: schema,
  default: schema,
  alias: schema,
  $helper: l.string(),
  ignored: 42,
  nil: null,
  nested: { schema },
}
const result: Generator<Schema | Procedure | Subscription | Query> = walk(ns)
// @NOTE the 0.3 walk deduplicates within each namespace, not across child namespaces.
assert.deepEqual([...result], [schema, schema])
assert.deepEqual([...walk({ main: schema, default: schema, alias: schema })], [schema])
console.log('Packed Lex declarations and original walk behavior passed')
`,
    )
    writeFileSync(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2023',
          lib: ['ES2023', 'DOM', 'DOM.Iterable'],
          types: ['node'],
          skipLibCheck: false,
        },
        files: ['consumer.ts'],
      }),
    )
    run(compiler, ['--project', join(directory, 'tsconfig.json')], directory)
    run(execPath, ['--experimental-strip-types', 'consumer.ts'], directory)
  }
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
