import { describe, expect, it } from 'vitest'
import { listSpacePermissions } from './atproto-oauth-scope.js'
import type { LexiconPermissionSet } from './lib/lexicon.js'

describe(listSpacePermissions, () => {
  const DID = 'did:plc:abc123'

  const permissionSets = new Map<string, LexiconPermissionSet>([
    [
      'com.example.forum.basePermissions',
      {
        type: 'permission-set',
        permissions: [
          {
            type: 'permission',
            resource: 'space',
            spaceType: 'com.example.forum.space',
            authority: '*',
          },
          {
            type: 'permission',
            resource: 'repo',
            collection: ['com.example.forum.post'],
          },
        ],
      },
    ],
  ])

  it('lists space scopes and the space permissions of included sets', () => {
    const permissions = listSpacePermissions(
      [
        'atproto',
        'repo:com.example.post',
        `space:*?authority=${DID}`,
        'include:com.example.forum.basePermissions',
      ],
      (nsid) => permissionSets.get(nsid),
    )

    expect(permissions.map(String)).toEqual([
      `space:*?authority=${DID}`,
      'space:com.example.forum.space?authority=*',
    ])
  })

  it('skips included sets that are not provided', () => {
    expect(
      listSpacePermissions(['include:com.example.forum.basePermissions']),
    ).toEqual([])
  })
})
