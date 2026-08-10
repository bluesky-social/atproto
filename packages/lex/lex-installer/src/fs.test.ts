import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readJsonFile, writeJsonFile } from './fs.js'

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
