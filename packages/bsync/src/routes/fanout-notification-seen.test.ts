import { Timestamp } from '@bufbuild/protobuf'
import { Code } from '@connectrpc/connect'
import { describe, expect, it, vi } from 'vitest'
import type { DataplaneClient } from '../dataplane.js'
import { UpdateNotificationSeenResponse } from '../proto/dataplane_pb.js'
import { createTestClient, isConnectError } from './_test-client.test.js'

describe('fanoutNotificationSeen', () => {
  it('updates every configured dataplane', async () => {
    using first = updateNotificationSeen()
    using second = updateNotificationSeen()
    const client = createTestClient({
      dataplaneClients: [
        { updateNotificationSeen: first },
        { updateNotificationSeen: second },
      ],
    })
    const timestamp = Timestamp.fromDate(new Date('2026-09-04T12:00:00Z'))

    await client.fanoutNotificationSeen({
      actorDid: 'did:example:alice',
      timestamp,
    })

    for (const update of [first, second]) {
      expect(update).toHaveBeenCalledExactlyOnceWith({
        actorDid: 'did:example:alice',
        timestamp,
      })
    }
  })

  it('succeeds when one dataplane fails', async () => {
    using first = updateNotificationSeen(new Error('unavailable'))
    using second = updateNotificationSeen()
    const client = createTestClient({
      dataplaneClients: [
        { updateNotificationSeen: first },
        { updateNotificationSeen: second },
      ],
    })

    await expect(
      client.fanoutNotificationSeen({
        actorDid: 'did:example:alice',
        timestamp: Timestamp.now(),
      }),
    ).resolves.toBeDefined()
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it('fails when every dataplane fails', async () => {
    using first = updateNotificationSeen(new Error('unavailable'))
    using second = updateNotificationSeen(new Error('unavailable'))
    const client = createTestClient({
      dataplaneClients: [
        { updateNotificationSeen: first },
        { updateNotificationSeen: second },
      ],
    })

    await expect(
      client.fanoutNotificationSeen({
        actorDid: 'did:example:alice',
        timestamp: Timestamp.now(),
      }),
    ).rejects.toSatisfy(
      isConnectError('all dataplane updates failed', Code.Unavailable),
    )
  })

  it('succeeds when no dataplanes are configured', async () => {
    const client = createTestClient({ dataplaneClients: [] })

    await expect(
      client.fanoutNotificationSeen({
        actorDid: 'did:example:alice',
        timestamp: Timestamp.now(),
      }),
    ).resolves.toBeDefined()
  })
})

function updateNotificationSeen(error?: Error) {
  return vi.fn<DataplaneClient['updateNotificationSeen']>(async () => {
    if (error) throw error
    return new UpdateNotificationSeenResponse()
  })
}
