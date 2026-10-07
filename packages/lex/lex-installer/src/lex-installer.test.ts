import { lstat, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cidForLex } from '@atproto/lex-cbor'
import { writeJsonFile } from './fs.js'
import type { LexInstallerOptions } from './lex-installer.js'
import { LexInstaller } from './lex-installer.js'
import type { LexiconsManifestV2 } from './lexicons-manifest.js'

/**
 * Test subclass exposing the protected working manifest so assertions can read
 * the installed roots and their resolutions without saving to disk.
 */
class TestInstaller extends LexInstaller {
  get resolutions() {
    return this.workingManifest.resolutions
  }
  get lexicons() {
    return this.workingManifest.lexicons
  }
}

/**
 * A minimal (ref-free) lexicon document. `description` lets callers mint
 * documents with distinct CIDs for the same NSID.
 */
function lexiconDoc(id: string, description = id) {
  return {
    lexicon: 1 as const,
    id,
    defs: { main: { type: 'procedure' as const, description } },
  }
}

/** Writes a minimal (ref-free) lexicon document at its NSID-derived path. */
async function writeLexicon(
  dir: string,
  id: string,
  declaredId = id,
  description = id,
): Promise<string> {
  const path = `${join(dir, ...id.split('.'))}.json`
  await writeJsonFile(path, lexiconDoc(declaredId, description))
  return path
}

describe('LexInstaller', () => {
  let dir: string

  function makeInstaller(
    manifest?: LexiconsManifestV2,
    overrides: Partial<LexInstallerOptions> = {},
  ) {
    return new TestInstaller(
      {
        lexicons: join(dir, 'out'),
        manifest: join(dir, 'lexicons.json'),
        ...overrides,
      },
      manifest,
    )
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lex-installer-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  describe('requiresSave', () => {
    it('returns true when constructed without a baseline manifest', () => {
      // A missing lockfile is drift to report, not an unchanged state.
      const installer = makeInstaller()
      expect(installer.requiresSave()).toBe(true)
    })

    it('returns false after a no-op install when a baseline manifest was given', async () => {
      const manifest: LexiconsManifestV2 = {
        version: 2,
        lexicons: [],
        resolutions: {},
      }
      const installer = makeInstaller(manifest)
      await installer.install({ additions: [] })
      expect(installer.requiresSave()).toBe(false)
    })
  })

  describe('install from a directory resolver', () => {
    it('symlinks the source into the output tree and locks it with a relative file://', async () => {
      await writeLexicon(join(dir, 'canonical'), 'com.example.foo')
      const manifest: LexiconsManifestV2 = {
        version: 2,
        lexicons: [],
        resolvers: [{ type: 'directory', path: './canonical' }],
        resolutions: {},
      }

      const installer = makeInstaller(manifest)
      await installer.install({ additions: ['com.example.foo'] })

      const dest = join(dir, 'out', 'com', 'example', 'foo.json')
      expect((await lstat(dest)).isSymbolicLink()).toBe(true)
      expect(installer.resolutions['com.example.foo']?.uri).toMatch(
        /^file:\/\/\.\.?\//,
      )
      expect(installer.lexicons).toContain('com.example.foo')
    })

    it('leaves the file in place when the source already lives at the output path', async () => {
      // Resolver points at the output dir itself: dest === source, no symlink.
      const source = await writeLexicon(join(dir, 'out'), 'com.example.foo')
      const manifest: LexiconsManifestV2 = {
        version: 2,
        lexicons: [],
        resolvers: [{ type: 'directory', path: './out' }],
        resolutions: {},
      }

      const installer = makeInstaller(manifest)
      await installer.install({ additions: ['com.example.foo'] })

      expect((await lstat(source)).isSymbolicLink()).toBe(false)
    })

    it('consults resolvers in priority order (first match wins)', async () => {
      await writeLexicon(join(dir, 'a'), 'com.example.foo')
      await writeLexicon(join(dir, 'b'), 'com.example.foo')
      const manifest: LexiconsManifestV2 = {
        version: 2,
        lexicons: [],
        resolvers: [
          { type: 'directory', path: './a' },
          { type: 'directory', path: './b' },
        ],
        resolutions: {},
      }

      const installer = makeInstaller(manifest)
      await installer.install({ additions: ['com.example.foo'] })

      // The higher-priority './a' resolver answered, not './b'.
      expect(installer.resolutions['com.example.foo']?.uri).toContain('/a/')
    })
  })

  describe('install from an existing lock (file reuse)', () => {
    it('resolves a locked relative file:// source against the manifest directory', async () => {
      // Source lives at <dir>/vendored/com/example/foo.json; the manifest file is
      // <dir>/lexicons.json, so the lock records it relative to <dir>.
      const source = await writeLexicon(
        join(dir, 'vendored'),
        'com.example.foo',
      )
      const cid = (await cidForLex(lexiconDoc('com.example.foo'))).toString()

      const manifest: LexiconsManifestV2 = {
        version: 2,
        lexicons: ['com.example.foo'],
        // A directory resolver pointing at a non-existent dir: it never answers,
        // so a successful install can only come from reusing the locked file.
        // Resolving that file against the manifest *file* path (the old bug)
        // would produce a dangling symlink and fall through to this resolver.
        resolvers: [{ type: 'directory', path: './empty' }],
        resolutions: {
          'com.example.foo': {
            cid,
            uri: 'file://./vendored/com/example/foo.json',
          },
        },
      }

      const installer = makeInstaller(manifest)
      await installer.install()

      const dest = join(dir, 'out', 'com', 'example', 'foo.json')
      expect((await lstat(dest)).isSymbolicLink()).toBe(true)
      // The symlink resolves to the real source content (not a dangling link).
      expect(await readFile(dest, 'utf8')).toBe(await readFile(source, 'utf8'))
      // The relative lock is preserved verbatim.
      expect(installer.resolutions['com.example.foo']?.uri).toBe(
        'file://./vendored/com/example/foo.json',
      )
    })

    it('preserves a relative file:// lock across a re-install from a foreign cwd', async () => {
      // The temp manifest dir is never the process cwd, so re-normalizing the
      // already-relative lock against cwd (the old bug) would corrupt it.
      await writeLexicon(join(dir, 'canonical'), 'com.example.foo')
      const manifest: LexiconsManifestV2 = {
        version: 2,
        lexicons: [],
        resolvers: [{ type: 'directory', path: './canonical' }],
        resolutions: {},
      }

      // First install locks a relative file:// uri.
      const first = makeInstaller(manifest)
      await first.install({ additions: ['com.example.foo'] })
      const lockedUri = first.resolutions['com.example.foo']?.uri
      expect(lockedUri).toMatch(/^file:\/\/\.\.?\//)

      // Re-install from that lock: the reuse path must round-trip it exactly.
      const second = makeInstaller({
        version: 2,
        lexicons: ['com.example.foo'],
        resolvers: [{ type: 'directory', path: './canonical' }],
        resolutions: {
          'com.example.foo': first.resolutions['com.example.foo']!,
        },
      })
      await second.install()
      expect(second.resolutions['com.example.foo']?.uri).toBe(lockedUri)
    })
  })

  describe('re-resolution of a locked lexicon whose file is missing', () => {
    // Locked under an at:// uri (no local file on disk), so install must
    // re-resolve. Re-resolution must not silently accept different content.
    const lockedUri =
      'at://did:plc:z72i7hdynmk6r22z27h6tvur/com.atproto.lexicon.schema/com.example.foo'

    it('accepts re-resolved content whose CID matches the lock', async () => {
      const cid = (
        await cidForLex(lexiconDoc('com.example.foo', 'stable'))
      ).toString()
      await writeLexicon(
        join(dir, 'src'),
        'com.example.foo',
        undefined,
        'stable',
      )

      const installer = makeInstaller({
        version: 2,
        lexicons: ['com.example.foo'],
        resolvers: [{ type: 'directory', path: './src' }],
        resolutions: { 'com.example.foo': { cid, uri: lockedUri } },
      })

      await installer.install()
      expect(installer.resolutions['com.example.foo']?.cid).toBe(cid)
    })
  })
})
