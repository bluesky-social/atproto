import { LexPermissionSyntax } from '../syntax'
import { LexPermissionSet } from '../types'
import { AccountPermission } from './account-permission'
import { BlobPermission, BlobPermissionMatch } from './blob-permission'
import { IdentityPermission } from './identity-permission'
import { IncludeScope } from './include-scope'
import { RepoPermission, RepoPermissionMatch } from './repo-permission'
import { RpcPermission, RpcPermissionMatch } from './rpc-permission'

const isRpcPermMatching = (match: RpcPermissionMatch) => (perm: unknown) =>
  perm instanceof RpcPermission && perm.matches(match)
const isRepoPermMatching = (match: RepoPermissionMatch) => (perm: unknown) =>
  perm instanceof RepoPermission && perm.matches(match)
const isBlobPermMatching = (match: BlobPermissionMatch) => (perm: unknown) =>
  perm instanceof BlobPermission && perm.matches(match)

describe('IncludeScope', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('parses positional nsid', () => {
        expect(
          IncludeScope.fromString('include:com.example.bar'),
        ).toMatchObject({
          nsid: 'com.example.bar',
          aud: undefined,
        })
      })

      it('parses positional nsid and aud param', () => {
        expect(
          IncludeScope.fromString(
            'include:com.example.baz?aud=did:web:example.com%23my_service',
          ),
        ).toMatchObject({
          nsid: 'com.example.baz',
          aud: 'did:web:example.com#my_service',
        })
      })

      it('allows # character in query string', () => {
        expect(
          IncludeScope.fromString(
            'include:com.example.baz?aud=did:web:example.com#my_service',
          ),
        ).toMatchObject({
          nsid: 'com.example.baz',
          aud: 'did:web:example.com#my_service',
        })
      })

      it('parses named nsid', () => {
        expect(
          IncludeScope.fromString('include?nsid=com.example.baz'),
        ).toMatchObject({
          nsid: 'com.example.baz',
          aud: undefined,
        })
      })

      it('parses named nsid and aud', () => {
        expect(
          IncludeScope.fromString(
            'include?aud=did:web:example.com%23my_service&nsid=com.example.baz',
          ),
        ).toMatchObject({
          nsid: 'com.example.baz',
          aud: 'did:web:example.com#my_service',
        })
      })

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
        'include:com.example',
        'include:com.example.-bar',
        'include:invalid^nsid',
        'include:nsid',

        // Invalid AUD
        'include:com.example.baz?aud=',
        'include:com.example.baz?aud=did:web:example.com',
        'include:com.example.baz?aud=invalid^did',
        'include:com.example.baz?aud=invalid^did',
      ]) {
        it(`rejects invalid scope string: ${invalid}`, () => {
          expect(IncludeScope.fromString(invalid)).toBeNull()
        })
      }
    })
  })

  describe('instance', () => {
    describe('toString', () => {
      it('formats scope without aud', () => {
        const scope = new IncludeScope('com.example.foo')
        expect(scope.toString()).toEqual('include:com.example.foo')
      })
      it('formats scope with aud', () => {
        const scope = new IncludeScope(
          'com.example.foo',
          'did:web:example.com#my_service',
        )
        expect(scope.toString()).toEqual(
          'include:com.example.foo?aud=did:web:example.com%23my_service',
        )
      })
    })

    describe('toPermissions', () => {
      describe('blob resource', () => {
        const permissionSet: LexPermissionSet = {
          type: 'permission-set',
          permissions: [
            {
              type: 'permission',
              resource: 'blob',
              accept: ['image/*'],
            },
            {
              type: 'permission',
              resource: 'blob',
              accept: 'text/*', // invalid (only array expected)
            },
            {
              type: 'permission',
              resource: 'blob',
              accept: ['application/json'],
              foo: 'bar', // extra property, whole permission should be ignored
            },
          ],
        }

        it('enables blob permissions', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(isBlobPermMatching({ mime: 'image/png' })),
          ).toBe(true)
        })

        it('ignores non covered mimes', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(isBlobPermMatching({ mime: 'video/mp4' })),
          ).toBe(false)
        })

        it('ignores permission with incorrectly encoded params', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(isBlobPermMatching({ mime: 'text/html' })),
          ).toBe(false)
        })

        it('ignores blob permission with unknown fields', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(isBlobPermMatching({ mime: 'application/json' })),
          ).toBe(false)
        })
      })

      describe('rpc resource', () => {
        const permissionSet: LexPermissionSet = {
          type: 'permission-set',
          permissions: [
            {
              type: 'permission',
              resource: 'rpc',
              inheritAud: true,
              lxm: [
                'com.example.calendar.listEvents',
                'com.example.calendar.getEventDetails', // has a default value (see bellow)
              ],
            },
            {
              type: 'permission',
              resource: 'rpc',
              aud: 'did:web:calendar.example.com#calendar_appview',
              lxm: ['com.example.calendar.getEventDetails'],
            },
            {
              type: 'permission',
              resource: 'rpc',
              aud: '*',
              lxm: ['com.atproto.moderation.createReport'],
            },
            {
              type: 'permission',
              resource: 'rpc',
              inheritAud: true,
              lxm: ['app.bsky.feed.getFeed'],
            },
            {
              type: 'permission',
              resource: 'rpc',
              aud: 'did:web:api.bsky.app#appview',
              lxm: ['app.bsky.feed.getFeedSkeleton'],
            },
            {
              type: 'permission',
              resource: 'rpc',
              inheritAud: true,
              lxm: [
                'com.example.calendar.listTheParties',
                'app.bsky.feed.getFeedSkeleton',
              ],
            },
          ],
        }

        it('matches rpc methods from the same authority, inheriting aud', () => {
          expect(
            new IncludeScope(
              'com.example.calendar.auth',
              'did:web:example.com#foo',
            )
              .toPermissions(permissionSet)
              .some(
                isRpcPermMatching({
                  aud: 'did:web:example.com#foo',
                  lxm: 'com.example.calendar.listEvents',
                }),
              ),
          ).toBe(true)
        })

        it('matches rpc methods from the same authority, with default aud', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(
                isRpcPermMatching({
                  aud: 'did:web:calendar.example.com#calendar_appview',
                  lxm: 'com.example.calendar.getEventDetails',
                }),
              ),
          ).toBe(true)
        })

        it('ignores unspecified inherited aud', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(
                isRpcPermMatching({
                  aud: 'did:web:calendar.example.com#calendar_appview',
                  lxm: 'com.example.calendar.listEvents',
                }),
              ),
          ).toBe(false)

          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(
                isRpcPermMatching({
                  aud: 'did:web:example.com#foo',
                  lxm: 'com.example.calendar.listEvents',
                }),
              ),
          ).toBe(false)
        })

        it('allows wildcard aud, given the right context authority', () => {
          expect(
            new IncludeScope('com.atproto.auth')
              .toPermissions(permissionSet)
              .some(
                isRpcPermMatching({
                  aud: 'did:web:example.com#foo',
                  lxm: 'com.atproto.moderation.createReport',
                }),
              ),
          ).toBe(true)
        })

        it('ignores wildcard aud for invalid context authority', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(
                isRpcPermMatching({
                  aud: 'did:web:example.com#foo',
                  lxm: 'com.atproto.moderation.createReport',
                }),
              ),
          ).toBe(false)
        })

        it('nots inherit aud for invalid nsid', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(
                isRpcPermMatching({
                  aud: 'did:web:example.com#foo',
                  lxm: 'app.bsky.feed.getFeed',
                }),
              ),
          ).toBe(false)
        })

        it('ignores permission items that contain a least one invalid authority', () => {
          expect(
            new IncludeScope(
              'com.example.calendar.auth',
              'did:web:example.com#foo',
            )
              .toPermissions(permissionSet)
              .some(
                isRpcPermMatching({
                  aud: 'did:web:example.com#foo',
                  lxm: 'com.example.calendar.listTheParties',
                }),
              ),
          ).toBe(false)
        })

        it('ignores permission items with hard coded aud and invalid authority nsid', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(
                isRpcPermMatching({
                  aud: 'did:web:api.bsky.app#appview',
                  lxm: 'app.bsky.feed.getFeedSkeleton',
                }),
              ),
          ).toBe(false)
        })
      })

      describe('repo resource', () => {
        const permissionSet: LexPermissionSet = {
          type: 'permission-set',
          permissions: [
            {
              type: 'permission',
              resource: 'repo',
              collection: ['com.example.calendar.event'],
              action: ['create', 'update', 'delete'],
            },
            {
              type: 'permission',
              resource: 'repo',
              collection: ['app.bsky.feed.post'],
              action: ['create', 'update', 'delete'],
            },
            {
              type: 'permission',
              resource: 'repo',
              collection: ['com.example.calendar.rsvp', 'app.bsky.feed.like'],
              action: ['create', 'update', 'delete'],
            },
          ],
        }

        it('matches repo collections from the same authority', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(
                isRepoPermMatching({
                  action: 'create',
                  collection: 'com.example.calendar.event',
                }),
              ),
          ).toBe(true)
        })

        it('ignores repo collections from other authorities', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(
                isRepoPermMatching({
                  action: 'create',
                  collection: 'app.bsky.feed.post',
                }),
              ),
          ).toBe(false)

          expect(
            new IncludeScope('com.example.bar.auth').toPermissions(
              permissionSet,
            ).length,
          ).toBe(0)

          expect(
            new IncludeScope('com.example.calendar.baz.auth').toPermissions(
              permissionSet,
            ).length,
          ).toBe(0)

          expect(
            new IncludeScope('com.bar.auth').toPermissions(permissionSet)
              .length,
          ).toBe(0)
        })

        it('ignores permission items that contain a least one invalid authority', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(
                isRepoPermMatching({
                  action: 'create',
                  collection: 'com.example.calendar.rsvp',
                }),
              ),
          ).toBe(false)
        })
      })

      describe('account resources', () => {
        const permissionSet: LexPermissionSet = {
          type: 'permission-set',
          permissions: [
            {
              type: 'permission',
              resource: 'account',
              attr: 'email',
              action: 'read',
            },
          ],
        }

        it('is a valid permission', () => {
          // Just to make sure that the test bellow doesn't give a false negative
          const syntax = new LexPermissionSyntax(permissionSet.permissions[0]!)
          expect(AccountPermission.fromSyntax(syntax)).toMatchObject({
            attr: 'email',
            action: 'read',
          })
        })

        it('does not allow account permissions', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some((perm) => perm instanceof AccountPermission),
          ).toBe(false)
        })
      })

      describe('identity resources', () => {
        const permissionSet: LexPermissionSet = {
          type: 'permission-set',
          permissions: [
            {
              type: 'permission',
              resource: 'identity',
              attr: 'handle',
            },
          ],
        }

        it('is a valid permission', () => {
          // Just to make sure that the test bellow doesn't give a false negative
          const syntax = new LexPermissionSyntax(permissionSet.permissions[0]!)
          expect(IdentityPermission.fromSyntax(syntax)).toMatchObject({
            attr: 'handle',
          })
        })

        it('does not allow identity permissions', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some((perm) => perm instanceof IdentityPermission),
          ).toBe(false)
        })
      })
    })
  })
})
