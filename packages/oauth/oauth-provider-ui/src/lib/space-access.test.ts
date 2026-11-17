import { describe, expect, it } from 'vitest'
import { SpacePermission } from '@atproto/oauth-scopes'
import {
  buildSpaceAccessRows,
  highestSpaceAccessLevel,
  spaceAccessLevel,
} from './space-access.ts'

const DID = 'did:plc:abc123'

const parse = (scope: string) => {
  const permission = SpacePermission.fromString(scope)
  if (!permission) throw new Error(`Invalid space scope: ${scope}`)
  return permission
}

describe(spaceAccessLevel, () => {
  it('rates every space on the network as universal', () => {
    expect(spaceAccessLevel(parse('space:*?authority=*'))).toBe('universal')
  })

  it('rates one space type under any authority as broad', () => {
    expect(spaceAccessLevel(parse('space:com.example.forum?authority=*'))).toBe(
      'broad',
    )
  })

  it("rates the user's own spaces as broad", () => {
    expect(spaceAccessLevel(parse('space:*?authority=self'))).toBe('broad')
    // `self` is the default authority
    expect(spaceAccessLevel(parse('space:com.example.forum'))).toBe('broad')
  })

  it('rates the spaces of one authority as authority, whatever their type', () => {
    expect(spaceAccessLevel(parse(`space:*?authority=${DID}`))).toBe(
      'authority',
    )
    expect(
      spaceAccessLevel(parse(`space:com.example.forum?authority=${DID}`)),
    ).toBe('authority')
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
      { spaceHandles: { [DID]: 'protocol-nerds.atmoboards.com' } },
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

  it('leaves the handle of an unverified authority unset', () => {
    const [row] = buildSpaceAccessRows([parse(`space:*?authority=${DID}`)])

    expect(row?.level).toBe('authority')
    expect(row?.authorityHandle).toBeUndefined()
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
    const rows = buildSpaceAccessRows([
      parse(`space:*?authority=${DID}`),
      parse('space:com.example.forum?authority=*'),
    ])

    expect(rows.map((row) => row.level).sort()).toEqual(['authority', 'broad'])
    expect(highestSpaceAccessLevel(rows)).toBe('broad')
    expect(
      highestSpaceAccessLevel([
        ...rows,
        ...buildSpaceAccessRows([parse('space:*?authority=*')]),
      ]),
    ).toBe('universal')
  })
})
