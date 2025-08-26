import { LexPermissionSet } from '../types'
import { BlobPermission, BlobPermissionMatch } from './blob-permission'
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
      it('should parse valid scope strings', () => {
        const scope1 = IncludeScope.fromString('include:com.example.bar')
        expect(scope1).not.toBeNull()
        expect(scope1?.nsid).toEqual('com.example.bar')
        expect(scope1?.aud).toBeUndefined()

        const scope2 = IncludeScope.fromString(
          'include:com.example.baz?aud=did:web:example.com%23my_service',
        )
        expect(scope2).not.toBeNull()
        expect(scope2?.nsid).toEqual('com.example.baz')
        expect(scope2?.aud).toBe('did:web:example.com#my_service')
      })

      it('should reject invalid nsid', () => {
        expect(IncludeScope.fromString('include:invalid^nsid')).toBeNull()
        expect(IncludeScope.fromString('include:')).toBeNull()
        expect(IncludeScope.fromString('include:com..example')).toBeNull()
        expect(IncludeScope.fromString('include:com.example')).toBeNull()
      })

      it('should reject invalid aud', () => {
        expect(
          IncludeScope.fromString('include:com.example.baz?aud=invalid^did'),
        ).toBeNull()

        expect(
          IncludeScope.fromString('include:com.example.baz?aud='),
        ).toBeNull()

        expect(
          IncludeScope.fromString(
            'include:com.example.baz?aud=did:web:example.com',
          ),
        ).toBeNull()
      })

      it('should reject malformed scope strings', () => {
        expect(IncludeScope.fromString('include:&')).toBeNull()
        expect(IncludeScope.fromString('include')).toBeNull()
        expect(IncludeScope.fromString('')).toBeNull()
        expect(IncludeScope.fromString('include:')).toBeNull()
      })
    })
  })

  describe('instance', () => {
    describe('toString', () => {
      it('should format scope without aud', () => {
        const scope = new IncludeScope('com.example.foo')
        expect(scope.toString()).toEqual('include:com.example.foo')
      })
      it('should format scope with aud', () => {
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
              // blob:image/*
              // blob?accept=image/*&accept=text/*
              accept: ['image/*'],
            },
            {
              type: 'permission',
              resource: 'blob',
              accept: 'text/*',
            },
            {
              type: 'permission',
              resource: 'blob',
              accept: ['application/json'],
              foo: 'bar', // extra property, whole permission should be ignored
            },
          ],
        }

        it('ignored non covered mimes', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(isBlobPermMatching({ mime: 'video/mp4' })),
          ).toBe(false)
        })

        it('enables blob permissions', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(isBlobPermMatching({ mime: 'image/png' })),
          ).toBe(true)
        })

        it('does not allow encoding of permissions as string when they are arrays', () => {
          expect(
            new IncludeScope('com.example.calendar.auth')
              .toPermissions(permissionSet)
              .some(isBlobPermMatching({ mime: 'text/html' })),
          ).toBe(false)
        })

        it('ignores blob permission with unknown values', () => {
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

        it('should match rpc methods from the same authority, inheriting aud', () => {
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

        it('should match rpc methods from the same authority, with default aud', () => {
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

        it('should ignore unspecified inherited aud', () => {
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
        })

        it('should allow aud *, given the right context authority', () => {
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

        it('should ignore rpc methods from other authorities', () => {
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

        it('should not inherit aud for invalid nsid', () => {
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

        it('should match repo collections from the same authority', () => {
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

        it('should ignore repo collections from other authorities', () => {
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
            ),
          ).toEqual([])

          expect(
            new IncludeScope('com.example.calendar.baz.auth').toPermissions(
              permissionSet,
            ),
          ).toEqual([])

          expect(
            new IncludeScope('com.bar.auth').toPermissions(permissionSet),
          ).toEqual([])
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

      describe('other resources', () => {})
    })
  })
})
