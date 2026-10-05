import {
  lstat,
  mkdtemp,
  readFile,
  readlink,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readJsonFile, symlinkLexicon, writeJsonFile } from './fs.js'

describe('writeJsonFile', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lex-installer-fs-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('writes pretty-printed JSON with a trailing newline (issue #5232)', async () => {
    const path = join(dir, 'lexicons.json')
    await writeJsonFile(path, { version: 1, lexicons: ['com.example.foo'] })

    const contents = await readFile(path, 'utf8')
    expect(contents.endsWith('\n')).toBe(true)
    // exactly one trailing newline, and the body is 2-space indented
    expect(contents).toBe(
      JSON.stringify({ version: 1, lexicons: ['com.example.foo'] }, null, 2) +
        '\n',
    )
  })

  it('creates missing parent directories', async () => {
    const path = join(dir, 'nested', 'deep', 'lexicons.json')
    await writeJsonFile(path, { ok: true })
    expect(await readJsonFile(path)).toEqual({ ok: true })
  })

  it('round-trips through readJsonFile despite the trailing newline', async () => {
    const path = join(dir, 'manifest.json')
    const data = {
      version: 1,
      resolutions: { 'com.example.foo': { cid: 'bafyabc' } },
    }
    await writeJsonFile(path, data)
    expect(await readJsonFile(path)).toEqual(data)
  })
})

describe('symlinkLexicon', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lex-installer-fs-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('creates a relative symlink pointing at the source, making parents', async () => {
    const source = join(dir, 'post.json')
    await writeFile(source, '{"ok":true}')
    const dest = join(dir, 'out', 'app', 'bsky', 'feed', 'post.json')

    await symlinkLexicon(dest, source)

    const stat = await lstat(dest)
    expect(stat.isSymbolicLink()).toBe(true)
    // Stored relative, not absolute, for portability.
    expect(isAbsolute(await readlink(dest))).toBe(false)
    // Resolves back to the source contents.
    expect(await readFile(dest, 'utf8')).toBe('{"ok":true}')
  })

  it('replaces an existing file at the destination (idempotent re-install)', async () => {
    const source = join(dir, 'source.json')
    await writeFile(source, '{"v":2}')
    const dest = join(dir, 'dest.json')
    await writeFile(dest, 'stale copy')

    await symlinkLexicon(dest, source)

    expect((await lstat(dest)).isSymbolicLink()).toBe(true)
    expect(await readFile(dest, 'utf8')).toBe('{"v":2}')
  })

  it('leaves the file in place when source and destination resolve equal', async () => {
    const source = join(dir, 'same.json')
    await writeFile(source, '{"same":true}')

    // Pass a non-normalized path that resolves to the same absolute path.
    await symlinkLexicon(join(dir, 'sub', '..', 'same.json'), source)

    const stat = await lstat(source)
    expect(stat.isSymbolicLink()).toBe(false)
    expect(stat.isFile()).toBe(true)
    expect(await readFile(source, 'utf8')).toBe('{"same":true}')
    expect(resolve(join(dir, 'sub', '..', 'same.json'))).toBe(resolve(source))
  })
})
