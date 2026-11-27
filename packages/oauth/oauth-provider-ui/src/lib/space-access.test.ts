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
        manage: new Set(['update']),
        writes: new Map(),
      }),
      expect.objectContaining({
        type: 'com.example.forum',
        authority: DID,
        authorityHandle: 'protocol-nerds.atmoboards.com',
        level: 'authority',
        read: true,
        readSelf: false,
        manage: new Set(),
        writes: new Map([
          [
            'com.example.thread',
            { create: true, update: false, delete: false },
          ],
        ]),
      }),
    ])
  })

  it('keeps each manage operation granted', () => {
    const [row] = buildSpaceAccessRows([
      parse(`space:com.example.forum?authority=${DID}&manage=update`),
      parse(`space:com.example.forum?authority=${DID}&manage=delete`),
    ])

    expect(row?.manage).toEqual(new Set(['update', 'delete']))
  })

  it("treats a grant naming the user's DID as one on their own spaces", () => {
    const rows = buildSpaceAccessRows(
      [
        parse(`space:com.example.forum?authority=${DID}&action=read`),
        parse('space:com.example.forum?authority=self&manage=update'),
      ],
      { userDid: DID },
    )

    expect(rows).toEqual([
      expect.objectContaining({
        authority: 'self',
        level: 'broad',
        read: true,
      }),
    ])
  })

  it('tells an unverified authority apart from one never looked up', () => {
    const scope = [parse(`space:*?authority=${DID}`)]

    expect(buildSpaceAccessRows(scope, { spaceHandles: {} })[0]).toEqual(
      expect.objectContaining({ level: 'authority', authorityHandle: null }),
    )
    expect(buildSpaceAccessRows(scope)[0]?.authorityHandle).toBeUndefined()
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
