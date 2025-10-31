import { RepoPermission } from './repo-permission.js'

describe('RepoPermission', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse positional scope', () => {
        const scope = RepoPermission.fromString('repo:com.example.foo')
        expect(scope).not.toBeNull()
        expect(scope!.collection).toEqual(['com.example.foo'])
        expect(scope!.action).toEqual(['create', 'update', 'delete'])
      })

      it('should parse valid repo scope with multiple actions', () => {
        const scope = RepoPermission.fromString(
          'repo:com.example.foo?action=create&action=update',
        )
        expect(scope).not.toBeNull()
        expect(scope!.collection).toEqual(['com.example.foo'])
        expect(scope!.action).toEqual(['create', 'update'])
      })

      it('should parse valid repo scope without actions (defaults to create, update, delete)', () => {
        const scope = RepoPermission.fromString('repo:com.example.foo')
        expect(scope).not.toBeNull()
        expect(scope!.collection).toEqual(['com.example.foo'])
        expect(scope!.action).toEqual(['create', 'update', 'delete'])
      })

      it('should allow wildcard collection with specific action', () => {
        const scope = RepoPermission.fromString('repo:*?action=create')
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
        const scope = RepoPermission.fromString('repo:*')
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
        expect(RepoPermission.fromString('repo:foo bar')).toBeNull()
        expect(RepoPermission.fromString('repo:.foo')).toBeNull()
        expect(RepoPermission.fromString('repo:bar.')).toBeNull()
      })

      it('should reject invalid action names', () => {
        const scope = RepoPermission.fromString(
          'repo:com.example.foo?action=invalid',
        )
        expect(scope).toBeNull()
      })

      it('should return null for invalid repo scope', () => {
        expect(RepoPermission.fromString('invalid')).toBeNull()
        expect(RepoPermission.fromString('scope')).toBeNull()
      })

      for (const invalid of [
        'repo:*?action=*',
        'invalid',
        'repo:invalid',
        'repo:com.example.foo?action=invalid',
        'repo?collection=invalid&action=invalid',
      ]) {
        it(`should return null for invalid rpc scope: ${invalid}`, () => {
          expect(RepoPermission.fromString(invalid)).toBeNull()
        })
      }
    })

    describe('scopeNeededFor', () => {
      it('should return correct scope string for specific collection and action', () => {
        const scope = RepoPermission.scopeNeededFor({
          collection: 'com.example.foo',
          action: 'create',
        })
        expect(scope).toBe('repo:com.example.foo?action=create')
      })

      it('should return scope that accepts all collections with specific action', () => {
        const scope = RepoPermission.scopeNeededFor({
          collection: '*',
          action: 'create',
        })
        expect(scope).toBe('repo:*?action=create')
      })

      it('ignores invalid options', () => {
        // @NOTE the scopeNeededFor assumes valid input, so it does not validate
        // collection or action.

        expect(
          RepoPermission.scopeNeededFor({
            collection: 'invalid',
            action: 'create',
          }),
        ).toBe('repo:invalid?action=create')
      })
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      it('should match create action', () => {
        const scope = RepoPermission.fromString(
          'repo:com.example.foo?action=create',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'create', collection: 'com.example.foo' }),
        ).toBe(true)
      })

      it('should not match unspecified action', () => {
        const scope = RepoPermission.fromString(
          'repo:com.example.foo?action=create',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'update', collection: 'com.example.foo' }),
        ).toBe(false)
      })

      it('should match wildcard collection', () => {
        const scope = RepoPermission.fromString('repo:*?action=create')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'create', collection: 'com.example.bar' }),
        ).toBe(true)
      })

      it('should not match different action with wildcard collection', () => {
        const scope = RepoPermission.fromString('repo:*?action=create')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'delete', collection: 'com.example.bar' }),
        ).toBe(false)
      })

      it('should match multiple actions', () => {
        const scope = RepoPermission.fromString(
          'repo:com.example.foo?action=create&action=update',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'create', collection: 'com.example.foo' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'update', collection: 'com.example.foo' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'delete', collection: 'com.example.foo' }),
        ).toBe(false)
      })

      it('should default to "create", "update", and "delete" actions', () => {
        const scope = RepoPermission.fromString('repo:com.example.foo')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({ action: 'create', collection: 'com.example.foo' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'update', collection: 'com.example.foo' }),
        ).toBe(true)
        expect(
          scope!.matches({ action: 'delete', collection: 'com.example.foo' }),
        ).toBe(true)
      })
    })

    describe('toString', () => {
      it('should format repo scope correctly', () => {
        const scope = new RepoPermission(
          ['com.example.foo'],
          ['create', 'update'],
        )
        expect(scope).not.toBeNull()
        expect(scope!.toString()).toBe(
          'repo:com.example.foo?action=create&action=update',
        )
      })
    })
  })

  describe('consistency', () => {
    const testCases: { input: string; expected: string }[] = [
      { input: 'repo:com.example.foo', expected: 'repo:com.example.foo' },
      {
        input: 'repo:com.example.foo?action=create',
        expected: 'repo:com.example.foo?action=create',
      },
      {
        input: 'repo:com.example.foo?action=create&action=update',
        expected: 'repo:com.example.foo?action=create&action=update',
      },
      {
        input: 'repo:*?action=create&action=update&action=delete',
        expected: 'repo:*',
      },
      {
        input: 'repo:com.example.foo?action=create&action=update&action=delete',
        expected: 'repo:com.example.foo',
      },
      { input: 'repo:*?action=create', expected: 'repo:*?action=create' },
      { input: 'repo:*?action=update', expected: 'repo:*?action=update' },
      {
        input: 'repo?collection=*&action=update',
        expected: 'repo:*?action=update',
      },
      {
        input: 'repo?collection=*&collection=com.example.foo&action=update',
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
        input: 'repo?collection=*&collection=com.example.foo',
        expected: 'repo:*',
      },
      {
        input: 'repo?action=create&collection=com.example.foo',
        expected: 'repo:com.example.foo?action=create',
      },
      {
        input:
          'repo?collection=com.example.foo&action=create&action=update&action=delete',
        expected: 'repo:com.example.foo',
      },
      {
        input:
          'repo?action=create&collection=com.example.foo&collection=com.example.bar',
        expected:
          'repo?collection=com.example.bar&collection=com.example.foo&action=create',
      },
    ]

    for (const { input, expected } of testCases) {
      it(`should properly re-format ${input}`, () => {
        expect(RepoPermission.fromString(input)?.toString()).toBe(expected)
      })
    }
  })
})
