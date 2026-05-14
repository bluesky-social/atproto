import { SpacePermission } from './space-permission.js'

const ALL_ACTIONS = ['read', 'create', 'update', 'delete'] as const

describe('SpacePermission', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('parses positional type with all defaults', () => {
        const scope = SpacePermission.fromString('space:com.atmoboards.forum')
        expect(scope).not.toBeNull()
        expect(scope!.type).toBe('com.atmoboards.forum')
        expect(scope!.did).toBe('*')
        expect(scope!.skey).toBe('*')
        expect(scope!.collection).toEqual([])
        expect(scope!.action).toEqual(ALL_ACTIONS)
      })

      it('parses wildcard type', () => {
        const scope = SpacePermission.fromString(
          'space:*?did=did:plc:abc123xyz',
        )
        expect(scope).not.toBeNull()
        expect(scope!.type).toBe('*')
        expect(scope!.did).toBe('did:plc:abc123xyz')
      })

      it('parses a fully-specified scope', () => {
        const scope = SpacePermission.fromString(
          'space:com.atmoboards.forum?did=did:plc:abc123xyz&skey=default&collection=com.atmoboards.thread&action=create&action=update',
        )
        expect(scope).not.toBeNull()
        expect(scope!.type).toBe('com.atmoboards.forum')
        expect(scope!.did).toBe('did:plc:abc123xyz')
        expect(scope!.skey).toBe('default')
        expect(scope!.collection).toEqual(['com.atmoboards.thread'])
        expect(scope!.action).toEqual(['create', 'update'])
      })

      it('omitted action defaults to all four actions', () => {
        const scope = SpacePermission.fromString(
          'space:com.atmoboards.forum?collection=*',
        )
        expect(scope!.action).toEqual(ALL_ACTIONS)
      })

      it('omitted collection means no write targets (empty list)', () => {
        const scope = SpacePermission.fromString('space:com.atmoboards.forum')
        expect(scope!.collection).toEqual([])
      })

      it('rejects invalid type NSID', () => {
        expect(SpacePermission.fromString('space:foo bar')).toBeNull()
        expect(SpacePermission.fromString('space:short')).toBeNull()
      })

      it('rejects invalid did', () => {
        expect(SpacePermission.fromString('space:*?did=not-a-did')).toBeNull()
        expect(SpacePermission.fromString('space:*?did=did:')).toBeNull()
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

      it('returns null for non-space prefix', () => {
        expect(SpacePermission.fromString('repo:com.example.x')).toBeNull()
        expect(SpacePermission.fromString('whatever')).toBeNull()
      })
    })

    describe('scopeNeededFor', () => {
      it('builds a read scope', () => {
        const scope = SpacePermission.scopeNeededFor({
          type: 'com.atmoboards.forum',
          did: 'did:plc:abc',
          skey: 'default',
          action: 'read',
        })
        expect(scope).toBe(
          'space:com.atmoboards.forum?did=did:plc:abc&skey=default&action=read',
        )
      })

      it('builds a write scope with collection', () => {
        const scope = SpacePermission.scopeNeededFor({
          type: 'com.atmoboards.forum',
          did: 'did:plc:abc',
          skey: 'default',
          collection: 'com.atmoboards.thread',
          action: 'create',
        })
        expect(scope).toBe(
          'space:com.atmoboards.forum?did=did:plc:abc&skey=default&collection=com.atmoboards.thread&action=create',
        )
      })
    })
  })

  describe('matches', () => {
    const baseTarget = {
      type: 'com.atmoboards.forum',
      did: 'did:plc:abc',
      skey: 'default',
    }

    it('grants read on tuple match (default action list includes read)', () => {
      const scope = SpacePermission.fromString('space:com.atmoboards.forum')!
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(true)
    })

    it('refuses read when action list excludes it (e.g. action=create only)', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?action=create',
      )!
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(false)
    })

    it('action=read alone allows reads but blocks writes', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?action=read',
      )!
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
      const scope = SpacePermission.fromString('space:com.atmoboards.forum')!
      expect(
        scope.matches({
          ...baseTarget,
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).toBe(false)
    })

    it('collection=* permits writes on any collection (when action allows)', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?collection=*',
      )!
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

    it('explicit collection limits writes to that collection', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?collection=com.atmoboards.thread&action=create',
      )!
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
      const scope = SpacePermission.fromString('space:*?did=did:plc:abc')!
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(true)
      expect(
        scope.matches({
          ...baseTarget,
          type: 'com.example.different',
          action: 'read',
        }),
      ).toBe(true)
    })

    it('type/did/skey filters are AND-combined', () => {
      const scope = SpacePermission.fromString(
        'space:com.atmoboards.forum?did=did:plc:abc&skey=default',
      )!
      expect(scope.matches({ ...baseTarget, action: 'read' })).toBe(true)
      // wrong did
      expect(
        scope.matches({
          ...baseTarget,
          did: 'did:plc:other',
          action: 'read',
        }),
      ).toBe(false)
      // wrong skey
      expect(
        scope.matches({ ...baseTarget, skey: 'other', action: 'read' }),
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
        'space:com.atmoboards.forum?did=did:plc:abc123xyz&skey=default&collection=com.atmoboards.thread&action=create'
      const scope = SpacePermission.fromString(input)!
      // Colons in DID are kept un-encoded for readability (see syntax-string).
      expect(scope.toString()).toBe(input)
    })
  })
})
