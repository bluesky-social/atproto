import { allComplete, createDeferrables } from '@atproto/common'
import { Database } from '../src'

describe('db', () => {
  let dbOne: Database
  let dbTwo: Database

  beforeAll(async () => {
    if (process.env.DB_POSTGRES_URL) {
      dbOne = Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'db_notify',
      })
      dbTwo = Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'db_notify',
      })
      await dbOne.startListeningToChannels()
      await dbTwo.startListeningToChannels()
    } else {
      // in the sqlite case, we just use two references to the same db
      dbOne = Database.memory()
      dbTwo = dbOne
    }
  })

  afterAll(async () => {
    await dbOne.close()
    await dbTwo.close()
  })

  it('notifies', async () => {
    const sendCount = 5
    const deferrables = createDeferrables(sendCount)
    let receivedCount = 0
    dbOne.channels.repo_seq.addListener('message', () => {
      deferrables[receivedCount]?.resolve()
      receivedCount++
    })

    for (let i = 0; i < sendCount; i++) {
      dbTwo.notify('repo_seq')
    }

    await allComplete(deferrables)
    expect(receivedCount).toBe(sendCount)
  })

  it('can notifies multiple listeners', async () => {
    const sendCount = 5
    const deferrables = createDeferrables(sendCount * 2)
    let receivedOne = 0
    let receivedTwo = 0
    dbOne.channels.repo_seq.addListener('message', () => {
      deferrables[receivedOne]?.resolve()
      receivedOne++
    })
    dbOne.channels.repo_seq.addListener('message', () => {
      deferrables[receivedTwo + sendCount]?.resolve()
      receivedTwo++
    })

    for (let i = 0; i < sendCount; i++) {
      dbTwo.notify('repo_seq')
    }

    await allComplete(deferrables)
    expect(receivedOne).toBe(sendCount)
    expect(receivedTwo).toBe(sendCount)
  })
})
