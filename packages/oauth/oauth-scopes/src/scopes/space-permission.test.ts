import { describe, expect, it } from 'vitest'
import {
  SpacePermission,
  type SpacePermissionMatch,
  type SpacePermissionMatchOperation,
} from './space-permission.js'

const FORUM = {
  spaceType: 'com.atmoboards.forum',
  spaceDid: 'did:plc:abc',
  skey: 'default',
} as const

const WILDCARD = { spaceType: '*', spaceDid: '*', skey: '*' } as const

const THREAD = 'com.atmoboards.thread'

// A forum grant for any space DID, so that only `params` decide the outcome.
const grant = (params = '') =>
  SpacePermission.fromString(`space:com.atmoboards.forum?spaceDid=*${params}`)!

describe('SpacePermission', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('applies defaults: spaceDid=self, skey=*, read and writes, no collection, no manage', () => {
        expect(
          SpacePermission.fromString('space:com.atmoboards.forum'),
        ).toEqual({
          spaceType: 'com.atmoboards.forum',
          spaceDid: 'self',
          skey: '*',
          collection: undefined,
          action: ['read', 'create', 'update', 'delete'],
          manage: undefined,
        })
      })

      it('parses a fully-specified scope', () => {
        expect(
          SpacePermission.fromString(
            'space:com.atmoboards.forum?spaceDid=did:plc:abc&skey=default&collection=com.atmoboards.thread&action=create&action=update&manage=update&manage=delete',
          ),
        ).toEqual({
          spaceType: 'com.atmoboards.forum',
          spaceDid: 'did:plc:abc',
          skey: 'default',
          collection: ['com.atmoboards.thread'],
          action: ['create', 'update'],
          manage: ['update', 'delete'],
        })
      })

      for (const invalid of [
        'repo:com.atmoboards.forum',
        'space',
        'space:invalid',
        'space?type=com.atmoboards.forum',
        'space:*?spaceDid=not-a-did',
        'space:com.atmoboards.forum?action=bogus',
        'space:com.atmoboards.forum?manage=bogus',
        'space:com.atmoboards.forum?collection=not_an_nsid',
        'space:com.atmoboards.forum?skey=',
        'space:com.atmoboards.forum?skey=..',
        'space:com.atmoboards.forum?skey=a%2Fb',
      ]) {
        it(`rejects ${invalid}`, () => {
          expect(SpacePermission.fromString(invalid)).toBeNull()
        })
      }
    })

    describe('scopeNeededFor', () => {
      it('builds a read scope', () => {
        expect(
          SpacePermission.scopeNeededFor({ ...FORUM, action: 'read' }),
        ).toBe(
          'space:com.atmoboards.forum?spaceDid=did:plc:abc&skey=default&action=read',
        )
      })

      it('builds a write scope naming the collection', () => {
        expect(
          SpacePermission.scopeNeededFor({
            ...FORUM,
            action: 'create',
            collection: THREAD,
          }),
        ).toBe(
          'space:com.atmoboards.forum?spaceDid=did:plc:abc&skey=default&collection=com.atmoboards.thread&action=create',
        )
      })

      it('builds a manage scope with only read_self', () => {
        expect(
          SpacePermission.scopeNeededFor({ ...FORUM, manage: 'update' }),
        ).toBe(
          'space:com.atmoboards.forum?spaceDid=did:plc:abc&skey=default&action=read_self&manage=update',
        )
      })

      it('builds a scope for a wildcard target', () => {
        expect(
          SpacePermission.scopeNeededFor({ ...WILDCARD, action: 'read_self' }),
        ).toBe('space:*?spaceDid=*&action=read_self')
      })

      it.each<SpacePermissionMatchOperation>([
        { action: 'read' },
        { action: 'read_self' },
        { action: 'create', collection: THREAD },
        { action: 'delete', collection: '*' },
        { manage: 'delete' },
      ])('suggests a scope that matches %o', (op) => {
        const target: SpacePermissionMatch = { ...FORUM, ...op }
        const suggested = SpacePermission.scopeNeededFor(target)
        expect(SpacePermission.fromString(suggested)!.matches(target)).toBe(
          true,
        )
      })
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      it('grants read on a matching space', () => {
        expect(grant().matches({ ...FORUM, action: 'read' })).toBe(true)
      })

      it('refuses read when the action list excludes it', () => {
        expect(
          grant('&action=create').matches({ ...FORUM, action: 'read' }),
        ).toBe(false)
      })

      it('refuses writes on a read-only grant', () => {
        expect(
          grant('&action=read&collection=*').matches({
            ...FORUM,
            action: 'create',
            collection: THREAD,
          }),
        ).toBe(false)
      })

      it('refuses writes when no collection is named', () => {
        expect(
          grant().matches({ ...FORUM, action: 'create', collection: THREAD }),
        ).toBe(false)
      })

      it('allows writes to any collection with collection=*', () => {
        expect(
          grant('&collection=*').matches({
            ...FORUM,
            action: 'create',
            collection: THREAD,
          }),
        ).toBe(true)
      })

      it('matches a write to every collection only with collection=*', () => {
        const op = { action: 'delete', collection: '*' } as const
        expect(grant('&collection=*').matches({ ...FORUM, ...op })).toBe(true)
        expect(
          grant(`&collection=${THREAD}`).matches({ ...FORUM, ...op }),
        ).toBe(false)
      })

      it('limits writes to the named collections', () => {
        const scope = grant(`&collection=${THREAD}`)
        expect(
          scope.matches({ ...FORUM, action: 'create', collection: THREAD }),
        ).toBe(true)
        expect(
          scope.matches({
            ...FORUM,
            action: 'create',
            collection: 'com.atmoboards.reply',
          }),
        ).toBe(false)
      })

      it('grants only the listed manage verbs', () => {
        const scope = grant('&manage=update')
        expect(scope.matches({ ...FORUM, manage: 'update' })).toBe(true)
        expect(scope.matches({ ...FORUM, manage: 'delete' })).toBe(false)
      })

      it('confers no manage verb by default', () => {
        expect(grant().matches({ ...FORUM, manage: 'update' })).toBe(false)
      })

      it('read implies read_self', () => {
        expect(
          grant('&action=read').matches({ ...FORUM, action: 'read_self' }),
        ).toBe(true)
      })

      it('read_self does not imply read', () => {
        const scope = grant('&action=read_self')
        expect(scope.matches({ ...FORUM, action: 'read_self' })).toBe(true)
        expect(scope.matches({ ...FORUM, action: 'read' })).toBe(false)
      })

      it('read_self is not constrained by collection', () => {
        expect(
          grant(`&action=read_self&collection=${THREAD}`).matches({
            ...FORUM,
            action: 'read_self',
          }),
        ).toBe(true)
      })

      it('matches any type with type=*', () => {
        expect(
          SpacePermission.fromString('space:*?spaceDid=*')!.matches({
            ...FORUM,
            spaceType: 'com.example.group',
            action: 'read',
          }),
        ).toBe(true)
      })

      it('refuses another space type', () => {
        expect(
          grant().matches({
            ...FORUM,
            spaceType: 'com.example.group',
            action: 'read',
          }),
        ).toBe(false)
      })

      it('matches only the named space DID and skey', () => {
        const scope = SpacePermission.fromString(
          'space:com.atmoboards.forum?spaceDid=did:plc:abc&skey=default',
        )!
        expect(scope.matches({ ...FORUM, action: 'read' })).toBe(true)
        expect(
          scope.matches({
            ...FORUM,
            spaceDid: 'did:plc:other',
            action: 'read',
          }),
        ).toBe(false)
        expect(scope.matches({ ...FORUM, skey: 'other', action: 'read' })).toBe(
          false,
        )
      })

      it('matches a wildcard target only with a wildcard grant', () => {
        const target = { ...WILDCARD, action: 'read_self' } as const
        expect(grant().matches(target)).toBe(false)
        expect(
          SpacePermission.fromString('space:*?spaceDid=*')!.matches(target),
        ).toBe(true)
      })

      it('an unresolved self space DID matches nothing', () => {
        expect(
          SpacePermission.fromString('space:com.atmoboards.forum')!.matches({
            ...FORUM,
            action: 'read',
          }),
        ).toBe(false)
      })
    })

    describe('toString', () => {
      it('formats a scope', () => {
        expect(
          new SpacePermission(
            'com.atmoboards.forum',
            'did:plc:abc',
            'default',
            [THREAD],
            ['create'],
            undefined,
          ).toString(),
        ).toBe(
          'space:com.atmoboards.forum?spaceDid=did:plc:abc&skey=default&collection=com.atmoboards.thread&action=create',
        )
      })
    })

    describe('withResolvedSpaceDid', () => {
      it('resolves self to the user DID', () => {
        const scope = SpacePermission.fromString(
          'space:com.atmoboards.forum?action=read',
        )!.withResolvedSpaceDid('did:plc:abc')
        expect(scope.toString()).toBe(
          'space:com.atmoboards.forum?spaceDid=did:plc:abc&action=read',
        )
        expect(scope.matches({ ...FORUM, action: 'read' })).toBe(true)
      })

      it('leaves a non-self space DID unchanged', () => {
        const scope = grant()
        expect(scope.withResolvedSpaceDid('did:plc:abc')).toBe(scope)
      })
    })

    describe('withDefaultCollections', () => {
      it('materializes declared collections into a bare grant', () => {
        const scope = grant().withDefaultCollections([
          THREAD,
          'com.atmoboards.reply',
        ])
        expect(scope.toString()).toBe(
          'space:com.atmoboards.forum?spaceDid=*&collection=com.atmoboards.reply&collection=com.atmoboards.thread',
        )
        expect(
          scope.matches({ ...FORUM, action: 'create', collection: THREAD }),
        ).toBe(true)
      })

      it('leaves a grant that names collections unchanged', () => {
        const scope = grant(`&collection=${THREAD}`)
        expect(scope.withDefaultCollections(['com.atmoboards.reply'])).toBe(
          scope,
        )
      })

      it('is a no-op for an empty list', () => {
        const scope = grant()
        expect(scope.withDefaultCollections([])).toBe(scope)
      })
    })
  })

  describe('consistency', () => {
    const testCases: { input: string; expected: string }[] = [
      {
        input: 'space:com.atmoboards.forum',
        expected: 'space:com.atmoboards.forum',
      },
      {
        input: 'space?spaceType=com.atmoboards.forum',
        expected: 'space:com.atmoboards.forum',
      },
      {
        input: 'space:com.atmoboards.forum?spaceDid=self&skey=*',
        expected: 'space:com.atmoboards.forum',
      },
      {
        input:
          'space:com.atmoboards.forum?action=delete&action=update&action=create&action=read',
        expected: 'space:com.atmoboards.forum',
      },
      {
        input: 'space:com.atmoboards.forum?action=delete&action=read_self',
        expected: 'space:com.atmoboards.forum?action=read_self&action=delete',
      },
      {
        input: 'space:com.atmoboards.forum?manage=delete&manage=update',
        expected: 'space:com.atmoboards.forum?manage=update&manage=delete',
      },
      {
        input:
          'space:com.atmoboards.forum?collection=com.atmoboards.thread&collection=com.atmoboards.reply&collection=com.atmoboards.thread',
        expected:
          'space:com.atmoboards.forum?collection=com.atmoboards.reply&collection=com.atmoboards.thread',
      },
      {
        input:
          'space:com.atmoboards.forum?collection=com.atmoboards.thread&collection=*',
        expected: 'space:com.atmoboards.forum?collection=*',
      },
      {
        input: 'space:*?spaceDid=*',
        expected: 'space:*?spaceDid=*',
      },
      {
        input:
          'space?action=create&collection=com.atmoboards.thread&skey=default&spaceDid=did:plc:abc&spaceType=com.atmoboards.forum',
        expected:
          'space:com.atmoboards.forum?spaceDid=did:plc:abc&skey=default&collection=com.atmoboards.thread&action=create',
      },
      {
        input: 'space:com.atmoboards.forum?action=read&manage=update',
        expected: 'space:com.atmoboards.forum?action=read&manage=update',
      },
    ]

    for (const { input, expected } of testCases) {
      it(`re-formats ${input}`, () => {
        expect(SpacePermission.fromString(input)?.toString()).toBe(expected)
      })
    }
  })
})
