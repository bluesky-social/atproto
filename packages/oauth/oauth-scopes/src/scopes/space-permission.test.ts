import { describe, expect, it } from 'vitest'
import { SpacePermission } from './space-permission.js'

// Default action list when `action` is omitted (read implies read_self).
const DEFAULT_ACTIONS = ['read', 'create', 'update', 'delete'] as const

describe('SpacePermission', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('parses positional type with all defaults', () => {
        const scope = SpacePermission.fromString('space:com.atmoboards.forum')
        expect(scope).not.toBeNull()
        expect(scope!.type).toBe('com.atmoboards.forum')
        // authority defaults to `self`, not `*`.
        expect(scope!.authority).toBe('self')
        expect(scope!.skey).toBe('*')
        expect(scope!.collection).toEqual([])
        expect(scope!.action).toEqual(DEFAULT_ACTIONS)
        expect(scope!.manage).toEqual([])
      })

      it('parses wildcard type', () => {
        const scope = SpacePermission.fromString(
          'space:*?authority=did:plc:abc123xyz',
        )
        expect(scope).not.toBeNull()
        expect(scope!.type).toBe('*')
        expect(scope!.authority).toBe('did:plc:abc123xyz')
      })

      it('parses authority=*', () => {
        const scope = SpacePermission.fromString(
          'space:com.atmoboards.forum?authority=*',
        )
        expect(scope!.authority).toBe('*')
      })

      it('parses a fully-specified scope', () => {
        const scope = SpacePermission.fromString(
          'space:com.atmoboards.forum?authority=did:plc:abc123xyz&skey=default&collection=com.atmoboards.thread&action=create&action=update',
        )
        expect(scope).not.toBeNull()
        expect(scope!.type).toBe('com.atmoboards.forum')
        expect(scope!.authority).toBe('did:plc:abc123xyz')
        expect(scope!.skey).toBe('default')
        expect(scope!.collection).toEqual(['com.atmoboards.thread'])
        expect(scope!.action).toEqual(['create', 'update'])
      })

      it('omitted action defaults to read + the three writes', () => {
        const scope = SpacePermission.fromString(
          'space:com.atmoboards.forum?collection=*',
        )
        expect(scope!.action).toEqual(DEFAULT_ACTIONS)
      })

      it('parses read_self action', () => {
        const scope = SpacePermission.fromString(
          'space:com.atmoboards.forum?action=read_self&collection=*',
        )
        expect(scope!.action).toEqual(['read_self'])
      })

      it('parses manage verbs into the manage list', () => {
        const scope = SpacePermission.fromString(
          'space:com.atmoboards.forum?manage=update&manage=delete',
        )
        expect(scope!.manage).toEqual(['update', 'delete'])
      })

      it('rejects invalid manage verbs', () => {
        expect(
          SpacePermission.fromString('space:com.example.x?manage=bogus'),
        ).toBeNull()
      })

      it('omitted collection means no write targets (empty list)', () => {
        const scope = SpacePermission.fromString('space:com.atmoboards.forum')
        expect(scope!.collection).toEqual([])
      })

      it('rejects invalid type NSID', () => {
        expect(SpacePermission.fromString('space:foo bar')).toBeNull()
        expect(SpacePermission.fromString('space:short')).toBeNull()
      })

      it('rejects invalid authority', () => {
        expect(
          SpacePermission.fromString('space:*?authority=not-a-did'),
        ).toBeNull()
        expect(SpacePermission.fromString('space:*?authority=did:')).toBeNull()
      })

      it('rejects invalid action values', () => {
        expect(
          SpacePermission.fromString('space:com.example.x?action=bogus'),
        ).toBeNull()
      })

      it('rejects invalid collection NSIDs (without wildcard)', () => {
        expect(
          SpacePermission.fromString(
            'space:com.example.x?collection=not_an_nsid',
          ),
        ).toBeNull()
      })

      it('rejects an empty skey', () => {
        expect(
          SpacePermission.fromString('space:com.example.x?skey='),
        ).toBeNull()
      })

      it('accepts rkey-shaped skeys', () => {
        for (const skey of [
          'self',
          '3jui7kd54zh2y',
          'a.b-c_d~e:f',
          'x'.repeat(512),
        ]) {
          const scope = SpacePermission.fromString(
            `space:com.example.x?skey=${skey}`,
          )
          expect(scope?.skey).toBe(skey)
        }
      })

      it('rejects skeys that are not valid record keys', () => {
        for (const skey of [
          'hello world',
          '.',
          '..',
          'a/b',
          'a#b',
          'x'.repeat(513),
        ]) {
          expect(
            SpacePermission.fromString(
              `space:com.example.x?skey=${encodeURIComponent(skey)}`,
            ),
          ).toBeNull()
        }
      })

      it('returns null for non-space prefix', () => {
        expect(SpacePermission.fromString('repo:com.example.x')).toBeNull()
        expect(SpacePermission.fromString('whatever')).toBeNull()
      })
    })

    describe('scopeNeededFor', () => {
      it('builds a read scope', () => {
        const scope = SpacePermission.scopeNeededFor({
          type: 'com.atmoboards.forum',
          authority: 'did:plc:abc',
          skey: 'default',
          action: 'read',
        })
        expect(scope).toBe(
          'space:com.atmoboards.forum?authority=did:plc:abc&skey=default&action=read',
        )
      })

      it('builds a write scope with collection', () => {
        const scope = SpacePermission.scopeNeededFor({
          type: 'com.atmoboards.forum',
          authority: 'did:plc:abc',
          skey: 'default',
          collection: 'com.atmoboards.thread',
          action: 'create',
        })
        expect(scope).toBe(
          'space:com.atmoboards.forum?authority=did:plc:abc&skey=default&collection=com.atmoboards.thread&action=create',
        )
      })

      it('builds a manage scope without asking for record access', () => {
        const scope = SpacePermission.scopeNeededFor({
          type: 'com.atmoboards.forum',
          authority: 'did:plc:abc',
          skey: 'default',
          manage: 'update',
        })
        expect(scope).toBe(
          'space:com.atmoboards.forum?authority=did:plc:abc&skey=default&action=read_self&manage=update',
        )
      })

      it.each([
        [{ action: 'read' } as const],
        [{ action: 'read_self' } as const],
        [
          {
            action: 'create',
            collection: 'com.atmoboards.thread',
          } as const,
        ],
        [{ manage: 'delete' } as const],
      ])('round-trips %o without widening the grant', (op) => {
        const target = {
          type: 'com.atmoboards.forum',
          authority: 'did:plc:abc' as const,
          skey: 'default',
          ...op,
        }
        const suggested = SpacePermission.scopeNeededFor(target)
        const reparsed = SpacePermission.fromString(suggested)
        expect(reparsed).not.toBeNull()
        expect(reparsed!.matches(target)).toBe(true)
        // The suggestion must not confer writes the caller never asked for.
        if (!('collection' in op)) {
          expect(
            reparsed!.matches({
              type: 'com.atmoboards.forum',
              authority: 'did:plc:abc',
              skey: 'default',
              action: 'create',
              collection: 'com.atmoboards.thread',
            }),
          ).toBe(false)
        }
      })
    })
  })

  describe('matches', () => {
    const baseTarget = {
      type: 'com.atmoboards.forum',
      authority: 'did:plc:abc',
      skey: 'default',
    }

    // A grant covering any authority — the common case for a forum client that
    // reads spaces hosted by others. `self` is resolved at issuance and tested
    // separately below.
    const anyAuthority = (rest = '') =>
      SpacePermission.fromString(
        `space:com.atmoboards.forum?authority=*${rest}`,
      )!

    it('grants read on tuple match (default action list includes read)', () => {
      const scope = anyAuthority()
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(true)
    })

    it('refuses read when action list excludes it (e.g. action=create only)', () => {
      const scope = anyAuthority('&action=create')
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(false)
    })

    it('action=read alone allows reads but blocks writes', () => {
      const scope = anyAuthority('&action=read')
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(true)
      expect(
        scope.matches({
          ...baseTarget,
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).toBe(false)
    })

    it('omitted collection blocks all writes even when action list includes them', () => {
      const scope = anyAuthority()
      expect(
        scope.matches({
          ...baseTarget,
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).toBe(false)
    })

    it('collection=* permits writes on any collection (when action allows)', () => {
      const scope = anyAuthority('&collection=*')
      expect(
        scope.matches({
          ...baseTarget,
          action: 'create',
          collection: 'any.collection.name',
        }),
      ).toBe(true)
      expect(
        scope.matches({
          ...baseTarget,
          action: 'update',
          collection: 'another.one.here',
        }),
      ).toBe(true)
    })

    it('manage= governs space-level ops independent of collection', () => {
      const scope = anyAuthority('&action=read&manage=update')
      expect(scope.matches({ ...baseTarget, manage: 'update' })).toBe(true)
      // a different manage verb is not covered
      expect(scope.matches({ ...baseTarget, manage: 'delete' })).toBe(false)
    })

    it('a record-only grant (no manage) confers no manage verb', () => {
      const scope = anyAuthority('&action=read')
      expect(scope.matches({ ...baseTarget, manage: 'update' })).toBe(false)
    })

    it('default grant confers no manage capability', () => {
      const scope = anyAuthority()
      expect(scope.matches({ ...baseTarget, manage: 'update' })).toBe(false)
    })

    it('read implies read_self', () => {
      const scope = anyAuthority('&action=read')
      expect(scope.matches({ ...baseTarget, action: 'read_self' })).toBe(true)
    })

    it('read_self grants own-repo read but not whole-space read', () => {
      const scope = anyAuthority('&action=read_self')
      expect(scope.matches({ ...baseTarget, action: 'read_self' })).toBe(true)
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(false)
    })

    it('read_self is not constrained by collection', () => {
      // A grant naming one collection still reads the whole of its own repo:
      // reads are all-or-nothing at the repo boundary.
      const scope = anyAuthority(
        '&action=read_self&collection=com.atmoboards.thread',
      )
      expect(scope.matches({ ...baseTarget, action: 'read_self' })).toBe(true)
    })

    it('explicit collection limits writes to that collection', () => {
      const scope = anyAuthority(
        '&collection=com.atmoboards.thread&action=create',
      )
      expect(
        scope.matches({
          ...baseTarget,
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).toBe(true)
      expect(
        scope.matches({
          ...baseTarget,
          action: 'create',
          collection: 'com.atmoboards.reply',
        }),
      ).toBe(false)
    })

    it('type=* matches any space type', () => {
      const scope = SpacePermission.fromString('space:*?authority=did:plc:abc')!
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(true)
      expect(
        scope.matches({
          ...baseTarget,
          type: 'com.example.different',
          action: 'read',
        }),
      ).toBe(true)
    })

    it('a concrete authority matches only that authority', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?authority=did:plc:abc&skey=default',
      )!
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(true)
      // wrong authority
      expect(
        scope.matches({
          ...baseTarget,
          authority: 'did:plc:other',
          action: 'read',
        }),
      ).toBe(false)
      // wrong skey
      expect(
        scope.matches({ ...baseTarget, skey: 'other', action: 'read' }),
      ).toBe(false)
    })

    it('an unresolved `self` authority matches nothing (fail closed)', () => {
      const scope = SpacePermission.fromString('space:com.atmoboards.forum')!
      expect(scope.authority).toBe('self')
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(false)
    })

    it('a `self` authority resolved to the user DID matches that DID', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?action=read',
      )!.withResolvedAuthority('did:plc:abc')
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(true)
      expect(
        scope.matches({
          ...baseTarget,
          authority: 'did:plc:other',
          action: 'read',
        }),
      ).toBe(false)
    })
  })

  describe('toString', () => {
    it('round-trips a minimal scope', () => {
      const scope = SpacePermission.fromString('space:com.atmoboards.forum')!
      expect(scope.toString()).toBe('space:com.atmoboards.forum')
    })

    it('round-trips a complex scope', () => {
      const input =
        'space:com.atmoboards.forum?authority=did:plc:abc123xyz&skey=default&collection=com.atmoboards.thread&action=create'
      const scope = SpacePermission.fromString(input)!
      // Colons in DID are kept un-encoded for readability (see syntax-string).
      expect(scope.toString()).toBe(input)
    })
  })

  describe('withResolvedAuthority', () => {
    it('resolves a `self` authority to the given user DID', () => {
      const scope = SpacePermission.fromString('space:com.atmoboards.forum')!
      expect(scope.isSelfAuthority).toBe(true)
      const resolved = scope.withResolvedAuthority('did:plc:abc')
      expect(resolved.authority).toBe('did:plc:abc')
    })

    it('leaves a concrete authority unchanged', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?authority=did:plc:xyz',
      )!
      expect(scope.isSelfAuthority).toBe(false)
      expect(scope.withResolvedAuthority('did:plc:abc')).toBe(scope)
    })

    it('leaves a wildcard authority unchanged', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?authority=*',
      )!
      expect(scope.withResolvedAuthority('did:plc:abc')).toBe(scope)
    })
  })

  describe('withDefaultCollections', () => {
    it('materializes declared collections into a bare grant', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?authority=*',
      )!
      expect(scope.hasCollections).toBe(false)
      const expanded = scope.withDefaultCollections([
        'com.atmoboards.thread',
        'com.atmoboards.reply',
      ])
      expect(expanded.collection).toEqual([
        'com.atmoboards.thread',
        'com.atmoboards.reply',
      ])
      // Now writes to the declared collections are permitted.
      expect(
        expanded.matches({
          type: 'com.atmoboards.forum',
          authority: 'did:plc:abc',
          skey: 'default',
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).toBe(true)
    })

    it('leaves a grant that already names collections unchanged', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?collection=com.atmoboards.thread',
      )!
      expect(scope.hasCollections).toBe(true)
      const expanded = scope.withDefaultCollections(['com.atmoboards.reply'])
      expect(expanded).toBe(scope)
      expect(expanded.collection).toEqual(['com.atmoboards.thread'])
    })

    it('leaves a collection=* grant unchanged', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?collection=*',
      )!
      expect(scope.hasCollections).toBe(true)
      expect(scope.withDefaultCollections(['com.atmoboards.thread'])).toBe(
        scope,
      )
    })

    it('is a no-op when given an empty default list', () => {
      const scope = SpacePermission.fromString('space:com.atmoboards.forum')!
      expect(scope.withDefaultCollections([])).toBe(scope)
    })
  })
})
