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

      it('should allow wildcard collection with specific action', () => {
        const scope = RepoScope.fromString('repo:*?action=create')
        expect(scope).not.toBeNull()
        expect(scope!.collection).toEqual(['*'])
        expect(scope!.action).toEqual(['create'])
        expect(
          scope!.matches({ action: 'create', collection: 'any.collection' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'update', collection: 'any.collection' }),
        ).toBe(false)
      })

      it('should allow wildcard collection without actions', () => {
        const scope = RepoScope.fromString('repo:*')
        expect(scope).not.toBeNull()
        expect(scope!.collection).toEqual(['*'])
        expect(scope!.action).toEqual(['create', 'update', 'delete'])
        expect(
          scope!.matches({ action: 'create', collection: 'any.collection' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'update', collection: 'any.collection' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'delete', collection: 'any.collection' }),
        ).toBe(true)
      })

      it('should ignore scopes with invalid collection names', () => {
        expect(RepoScope.fromString('repo:foo bar')).toBeNull()
        expect(RepoScope.fromString('repo:.foo')).toBeNull()
        expect(RepoScope.fromString('repo:bar.')).toBeNull()
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
      it('should return correct scope string for specific collection and action', () => {
        const scope = RepoScope.scopeNeededFor({
          collection: 'foo.bar',
          action: 'create',
        })
        expect(scope).toBe('repo:foo.bar?action=create')
      })

      it('should return scope that accepts all collections with specific action', () => {
        const scope = RepoScope.scopeNeededFor({
          collection: '*',
          action: 'create',
        })
        expect(scope).toBe('repo:*?action=create')
      })

      it('ignores invalid collection names', () => {
        // @NOTE the scopeNeededFor assumes valid input, so it does not validate
        // collection or action.
        const scope = RepoScope.scopeNeededFor({
          collection: 'invalid',
          // @ts-expect-error
          action: 'not-an-action',
        })
        expect(scope).toBe('repo:invalid?action=not-an-action')
      })
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
      { input: 'repo:foo.bar', expected: 'repo:foo.bar' },
      {
        input: 'repo:foo.bar?action=create',
        expected: 'repo:foo.bar?action=create',
      },
      {
        input: 'repo:foo.bar?action=create&action=update',
        expected: 'repo:foo.bar?action=create&action=update',
      },
      {
        input: 'repo:*?action=create&action=update&action=delete',
        expected: 'repo:*',
      },
      {
        input: 'repo:foo.bar?action=create&action=update&action=delete',
        expected: 'repo:foo.bar',
      },
      { input: 'repo:*?action=create', expected: 'repo:*?action=create' },
      { input: 'repo:*?action=update', expected: 'repo:*?action=update' },
      {
        input: 'repo?collection=*&action=update',
        expected: 'repo:*?action=update',
      },
      {
        input: 'repo?collection=*&collection=foo.bar&action=update',
        expected: 'repo:*?action=update',
      },
      {
        input: 'repo?collection=*',
        expected: 'repo:*',
      },
      {
        input: 'repo?collection=*&action=create&action=update&action=delete',
        expected: 'repo:*',
      },
      {
        input: 'repo?collection=*&collection=foo.bar',
        expected: 'repo:*',
      },
      {
        input: 'repo?action=create&collection=foo.bar',
        expected: 'repo:foo.bar?action=create',
      },
      {
        input:
          'repo?collection=foo.bar&action=create&action=update&action=delete',
        expected: 'repo:foo.bar',
      },
      {
        input: 'repo?action=create&collection=foo.bar&collection=baz.qux',
        expected: 'repo?collection=baz.qux&collection=foo.bar&action=create',
      },
    ]

    for (const { input, expected } of testCases) {
      it(`should properly re-format ${input}`, () => {
        expect(RepoScope.fromString(input)?.toString()).toBe(expected)
      })
    }
  })
})
