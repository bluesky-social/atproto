import { ScopeStringFor } from '../lib/syntax'
import { LexPermissionSyntax } from '../lib/syntax-lexicon'
import { AccountPermission } from './account-permission'
import { IdentityPermission } from './identity-permission'
import { IncludeScope, LexiconPermissionSet } from './include-scope'

describe('IncludeScope', () => {
  describe('static', () => {
    describe('fromString', () => {
      describe('enables', () => {
        it('parsing of positional nsid', () => {
          expect(
            IncludeScope.fromString('include:com.example.bar'),
          ).toMatchObject({
            nsid: 'com.example.bar',
            aud: undefined,
          })
        })

        it('parsing of positional nsid and aud param', () => {
          expect(
            IncludeScope.fromString(
              'include:com.example.baz?aud=did:web:example.com%23my_service',
            ),
          ).toMatchObject({
            nsid: 'com.example.baz',
            aud: 'did:web:example.com#my_service',
          })
        })

        it('parsing of # character in query string', () => {
          expect(
            IncludeScope.fromString(
              'include:com.example.baz?aud=did:web:example.com#my_service',
            ),
          ).toMatchObject({
            nsid: 'com.example.baz',
            aud: 'did:web:example.com#my_service',
          })
        })

        it('parsing of named nsid', () => {
          expect(
            IncludeScope.fromString('include?nsid=com.example.baz'),
          ).toMatchObject({
            nsid: 'com.example.baz',
            aud: undefined,
          })
        })

        it('parsing of named nsid and aud', () => {
          expect(
            IncludeScope.fromString(
              'include?aud=did:web:example.com%23my_service&nsid=com.example.baz',
            ),
          ).toMatchObject({
            nsid: 'com.example.baz',
            aud: 'did:web:example.com#my_service',
          })
        })
      })

      describe('rejects', () => {
        for (const invalid of [
          '',
          'repo:com.example.baz',
          'include',
          'include#',

          // Invalid NSID
          'include:',
          'include:#',
          'include:&',
          'include:com..example',
          'include:com',
          'include:com.example',
          'include:9com.example.foo',
          'include:com.example.-bar',
          'include:invalid^nsid',
          'include:nsid',

          // Invalid AUD
          'include:com.example.baz?aud=',
          'include:com.example.baz?aud=did:web:example.com',
          'include:com.example.baz?aud=invalid^did',
          'include:com.example.baz?aud=invalid^did',
        ]) {
          it(JSON.stringify(invalid), () => {
            expect(IncludeScope.fromString(invalid)).toBeNull()
          })
        }
      })
    })
  })

  describe('instance', () => {
    describe('toString', () => {
      describe('enables', () => {
        it('formating of scope without aud', () => {
          expect(new IncludeScope('com.example.foo').toString()).toEqual(
            'include:com.example.foo',
          )
        })
        it('formating of scope with aud', () => {
          expect(
            new IncludeScope(
              'com.example.foo',
              'did:web:example.com#my_service',
            ).toString(),
          ).toEqual(
            'include:com.example.foo?aud=did:web:example.com%23my_service',
          )
        })
      })
    })

    describe('isParentAuthorityOf', () => {
      const scope = new IncludeScope('com.example.foo.auth')

      describe('enables', () => {
        it('same authority', () => {
          expect(scope.isParentAuthorityOf('com.example.foo.identifier')).toBe(
            true,
          )
        })

        it('child authorities', () => {
          expect(scope.isParentAuthorityOf('com.example.foo.bar.baz')).toBe(
            true,
          )
          expect(scope.isParentAuthorityOf('com.example.foo.bar.baz.quz')).toBe(
            true,
          )
        })
      })

      describe('rejects', () => {
        it('invalid nsids', () => {
          // @ts-expect-error
          expect(scope.isParentAuthorityOf('com')).toBe(false)
          // @ts-expect-error
          expect(scope.isParentAuthorityOf('com.example')).toBe(false)
        })

        it('siblings of root domain', () => {
          expect(scope.isParentAuthorityOf('com.example.bar')).toBe(false)
          expect(scope.isParentAuthorityOf('com.example.bar.foo')).toBe(false)
          expect(scope.isParentAuthorityOf('com.example.bar.qux')).toBe(false)
        })

        it('other domains', () => {
          expect(scope.isParentAuthorityOf('com.atproto.foo')).toBe(false)
          expect(scope.isParentAuthorityOf('com.atproto.foo.auth')).toBe(false)
          expect(scope.isParentAuthorityOf('com.atproto.foo.bar')).toBe(false)
          expect(scope.isParentAuthorityOf('com.atproto.foo.bar')).toBe(false)
        })
      })
    })

    describe('buildPermissions', () => {
      /**
       * Utility that transforms a (valid) "include:<nsid>" scope and matching
       * (resolved) permission set into the list of permission scopes.
       */
      const compilePermissions = (
        scope: ScopeStringFor<'include'>,
        permissionSet: LexiconPermissionSet,
      ) => IncludeScope.fromString(scope)!.toScopes(permissionSet)

      describe('blob', () => {
        describe('rejects', () => {
          it('valid permissions', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'blob',
                    accept: ['image/*'],
                  },
                ],
              }),
            ).toEqual([])
          })

          it('invalid permissions', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'blob',
                    accept: 'image/*',
                  },
                ],
              }),
            ).toEqual([])

            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'blob',
                    accept: ['image/*'],
                    extra: 'property',
                  },
                ],
              }),
            ).toEqual([])
          })
        })
      })

      describe('rpc', () => {
        describe('enables', () => {
          it('allows * aud', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                    aud: '*',
                    lxm: ['com.example.calendar.listEvents'],
                  },
                ],
              }),
            ).toEqual(['rpc:com.example.calendar.listEvents?aud=*'])
          })

          it('inherits aud', () => {
            expect(
              compilePermissions(
                'include:com.example.calendar.auth?aud=did:web:example.com#foo',
                {
                  type: 'permission-set',
                  permissions: [
                    {
                      type: 'permission',
                      resource: 'rpc',
                      inheritAud: true,
                      lxm: ['com.example.calendar.listEvents'],
                    },
                    {
                      type: 'permission',
                      resource: 'rpc',
                      inheritAud: true,
                      lxm: ['com.example.calendar.getEventDetails'],
                    },
                  ],
                },
              ),
            ).toEqual([
              'rpc:com.example.calendar.listEvents?aud=did:web:example.com%23foo',
              'rpc:com.example.calendar.getEventDetails?aud=did:web:example.com%23foo',
            ])
          })
        })

        describe('rejects', () => {
          it('forbids use of specific "aud"', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                    aud: 'did:web:example.com#foo',
                    lxm: ['com.example.calendar.listEvents'],
                  },
                ],
              }),
            ).toEqual([])
          })

          it('invalid "lxm" syntax', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                    aud: 'did:web:example.com#foo',
                    lxm: 'com.example.calendar.listEvents',
                  },
                ],
              }),
            ).toEqual([])
          })

          it('extra properties', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                    aud: 'did:web:example.com#foo',
                    lxm: ['com.example.calendar.listEvents'],
                    extra: 'property',
                  },
                ],
              }),
            ).toEqual([])
          })

          it('missing "lxm"', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                    aud: 'did:web:example.com#foo',
                  },
                ],
              }),
            ).toEqual([])
          })

          it('missing "aud"', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                    lxm: ['com.example.calendar.listEvents'],
                  },
                ],
              }),
            ).toEqual([])
          })

          it('missing "aud" and "lxm"', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                  },
                ],
              }),
            ).toEqual([])
          })

          it('both "inheritAud" and "aud" specified', () => {
            expect(
              compilePermissions(
                'include:com.example.calendar.auth?aud=did:web:example.com#bar',
                {
                  type: 'permission-set',
                  permissions: [
                    {
                      type: 'permission',
                      resource: 'rpc',
                      aud: 'did:web:example.com#foo',
                      inheritAud: true,
                      lxm: ['com.example.calendar.listEvents'],
                    },
                  ],
                },
              ),
            ).toEqual([])
          })

          it('invalid authority', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                    aud: 'did:web:example.com#foo',
                    lxm: ['com.atproto.moderation.createReport'],
                  },
                ],
              }),
            ).toEqual([])
          })

          it('un-specified inherited-aud', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                    inheritAud: true,
                    lxm: ['com.example.calendar.listEvents'],
                  },
                ],
              }),
            ).toEqual([])
          })

          it('wildcard-aud', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                    aud: '*',
                    lxm: ['com.example.calendar.listEvents'],
                  },
                ],
              }),
            ).toEqual(['rpc:com.example.calendar.listEvents?aud=*'])
          })

          it('wildcard-aud for invalid authority', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'rpc',
                    aud: '*',
                    lxm: ['com.atproto.moderation.createReport'],
                  },
                ],
              }),
            ).toEqual([])
          })
        })
      })

      describe('repo', () => {
        describe('enabled', () => {
          it('valid permission', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'repo',
                    collection: ['com.example.calendar.event'],
                    action: ['create', 'update', 'delete'],
                  },
                ],
              }),
            ).toEqual(['repo:com.example.calendar.event'])
          })

          it('valid permission with partial actions', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'repo',
                    collection: ['com.example.calendar.event'],
                    action: ['delete', 'update'],
                  },
                  {
                    type: 'permission',
                    resource: 'repo',
                    collection: [
                      'com.example.calendar.event',
                      'com.example.calendar.rsvp',
                    ],
                    action: ['delete', 'create'],
                  },
                ],
              }),
            ).toEqual([
              'repo:com.example.calendar.event?action=update&action=delete',
              'repo?collection=com.example.calendar.event&collection=com.example.calendar.rsvp&action=create&action=delete',
            ])
          })
        })

        describe('rejects', () => {
          it('invalid "collection" syntax', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'repo',
                    collection: 'com.example.calendar.event',
                    action: ['create', 'update', 'delete'],
                  },
                ],
              }),
            ).toEqual([])
          })

          it('invalid "action" syntax', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'repo',
                    collection: ['com.example.calendar.event'],
                    action: 'all',
                  },
                ],
              }),
            ).toEqual([])
          })

          it('invalid "action" values', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'repo',
                    collection: ['com.example.calendar.event'],
                    action: ['create', 'update', 'manage'],
                  },
                ],
              }),
            ).toEqual([])
          })

          it('invalid authority', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'repo',
                    collection: ['app.bsky.feed.post'],
                    action: ['create', 'update', 'delete'],
                  },
                ],
              }),
            ).toEqual([])
          })

          it('permissions with one valid and one invalid authority', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [
                  {
                    type: 'permission',
                    resource: 'repo',
                    collection: [
                      'com.example.calendar.event',
                      'app.bsky.feed.post',
                    ],
                    action: ['create', 'update', 'delete'],
                  },
                ],
              }),
            ).toEqual([])
          })
        })
      })

      describe('account', () => {
        const permission = {
          type: 'permission',
          resource: 'account',
          attr: 'email',
          action: ['read'],
        } as const

        it('parses valid permission syntax', () => {
          // Just to make sure that the test bellow doesn't give a false negative
          const syntax = new LexPermissionSyntax(permission)
          expect(AccountPermission.fromSyntax(syntax)).toMatchObject({
            constructor: AccountPermission,
            attr: 'email',
            action: ['read'],
          })
        })

        describe('rejects', () => {
          it('account permissions', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [permission],
              }),
            ).toEqual([])
          })
        })
      })

      describe('identity', () => {
        const permission = {
          type: 'permission',
          resource: 'identity',
          attr: 'handle',
        } as const

        it('parses valid permission syntax', () => {
          // Just to make sure that the test bellow doesn't give a false negative
          const syntax = new LexPermissionSyntax(permission)
          expect(IdentityPermission.fromSyntax(syntax)).toMatchObject({
            constructor: IdentityPermission,
            attr: 'handle',
          })
        })

        describe('rejects', () => {
          it('identity permissions', () => {
            expect(
              compilePermissions('include:com.example.calendar.auth', {
                type: 'permission-set',
                permissions: [permission],
              }),
            ).toEqual([])
          })
        })
      })
    })
  })
})
