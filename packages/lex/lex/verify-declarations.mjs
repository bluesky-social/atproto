import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { log } from 'node:console'
import {
  existsSync,
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
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const consumer = mkdtempSync(join(tmpdir(), 'lex-declarations-'))

/** @param {string} command @param {string[]} args @param {string} cwd */
function run(command, args, cwd) {
  log(`> ${command} ${args.join(' ')}`)
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}

/** @param {string} directory */
function pack(directory) {
  const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  assert(
    existsSync(join(directory, 'dist/index.d.ts')),
    `${pkg.name}: run the normal workspace build before verifying declarations`,
  )
  run('pnpm', ['pack', '--pack-destination', consumer], directory)
  const tarball = join(
    consumer,
    `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`,
  )
  assert(existsSync(tarball), `Missing packed artifact: ${tarball}`)
  return tarball
}

try {
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  )
  const cborTarball = pack(resolve(import.meta.dirname, '../lex-cbor'))
  const lexTarball = pack(import.meta.dirname)
  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      cborTarball,
      lexTarball,
      `@types/node@${rootPackage.devDependencies['@types/node']}`,
    ],
    consumer,
  )

  const lock = JSON.parse(
    readFileSync(join(consumer, 'package-lock.json'), 'utf8'),
  )
  for (const [name, tarball] of [
    ['@atproto/lex-cbor', cborTarball],
    ['@atproto/lex', lexTarball],
  ]) {
    const installed = lock.packages[`node_modules/${name}`]
    assert(
      installed?.resolved?.startsWith('file:'),
      `${name}: not a local tarball`,
    )
    assert.equal(resolve(consumer, installed.resolved.slice(5)), tarball)
    log(`${name}: package-lock resolves to ${installed.resolved}`)
  }
  const requireConsumer = createRequire(join(consumer, 'package.json'))
  const lexEntry = requireConsumer.resolve('@atproto/lex')
  const cborEntry = realpathSync(requireConsumer.resolve('@atproto/lex-cbor'))
  assert.equal(
    realpathSync(createRequire(lexEntry).resolve('@atproto/lex-cbor')),
    cborEntry,
    'The umbrella must resolve the candidate lex-cbor, not a registry copy',
  )
  log(`Umbrella and direct lex-cbor resolve to ${cborEntry}`)

  writeFileSync(
    join(consumer, 'consumer.ts'),
    `import assert from 'node:assert/strict'
import {
  Client, l, walk, cborEncode, cborDecode, cborDecodeAll,
  encodeOptions, decodeOptions,
} from '@atproto/lex'
import {
  encode, decode, decodeAll, cidForLex, type LexValue,
} from '@atproto/lex-cbor'

assert.equal(typeof Client, 'function')
const schema = l.object({ text: l.string(), count: l.integer() })
const parsed: { text: string; count: number } = schema.parse({ text: 'hello', count: 42 })
assert.deepEqual([...walk({ schema })], [schema])
const value: LexValue = parsed
const bytes: Uint8Array<ArrayBuffer> = encode(value)
const decoded: LexValue = decode(bytes)
const values: Generator<LexValue, void, unknown> = decodeAll(bytes)
assert.deepEqual(decoded, value)
assert.deepEqual([...values], [value])
assert.deepEqual(decode<typeof parsed>(bytes), parsed)
const encodeCopy: typeof encodeOptions = { ...encodeOptions }
const decodeCopy: typeof decodeOptions = { ...decodeOptions }
const float64: boolean | undefined = encodeCopy.float64
const strict: boolean | undefined = decodeCopy.strict
assert.equal(float64, true)
assert.equal(strict, true)
assert(Object.isFrozen(encodeOptions))
assert(Object.isFrozen(decodeOptions))
assert.equal(cborEncode, encode)
assert.equal(cborDecode, decode)
assert.equal(cborDecodeAll, decodeAll)
assert.deepEqual(cborDecode(cborEncode(value)), value)
assert.deepEqual([...cborDecodeAll(new Uint8Array([...bytes, ...bytes]))], [value, value])
const cid = await cidForLex(value)
const linked = decode<{ ref: typeof cid }>(encode({ ref: cid }))
assert.equal(linked.ref.toString(), cid.toString())
assert.equal((await cidForLex(decoded)).toString(), cid.toString())
console.log('Packed Lex declarations and CBOR/CID roundtrips passed')
`,
  )
  writeFileSync(
    join(consumer, 'tsconfig.json'),
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
        erasableSyntaxOnly: true,
      },
      files: ['consumer.ts'],
    }),
  )
  run(compiler, ['--version'], consumer)
  run(compiler, ['--project', join(consumer, 'tsconfig.json')], consumer)
  run(execPath, ['--experimental-strip-types', 'consumer.ts'], consumer)
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
