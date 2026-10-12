import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NSID } from '@atproto/syntax'
import type { Fetch } from '@atproto-labs/fetch-node'
import { writeJsonFile } from './fs.js'
import { readLexiconDocument } from './lexicon-document.js'
import type { CreateResolversOptions } from './resolvers.js'
import {
  DirectoryResolver,
  FilteredResolver,
  HttpResolver,
  LexiconResolver,
} from './resolvers.js'

/** A minimal (ref-free) lexicon document for the given NSID. */
function lexiconDoc(id: string) {
  return {
    lexicon: 1,
    id,
    defs: { main: { type: 'procedure', description: id } },
  }
}

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

describe('HttpResolver', () => {
  it('fetches <base>/<segments>.json and returns the url as uri', async () => {
    const fetch = vi.fn<Fetch>(async () =>
      Response.json(lexiconDoc('app.bsky.unspecced.defs')),
    )
    const resolver = new HttpResolver('https://example.com/lexicons/', fetch)

    const resolved = await resolver.resolve(
      NSID.from('app.bsky.unspecced.defs'),
    )
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/lexicons/app/bsky/unspecced/defs.json',
      { redirect: 'error' },
    )
    expect(resolved?.lexicon.id).toBe('app.bsky.unspecced.defs')
    expect(resolved?.uri).toBe(
      'https://example.com/lexicons/app/bsky/unspecced/defs.json',
    )
  })

  it('tolerates a base without a trailing slash', async () => {
    const fetch = vi.fn<Fetch>(async () =>
      Response.json(lexiconDoc('com.example.foo')),
    )
    const resolver = new HttpResolver('https://example.com/lexicons', fetch)

    await resolver.resolve(NSID.from('com.example.foo'))
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/lexicons/com/example/foo.json',
      { redirect: 'error' },
    )
  })

  it('returns null on a 404 (falls through to the next resolver)', async () => {
    const fetch = vi.fn<Fetch>(async () => new Response(null, { status: 404 }))
    const resolver = new HttpResolver('https://example.com/', fetch)

    expect(await resolver.resolve(NSID.from('com.example.foo'))).toBeNull()
  })

  it('throws on a non-404 error status', async () => {
    const fetch = vi.fn<Fetch>(
      async () => new Response('oops', { status: 500 }),
    )
    const resolver = new HttpResolver('https://example.com/', fetch)

    await expect(
      resolver.resolve(NSID.from('com.example.foo')),
    ).rejects.toThrow(/HTTP 500/)
  })
})

describe(LexiconResolver, () => {
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

    const resolver = new LexiconResolver(options(), [
      { type: 'directory', path: './nested' },
    ])

    const resolved = await resolver.resolve(NSID.from('com.example.foo'))
    expect(resolved?.lexicon.id).toBe('com.example.foo')
  })

  it('builds an http resolver and routes the shared fetch through it', async () => {
    const fetch = vi.fn<Fetch>(async () =>
      Response.json(lexiconDoc('app.bsky.internal.foo')),
    )

    const resolver = new LexiconResolver({ ...options(), fetch }, [
      {
        type: 'http',
        base: 'https://example.com/lexicons/',
        include: ['app.bsky.internal.*'],
      },
    ])

    const resolved = await resolver.resolve(NSID.from('app.bsky.internal.foo'))
    expect(resolved?.lexicon.id).toBe('app.bsky.internal.foo')
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/lexicons/app/bsky/internal/foo.json',
      { redirect: 'error' },
    )
  })

  it('throws on an unsupported resolver type', () => {
    expect(
      () => new LexiconResolver(options(), [{ type: 'bogus' } as never]),
    ).toThrow(/Unsupported lexicon resolver type: bogus/)
  })
})
