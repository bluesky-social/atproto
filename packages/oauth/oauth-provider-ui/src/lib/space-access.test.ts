import { describe, expect, it } from 'vitest'
import { SpacePermission } from '@atproto/oauth-scopes'
import {
  buildSpaceAccessRows,
  clientHostname,
  highestSpaceAccessLevel,
  listSpacePermissions,
  spaceAccessLevel,
} from './space-access.ts'

const DID = 'did:plc:abc123'
const CLIENT_ID = 'https://atmoboards.com/oauth-client-metadata.json'

const parse = (scope: string) => {
  const permission = SpacePermission.fromString(scope)
  if (!permission) throw new Error(`Invalid space scope: ${scope}`)
  return permission
}

describe(spaceAccessLevel, () => {
  const context = {
    clientId: CLIENT_ID,
    spaceHandles: { [DID]: 'atmoboards.com' },
  }

  it('rates every space on the network as universal', () => {
    expect(spaceAccessLevel(parse('space:*?authority=*'), context)).toBe(
      'universal',
    )
  })

  it('rates one space type under any authority as broad', () => {
    expect(
      spaceAccessLevel(parse('space:com.example.forum?authority=*'), context),
    ).toBe('broad')
  })

  it("rates the user's own spaces as broad", () => {
    expect(spaceAccessLevel(parse('space:*?authority=self'), context)).toBe(
      'broad',
    )
    // `self` is the default authority
    expect(spaceAccessLevel(parse('space:com.example.forum'), context)).toBe(
      'broad',
    )
  })

  it("rates spaces on the client's own hostname as client", () => {
    expect(spaceAccessLevel(parse(`space:*?authority=${DID}`), context)).toBe(
      'client',
    )
    expect(
      spaceAccessLevel(
        parse(`space:com.example.forum?authority=${DID}`),
        context,
      ),
    ).toBe('client')
  })

  it('compares the handle case-insensitively', () => {
    expect(
      spaceAccessLevel(parse(`space:*?authority=${DID}`), {
        clientId: CLIENT_ID,
        spaceHandles: { [DID]: 'AtmoBoards.com' },
      }),
    ).toBe('client')
  })

  it('rates spaces on another authority as authority', () => {
    expect(
      spaceAccessLevel(parse(`space:*?authority=${DID}`), {
        clientId: CLIENT_ID,
        spaceHandles: { [DID]: 'protocol-nerds.atmoboards.com' },
      }),
    ).toBe('authority')
  })

  it('rates an authority whose handle did not resolve as authority', () => {
    expect(
      spaceAccessLevel(parse(`space:*?authority=${DID}`), {
        clientId: CLIENT_ID,
      }),
    ).toBe('authority')
  })

  it('requires a conventional client id to match the hostname', () => {
    for (const clientId of [
      'https://atmoboards.com/other/client-metadata.json',
      'https://atmoboards.com:8443/oauth-client-metadata.json',
      'https://atmoboards.com/oauth-client-metadata.json?v=1',
      'http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%2F',
    ]) {
      expect(
        spaceAccessLevel(parse(`space:*?authority=${DID}`), {
          clientId,
          spaceHandles: { [DID]: 'atmoboards.com' },
        }),
      ).toBe('authority')
    }
  })

  it('rates nothing as client without a client id', () => {
    expect(
      spaceAccessLevel(parse(`space:*?authority=${DID}`), {
        spaceHandles: { [DID]: 'atmoboards.com' },
      }),
    ).toBe('authority')
  })
})

describe(clientHostname, () => {
  it('returns the hostname of a conventional client id', () => {
    expect(clientHostname(CLIENT_ID)).toBe('atmoboards.com')
  })

  it('returns null for any other client id', () => {
    expect(clientHostname(undefined)).toBeNull()
    expect(clientHostname('not a url')).toBeNull()
    expect(clientHostname('https://atmoboards.com/client.json')).toBeNull()
  })
})

describe(listSpacePermissions, () => {
  const permissionSets = {
    'com.example.forum.basePermissions': {
      type: 'permission-set' as const,
      permissions: [
        {
          type: 'permission' as const,
          resource: 'space',
          spaceType: 'com.example.forum.space',
          authority: '*',
        },
        {
          type: 'permission' as const,
          resource: 'repo',
          collection: ['com.example.forum.post'],
        },
      ],
    },
  }

  it('lists space scopes and the space permissions of included sets', () => {
    const permissions = listSpacePermissions(
      [
        'atproto',
        'repo:com.example.post',
        `space:*?authority=${DID}`,
        'include:com.example.forum.basePermissions',
      ],
      permissionSets,
    )

    expect(permissions.map(String)).toEqual([
      `space:*?authority=${DID}`,
      'space:com.example.forum.space?authority=*',
    ])
  })

  it('skips included sets that are not known', () => {
    expect(
      listSpacePermissions(['include:com.example.forum.basePermissions']),
    ).toEqual([])
  })
})

describe(buildSpaceAccessRows, () => {
  it('merges grants on the same space and rates each row', () => {
    const rows = buildSpaceAccessRows(
      [
        parse(`space:com.example.forum?authority=${DID}&action=read`),
        parse(
          `space:com.example.forum?authority=${DID}&action=create&collection=com.example.thread`,
        ),
        parse('space:*?authority=*&action=read_self&manage=update'),
      ],
      {
        clientId: CLIENT_ID,
        spaceHandles: { [DID]: 'protocol-nerds.atmoboards.com' },
      },
    )

    expect(rows).toEqual([
      expect.objectContaining({
        type: '*',
        authority: '*',
        level: 'universal',
        read: false,
        readSelf: true,
        manage: true,
        writes: new Map(),
      }),
      expect.objectContaining({
        type: 'com.example.forum',
        authority: DID,
        authorityHandle: 'protocol-nerds.atmoboards.com',
        level: 'authority',
        read: true,
        readSelf: false,
        manage: false,
        writes: new Map([
          [
            'com.example.thread',
            { create: true, update: false, delete: false },
          ],
        ]),
      }),
    ])
  })

  it('ignores collections on grants that do not write', () => {
    const [row] = buildSpaceAccessRows([
      parse(
        `space:com.example.forum?authority=${DID}&action=read&collection=com.example.thread`,
      ),
    ])

    expect(row?.read).toBe(true)
    expect(row?.writes).toEqual(new Map())
  })

  it("applies the space declaration's default collections", () => {
    const [row] = buildSpaceAccessRows(
      [parse(`space:com.example.forum?authority=${DID}`)],
      {
        spaces: {
          'com.example.forum': {
            type: 'space',
            collections: ['com.example.thread'],
          },
        },
      },
    )

    expect(row?.writes).toEqual(
      new Map([
        ['com.example.thread', { create: true, update: true, delete: true }],
      ]),
    )
  })
})

describe(highestSpaceAccessLevel, () => {
  it('returns null when there is no space access', () => {
    expect(highestSpaceAccessLevel([])).toBeNull()
  })

  it('returns the most alarming level present', () => {
    const rows = buildSpaceAccessRows(
      [
        parse(`space:*?authority=${DID}`),
        parse('space:com.example.forum?authority=*'),
        parse('space:com.example.chat?authority=did:plc:other'),
      ],
      { clientId: CLIENT_ID, spaceHandles: { [DID]: 'atmoboards.com' } },
    )

    expect(rows.map((row) => row.level).sort()).toEqual([
      'authority',
      'broad',
      'client',
    ])
    expect(highestSpaceAccessLevel(rows)).toBe('broad')
  })
})
