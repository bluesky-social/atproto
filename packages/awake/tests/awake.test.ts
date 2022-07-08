import http from 'http'
import wsRelay from '@adxp/ws-relay'
import Provider from '../src/provider'
import Requester from '../src/requester'
import * as auth from '@adxp/auth'

const RELAY_PORT = 3005
const RELAY_HOST = `http://localhost:${RELAY_PORT}`

describe('AWAKE', () => {
  let server: http.Server

  beforeAll(() => {
    server = wsRelay(RELAY_PORT)
  })

  afterAll(() => {
    return server.close()
  })

  let provAuth: auth.AuthStore
  let rootDid: string
  let reqAuth: auth.AuthStore
  let reqDid: string

  it('authenticates and sends a matching pin', async () => {
    provAuth = await auth.MemoryStore.load()
    rootDid = await provAuth.did()
    // we claim full authority for provider
    await provAuth.claimFull()

    reqAuth = await auth.MemoryStore.load()
    reqDid = await reqAuth.did()

    const provider = await Provider.create(RELAY_HOST, rootDid, provAuth)
    const requester = await Requester.create(RELAY_HOST, rootDid, reqDid)

    const [provPin, reqPin] = await Promise.all([
      provider.attemptProvision(),
      requester.findProvider(),
    ])

    expect(provPin).toEqual(reqPin)

    const [token, _] = await Promise.all([
      requester.awaitDelegation(),
      provider.approvePinAndDelegateCred(),
    ])

    const validated = await auth.verifyFullWritePermission(
      token,
      reqDid,
      rootDid,
    )

    expect(validated).toBeTruthy()
    provider.close()
    requester.close()
  })

  it('handles errors', async () => {
    const provider = await Provider.create(RELAY_HOST, rootDid, provAuth)
    const requester = await Requester.create(RELAY_HOST, rootDid, reqDid)

    await Promise.all([provider.attemptProvision(), requester.findProvider()])

    provider.denyPin()

    try {
      const token = await requester.awaitDelegation()
      expect(token).toBe(null)
    } catch (err) {
      expect(err instanceof Error).toBeTruthy()
    }

    provider.close()
    requester.close()
  })
})
