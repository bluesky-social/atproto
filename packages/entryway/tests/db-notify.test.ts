import { allComplete, createDeferrables, wait } from '@atproto/common'
import { Database } from '../src'

describe('db notify', () => {
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
    dbOne.channels.new_repo_event.addListener('message', () => {
      deferrables[receivedCount]?.resolve()
      receivedCount++
    })

    for (let i = 0; i < sendCount; i++) {
      dbTwo.notify('new_repo_event')
    }

    await allComplete(deferrables)
    expect(receivedCount).toBe(sendCount)
  })

  it('can notifies multiple listeners', async () => {
    const sendCount = 5
    const deferrables = createDeferrables(sendCount * 2)
    let receivedOne = 0
    let receivedTwo = 0
    dbOne.channels.new_repo_event.addListener('message', () => {
      deferrables[receivedOne]?.resolve()
      receivedOne++
    })
    dbOne.channels.new_repo_event.addListener('message', () => {
      deferrables[receivedTwo + sendCount]?.resolve()
      receivedTwo++
    })

    for (let i = 0; i < sendCount; i++) {
      await dbTwo.notify('new_repo_event')
    }

    await allComplete(deferrables)
    expect(receivedOne).toBe(sendCount)
    expect(receivedTwo).toBe(sendCount)
  })

  it('notifies on multiple channels', async () => {
    const sendCountOne = 5
    const sendCountTwo = 5
    const deferrablesOne = createDeferrables(sendCountOne)
    const deferrablesTwo = createDeferrables(sendCountTwo)
    let receivedCountOne = 0
    let receivedCountTwo = 0
    dbOne.channels.new_repo_event.addListener('message', () => {
      deferrablesOne[receivedCountOne]?.resolve()
      receivedCountOne++
    })
    dbOne.channels.outgoing_repo_seq.addListener('message', () => {
      deferrablesTwo[receivedCountTwo]?.resolve()
      receivedCountTwo++
    })

    for (let i = 0; i < sendCountOne; i++) {
      dbTwo.notify('new_repo_event')
    }
    for (let i = 0; i < sendCountTwo; i++) {
      dbTwo.notify('outgoing_repo_seq')
    }

    await allComplete(deferrablesOne)
    await allComplete(deferrablesTwo)
    expect(receivedCountOne).toBe(sendCountOne)
    expect(receivedCountTwo).toBe(sendCountTwo)
  })

  it('bundles within txs', async () => {
    const sendCount = 5
    let receivedCount = 0
    dbOne.channels.new_repo_event.addListener('message', () => {
      receivedCount++
    })

    await dbTwo.transaction(async (dbTx) => {
      for (let i = 0; i < sendCount; i++) {
        await dbTx.notify('new_repo_event')
      }
    })

    await wait(200)
    expect(receivedCount).toBe(1)
  })

  it('does not send on failed tx', async () => {
    let received = false
    dbOne.channels.new_repo_event.addListener('message', () => {
      received = true
    })

    const fakeErr = new Error('test')
    try {
      await dbTwo.transaction(async (dbTx) => {
        await dbTx.notify('new_repo_event')
        throw fakeErr
      })
    } catch (err) {
      if (err !== fakeErr) {
        throw err
      }
    }
    await wait(200)
    expect(received).toBeFalsy()
  })
})
