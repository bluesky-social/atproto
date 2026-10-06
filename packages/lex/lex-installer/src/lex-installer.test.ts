import { lstat, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeJsonFile } from './fs.js'
import { LexInstaller } from './lex-installer.js'
import type { LexInstallerOptions } from './lex-installer.js'
import type { LexiconsManifest } from './lexicons-manifest.js'

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

describe('LexInstaller', () => {
  let dir: string

  function makeInstaller(
    manifest?: LexiconsManifest,
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
      const manifest: LexiconsManifest = {
        version: 1,
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
      const manifest: LexiconsManifest = {
        version: 1,
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
      const manifest: LexiconsManifest = {
        version: 1,
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
      const manifest: LexiconsManifest = {
        version: 1,
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
})
