import { lstat, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lexiconDocumentSchema } from '@atproto/lex-document'
import type { LexResolverHooks } from '@atproto/lex-resolver'
import type { DidString } from '@atproto/lex-schema'
import { AtUri, NSID } from '@atproto/syntax'
import { writeJsonFile } from './fs.js'
import { LexInstaller } from './lex-installer.js'
import type { InstallResult, LexInstallerOptions } from './lex-installer.js'
import type { LexiconsManifest } from './lexicons-manifest.js'
import { readLexiconFile } from './resolvers.js'

/** The DID type `onResolveAuthority` must return (branded `did:${string}`). */
type HookDid = Exclude<
  Awaited<ReturnType<NonNullable<LexResolverHooks['onResolveAuthority']>>>,
  void
>

/**
 * Test subclass: exposes the protected parsing/install seams and replaces the
 * network leg so no real DNS or repo fetch happens. `onResolveAuthority`
 * short-circuits authority resolution; `installFromDid` is overridden to record
 * the NSID and install a synthetic, ref-free document.
 */
class TestInstaller extends LexInstaller {
  public readonly networkNsids: string[] = []

  parse(addition: string) {
    return this.parseAddition(addition)
  }

  installResolved(
    nsid: NSID,
    source: Awaited<ReturnType<typeof readLexiconFile>>,
  ) {
    return this.installFromResolved(nsid, source)
  }

  get resolutions() {
    return this.workingManifest.resolutions
  }

  protected override async installFromDid(
    _did: DidString,
    nsid: NSID,
  ): Promise<InstallResult> {
    const id = nsid.toString()
    this.networkNsids.push(id)
    const lexicon = lexiconDocumentSchema.parse({
      lexicon: 1,
      id,
      defs: { main: { type: 'procedure', description: 'network stub' } },
    })
    this.documents.set(nsid, lexicon)
    const uri = AtUri.make('did:plc:fake', 'com.atproto.lexicon.schema', id)
    this.workingManifest.resolutions[id] = {
      uri: uri.toString(),
      cid: 'bafnetwork',
    }
    return { lexicon, uri }
  }
}

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

describe('LexInstaller', () => {
  let dir: string

  function makeInstaller(
    overrides: Partial<LexInstallerOptions> = {},
    manifest?: LexiconsManifest,
  ) {
    return new TestInstaller(
      {
        lexicons: join(dir, 'out'),
        manifest: join(dir, 'lexicons.json'),
        hooks: {
          onResolveAuthority: (): HookDid => 'did:plc:fake' as HookDid,
        },
        ...overrides,
      },
      manifest,
    )
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lex-installer-'))
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(dir, { recursive: true, force: true })
  })

  describe('parseAddition', () => {
    it('routes an at:// URI to a network source', async () => {
      await using installer = makeInstaller()
      const { nsid, source } = await installer.parse(
        'at://did:plc:xxx/com.atproto.lexicon.schema/com.example.foo',
      )
      expect(nsid.toString()).toBe('com.example.foo')
      expect(source).toEqual({ kind: 'uri', uri: expect.any(AtUri) })
    })

    it('routes a bare NSID to no source (resolver chain + network)', async () => {
      await using installer = makeInstaller()
      const { nsid, source } = await installer.parse('com.example.foo')
      expect(nsid.toString()).toBe('com.example.foo')
      expect(source).toBeNull()
    })

    it('routes a path (contains a slash) to a local file source', async () => {
      const path = await writeLexicon(dir, 'com.example.foo')
      await using installer = makeInstaller()
      const { nsid, source } = await installer.parse(path)
      expect(nsid.toString()).toBe('com.example.foo')
      expect(source).toMatchObject({ kind: 'resolved' })
    })

    it('routes a file:// URI to a local file source', async () => {
      const path = await writeLexicon(dir, 'com.example.foo')
      await using installer = makeInstaller()
      const { nsid, source } = await installer.parse(`file://${path}`)
      expect(nsid.toString()).toBe('com.example.foo')
      expect(source).toMatchObject({ kind: 'resolved' })
    })

    it('percent-decodes an RFC 8089 file:// URI back to the real path', async () => {
      // A genuine file URL (e.g. from `pathToFileURL`) percent-encodes special
      // characters; the installer must decode them, not read the literal path.
      const spaced = join(dir, 'with space')
      const path = await writeLexicon(spaced, 'com.example.foo')
      const href = pathToFileURL(path).href
      // Sanity: the space is actually encoded, so a naive slice would ENOENT.
      expect(href).toContain('%20')

      await using installer = makeInstaller()
      const { nsid, source } = await installer.parse(href)
      expect(nsid.toString()).toBe('com.example.foo')
      expect(source).toMatchObject({ kind: 'resolved' })
    })
  })

  describe('isUnmodified', () => {
    it('returns false when constructed without a baseline manifest', async () => {
      await using installer = makeInstaller()
      expect(installer.isUnmodified()).toBe(false)
    })

    it('returns true after a no-op install when a baseline manifest was given', async () => {
      const manifest: LexiconsManifest = {
        version: 1,
        lexicons: [],
        resolutions: {},
      }
      await using installer = makeInstaller({}, manifest)
      await installer.install({ additions: [] })
      expect(installer.isUnmodified()).toBe(true)
    })
  })

  describe('installFromFile', () => {
    it('symlinks the source into the output tree and locks it with file://', async () => {
      const source = await writeLexicon(
        join(dir, 'canonical'),
        'com.example.foo',
      )
      await using installer = makeInstaller()

      await installer.installResolved(
        NSID.from('com.example.foo'),
        await readLexiconFile(source),
      )

      const dest = join(dir, 'out', 'com', 'example', 'foo.json')
      expect((await lstat(dest)).isSymbolicLink()).toBe(true)
      expect(installer.resolutions['com.example.foo']?.uri).toMatch(
        /^file:\/\//,
      )
    })

    it('leaves the file in place when source == destination', async () => {
      // Write the source file at exactly the path installFromFile targets.
      const source = await writeLexicon(join(dir, 'out'), 'com.example.foo')
      await using installer = makeInstaller()

      await installer.installResolved(
        NSID.from('com.example.foo'),
        await readLexiconFile(source),
      )

      // Still a real file, not replaced by a symlink.
      expect((await lstat(source)).isSymbolicLink()).toBe(false)
    })
  })

  describe('resolver precedence', () => {
    it('resolves from a directory resolver without touching the network', async () => {
      await writeLexicon(join(dir, 'canonical'), 'com.example.foo')
      const manifest: LexiconsManifest = {
        version: 1,
        lexicons: [],
        resolvers: [{ type: 'directory', path: './canonical' }],
        resolutions: {},
      }

      await using installer = makeInstaller({}, manifest)
      await installer.install({ additions: ['com.example.foo'] })

      expect(installer.networkNsids).toEqual([])
      const dest = join(dir, 'out', 'com', 'example', 'foo.json')
      expect((await lstat(dest)).isSymbolicLink()).toBe(true)
      expect(installer.resolutions['com.example.foo']?.uri).toMatch(
        /^file:\/\//,
      )
    })

    it('falls back to the network when the resolver misses', async () => {
      // Resolver dir is empty — the NSID is not present locally.
      const manifest: LexiconsManifest = {
        version: 1,
        lexicons: [],
        resolvers: [{ type: 'directory', path: './canonical' }],
        resolutions: {},
      }

      await using installer = makeInstaller({}, manifest)
      await installer.install({ additions: ['com.example.foo'] })

      expect(installer.networkNsids).toEqual(['com.example.foo'])
      expect(installer.resolutions['com.example.foo']?.uri).toMatch(/^at:\/\//)
    })
  })
})
