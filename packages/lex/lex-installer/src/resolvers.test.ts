import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NSID } from '@atproto/syntax'
import { writeJsonFile } from './fs.js'
import { readLexiconDocument } from './lexicon-document.js'
import type { CreateResolversOptions } from './resolvers.js'
import {
  DirectoryResolver,
  FilteredResolver,
  createResolver,
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

describe('readLexiconDocument', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lex-installer-resolvers-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reads and parses a lexicon document', async () => {
    const path = await writeLexicon(dir, 'com.example.foo')
    const lexicon = await readLexiconDocument(path)

    expect(lexicon?.id).toBe('com.example.foo')
  })

  it('returns null on a missing file (ENOENT)', async () => {
    expect(
      await readLexiconDocument(join(dir, 'does-not-exist.json')),
    ).toBeNull()
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
    const resolver = new DirectoryResolver(tmpDir)

    const resolved = await resolver.resolve(NSID.from('com.example.foo'))
    expect(resolved?.lexicon.id).toBe('com.example.foo')
    expect(String(resolved?.uri).startsWith('file://')).toBe(true)
  })

  it('returns null on a miss (ENOENT)', async () => {
    const resolver = new DirectoryResolver(tmpDir)
    expect(await resolver.resolve(NSID.from('com.example.missing'))).toBeNull()
  })

  it('returns the file content as-is; id validation happens at install time', async () => {
    // The resolver maps NSID → path and returns whatever document lives there.
    // The expected-vs-declared id check is enforced downstream (addDocument).
    await writeLexicon(tmpDir, 'com.example.bar', 'com.example.other')
    const resolver = new DirectoryResolver(tmpDir)
    const resolved = await resolver.resolve(NSID.from('com.example.bar'))
    expect(resolved?.lexicon.id).toBe('com.example.other')
  })

  it('honors an include filter (via FilteredResolver)', async () => {
    await writeLexicon(tmpDir, 'com.example.foo')
    await writeLexicon(tmpDir, 'com.example.bar')
    const resolver = FilteredResolver.for(new DirectoryResolver(tmpDir), {
      include: ['com.example.foo'],
    })

    expect(await resolver.resolve(NSID.from('com.example.foo'))).not.toBeNull()
    // Present on disk, but excluded by the filter.
    expect(await resolver.resolve(NSID.from('com.example.bar'))).toBeNull()
  })

  it('honors an exclude filter (via FilteredResolver)', async () => {
    await writeLexicon(tmpDir, 'com.example.bar')
    const resolver = FilteredResolver.for(new DirectoryResolver(tmpDir), {
      exclude: ['com.example.bar'],
    })
    expect(await resolver.resolve(NSID.from('com.example.bar'))).toBeNull()
  })

  it('returns the bare resolver when no include/exclude is given', () => {
    const inner = new DirectoryResolver(tmpDir)
    expect(FilteredResolver.for(inner)).toBe(inner)
  })
})

describe('createResolver', () => {
  let dir: string
  function options(): CreateResolversOptions {
    return { manifest: join(dir, 'lexicons.json') }
  }
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lex-installer-resolvers-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('builds a directory resolver whose path is relative to the manifest dir', async () => {
    await writeLexicon(join(dir, 'nested'), 'com.example.foo')

    const resolver = createResolver(options(), [
      { type: 'directory', path: './nested' },
    ])

    const resolved = await resolver.resolve(NSID.from('com.example.foo'))
    expect(resolved?.lexicon.id).toBe('com.example.foo')
  })

  it('throws on an unsupported resolver type', () => {
    expect(() =>
      createResolver(options(), [{ type: 'bogus' } as never]),
    ).toThrow(/Unsupported lexicon resolver type: bogus/)
  })
})
