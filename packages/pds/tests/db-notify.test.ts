import { wait } from '@atproto/common'
import { Database } from '../src'

describe('db', () => {
  let dbOne: Database
  let dbTwo: Database

  beforeAll(async () => {
    if (process.env.DB_POSTGRES_URL) {
      dbOne = await Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'db_notify',
      })
      dbTwo = await Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'db_notify',
      })
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
    const toSend = ['one', 'two', 'three', 'four', 'five']
    const received: string[] = []
    dbOne.channels.repo_seq.addListener('message', (msg) => {
      received.push(msg || '')
    })

    dbTwo.notify('otherchannel' as any, 'blah')
    for (const msg of toSend) {
      dbTwo.notify('repo_seq', msg)
    }
    dbTwo.notify('otherchannel' as any, 'blah')

    await wait(200)
    expect(received.sort()).toEqual(toSend.sort())
  })

  it('can notifies multiple listeners', async () => {
    const toSend = ['one', 'two', 'three', 'four', 'five']
    const receivedOne: string[] = []
    const receivedTwo: string[] = []
    dbOne.channels.repo_seq.addListener('message', (msg) => {
      receivedOne.push(msg || '')
    })
    dbOne.channels.repo_seq.addListener('message', (msg) => {
      receivedTwo.push(msg || '')
    })

    dbTwo.notify('otherchannel' as any, 'blah')
    for (const msg of toSend) {
      dbTwo.notify('repo_seq', msg)
    }
    dbTwo.notify('otherchannel' as any, 'blah')

    await wait(200)
    expect(receivedOne.sort()).toEqual(toSend.sort())
    expect(receivedTwo.sort()).toEqual(toSend.sort())
  })
})
