import { getQueueIdFromModTool } from '../src/queue/service.js'

describe('getQueueIdFromModTool', () => {
  it('returns the queue id when present as a positive integer', () => {
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { rules: ['r1'], queueId: 7 },
      }),
    ).toBe(7)
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: 1 },
      }),
    ).toBe(1)
  })

  it('returns undefined for a null modTool', () => {
    expect(getQueueIdFromModTool(null)).toBeUndefined()
  })

  it('returns undefined when meta is absent', () => {
    expect(getQueueIdFromModTool({ name: 'osprey-effector' })).toBeUndefined()
  })

  it('returns undefined when queueId is missing from meta', () => {
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { rules: ['r1'] },
      }),
    ).toBeUndefined()
  })

  it('returns undefined for a numeric string (untrusted input)', () => {
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: '7' },
      }),
    ).toBeUndefined()
  })

  it('returns undefined for non-integer numbers', () => {
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: 7.5 },
      }),
    ).toBeUndefined()
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: NaN },
      }),
    ).toBeUndefined()
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: Infinity },
      }),
    ).toBeUndefined()
  })

  it('returns undefined for zero and negative ids', () => {
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: 0 },
      }),
    ).toBeUndefined()
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: -1 },
      }),
    ).toBeUndefined()
  })

  it('returns undefined for other non-number values', () => {
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: null },
      }),
    ).toBeUndefined()
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: undefined },
      }),
    ).toBeUndefined()
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: { nested: 'object' } },
      }),
    ).toBeUndefined()
    expect(
      getQueueIdFromModTool({
        name: 'osprey-effector',
        meta: { queueId: true },
      }),
    ).toBeUndefined()
  })
})
