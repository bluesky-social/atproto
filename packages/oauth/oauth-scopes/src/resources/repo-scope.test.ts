import { RepoScope } from './repo-scope.js'

describe('RepoScope', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse positional scope', () => {
        const scope = RepoScope.fromString('repo:foo.bar')
        expect(scope).not.toBeNull()
        expect(scope!.collection).toEqual(['foo.bar'])
        expect(scope!.action).toEqual(['create', 'update', 'delete'])
      })

      it('should parse valid repo scope with multiple actions', () => {
        const scope = RepoScope.fromString(
          'repo:foo.bar?action=create&action=update',
        )
        expect(scope).not.toBeNull()
        expect(scope!.collection).toEqual(['foo.bar'])
        expect(scope!.action).toEqual(['create', 'update'])
      })

      it('should parse valid repo scope without actions (defaults to create, update, delete)', () => {
        const scope = RepoScope.fromString('repo:foo.bar')
        expect(scope).not.toBeNull()
        expect(scope!.collection).toEqual(['foo.bar'])
        expect(scope!.action).toEqual(['create', 'update', 'delete'])
      })

      it('should ignore scopes with invalid collection names', () => {
        expect(RepoScope.fromString('repo:foo bar')).toBeNull()
        expect(RepoScope.fromString('repo:.foo')).toBeNull()
        expect(RepoScope.fromString('repo:bar.')).toBeNull()
        expect(RepoScope.fromString('repo:*')).toBeNull()
      })

      it('should reject invalid action names', () => {
        const scope = RepoScope.fromString('repo:foo.bar?action=invalid')
        expect(scope).toBeNull()
      })

      it('should return null for invalid repo scope', () => {
        expect(RepoScope.fromString('invalid')).toBeNull()
        expect(RepoScope.fromString('scope')).toBeNull()
      })

      for (const invalid of [
        'repo:*?action=*',
        'repo:*',
        'invalid',
        'repo:invalid',
        'repo:foo.bar?action=invalid',
        'repo?collection=invalid&action=invalid',
      ]) {
        it(`should return null for invalid rpc scope: ${invalid}`, () => {
          expect(RepoScope.fromString(invalid)).toBeNull()
        })
      }
    })

    describe('scopeNeededFor', () => {
      // @TODO ?
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      it('should match create action', () => {
        const scope = RepoScope.fromString('repo:foo.bar?action=create')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'create', collection: 'foo.bar' }),
        ).toBe(true)
      })

      it('should not match unspecified action', () => {
        const scope = RepoScope.fromString('repo:foo.bar?action=create')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'update', collection: 'foo.bar' }),
        ).toBe(false)
      })

      it('should match wildcard collection', () => {
        const scope = RepoScope.fromString('repo:*?action=create')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'create', collection: 'any.collection' }),
        ).toBe(true)
      })

      it('should not match different action with wildcard collection', () => {
        const scope = RepoScope.fromString('repo:*?action=create')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'delete', collection: 'any.collection' }),
        ).toBe(false)
      })

      it('should match multiple actions', () => {
        const scope = RepoScope.fromString(
          'repo:foo.bar?action=create&action=update',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'create', collection: 'foo.bar' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'update', collection: 'foo.bar' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'delete', collection: 'foo.bar' }),
        ).toBe(false)
      })

      it('should default to "create", "update", and "delete" actions', () => {
        const scope = RepoScope.fromString('repo:foo.bar')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'create', collection: 'foo.bar' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'update', collection: 'foo.bar' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'delete', collection: 'foo.bar' }),
        ).toBe(true)
      })
    })

    describe('toString', () => {
      it('should format repo scope correctly', () => {
        const scope = new RepoScope(['foo.bar'], ['create', 'update'])
        expect(scope).not.toBeNull()
        expect(scope!.toString()).toBe(
          'repo:foo.bar?action=create&action=update',
        )
      })
    })
  })

  describe('consistency', () => {
    const testCases: { input: string; expected: string }[] = [
      //
    ]

    for (const { input, expected } of testCases) {
      it(`should properly re-format ${input}`, () => {
        expect(RepoScope.fromString(input)?.toString()).toBe(expected)
      })
    }
  })
})
