import { wait } from '@atproto/common'
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
    } else {
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
    await dbOne.listenFor('test', (msg) => {
      received.push(msg || '')
    })

    dbTwo.notify('otherchannel', 'blah')
    for (const msg of toSend) {
      dbTwo.notify('test', msg)
    }
    dbTwo.notify('otherchannel', 'blah')

    await wait(200)
    expect(received.sort()).toEqual(toSend.sort())
  })

  it('can notifies multiple listeners', async () => {
    const toSend = ['one', 'two', 'three', 'four', 'five']
    const receivedOne: string[] = []
    const receivedTwo: string[] = []
    await dbOne.listenFor('test', (msg) => {
      receivedOne.push(msg || '')
    })
    await dbOne.listenFor('test', (msg) => {
      receivedTwo.push(msg || '')
    })

    dbTwo.notify('otherchannel', 'blah')
    for (const msg of toSend) {
      dbTwo.notify('test', msg)
    }
    dbTwo.notify('otherchannel', 'blah')

    await wait(200)
    expect(receivedOne.sort()).toEqual(toSend.sort())
    expect(receivedTwo.sort()).toEqual(toSend.sort())
  })
})
