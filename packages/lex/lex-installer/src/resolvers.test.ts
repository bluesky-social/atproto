import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildFilter } from '@atproto/lex-builder'
import { NSID } from '@atproto/syntax'
import { writeJsonFile } from './fs.js'
import {
  DirectoryResolver,
  createResolvers,
  readLexiconFile,
} from './resolvers.js'

/** Writes a minimal (ref-free) lexicon document at its NSID-derived path. */
async function writeLexicon(
  dir: string,
  id: string,
  declaredId = id,
): Promise<string> {
  const path = `${join(dir, ...id.split('.'))}.json`
  await writeJsonFile(path, {
    lexicon: 1,
    id: declaredId,
    defs: { main: { type: 'procedure', description: id } },
  })
  return path
}

describe('readLexiconFile', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lex-installer-resolvers-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reads, parses, and computes an absolute path + cid', async () => {
    const path = await writeLexicon(dir, 'com.example.foo')
    const resolved = await readLexiconFile(path)

    expect(resolved.lexicon.id).toBe('com.example.foo')
    expect(resolved.uri.startsWith('file://')).toBe(true)
    expect(isAbsolute(resolved.uri.slice('file://'.length))).toBe(true)
    expect(resolved.cid.toString()).toMatch(/^baf/)
  })
})

describe('DirectoryResolver', () => {
  let tmpDir: string
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'lex-installer-resolvers-'))
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('resolves an NSID from its directory layout', async () => {
    await writeLexicon(tmpDir, 'com.example.foo')
    const resolver = new DirectoryResolver(tmpDir, buildFilter({}))

    const resolved = await resolver.resolve(NSID.from('com.example.foo'))
    expect(resolved?.lexicon.id).toBe('com.example.foo')
  })

  it('returns null on a miss (ENOENT)', async () => {
    const resolver = new DirectoryResolver(tmpDir, buildFilter({}))
    expect(await resolver.resolve(NSID.from('com.example.missing'))).toBeNull()
  })

  it('returns null when the file declares a different id', async () => {
    await writeLexicon(tmpDir, 'com.example.bar', 'com.example.other')
    const resolver = new DirectoryResolver(tmpDir, buildFilter({}))
    expect(await resolver.resolve(NSID.from('com.example.bar'))).toBeNull()
  })

  it('honors an include filter', async () => {
    await writeLexicon(tmpDir, 'com.example.foo')
    await writeLexicon(tmpDir, 'com.example.bar')
    const resolver = new DirectoryResolver(
      tmpDir,
      buildFilter({ include: ['com.example.foo'] }),
    )

    expect(await resolver.resolve(NSID.from('com.example.foo'))).not.toBeNull()
    // Present on disk, but excluded by the filter.
    expect(await resolver.resolve(NSID.from('com.example.bar'))).toBeNull()
  })

  it('honors an exclude filter', async () => {
    await writeLexicon(tmpDir, 'com.example.bar')
    const resolver = new DirectoryResolver(
      tmpDir,
      buildFilter({ exclude: ['com.example.bar'] }),
    )
    expect(await resolver.resolve(NSID.from('com.example.bar'))).toBeNull()
  })
})

describe('createResolvers', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lex-installer-resolvers-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns an empty list for undefined/empty config', () => {
    expect(createResolvers(undefined, dir)).toEqual([])
    expect(createResolvers([], dir)).toEqual([])
  })

  it('builds a DirectoryResolver whose path is relative to baseDir', async () => {
    const sub = join(dir, 'nested')
    await writeLexicon(sub, 'com.example.foo')

    const [resolver] = createResolvers(
      [{ type: 'directory', path: './nested' }],
      dir,
    )
    expect(resolver).toBeInstanceOf(DirectoryResolver)

    const resolved = await resolver!.resolve(NSID.from('com.example.foo'))
    expect(resolved?.lexicon.id).toBe('com.example.foo')
  })

  it('throws on an unsupported resolver type', () => {
    expect(() => createResolvers([{ type: 'repo' } as never], dir)).toThrow(
      /Unsupported lexicon resolver type: repo/,
    )
  })
})
