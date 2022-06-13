import test from 'ava'
import http from 'http'
import wsRelay from '@adxp/ws-relay'
import Provider from '../src/provider.js'
import Requester from '../src/requester.js'
import * as auth from '@adxp/auth'

const RELAY_PORT = 3005
const RELAY_HOST = `http://localhost:${RELAY_PORT}`

let server: http.Server

test.before(() => {
  server = wsRelay(RELAY_PORT)
})

test.after(() => {
  server.close()
})

type Context = {
  rootDid: string
  reqDid: string
  provAuth: auth.AuthStore
  reqAuth: auth.AuthStore
}

test.beforeEach('setup', async (t) => {
  const provAuth = await auth.MemoryStore.load()
  const rootDid = await provAuth.getDid()
  // we claim full authority for provider
  await provAuth.claimFull()

  const reqAuth = await auth.MemoryStore.load()
  const reqDid = await reqAuth.getDid()

  t.context = { rootDid, reqDid, provAuth, reqAuth } as Context
})

test('AWAKE works', async (t) => {
  const { rootDid, reqDid, provAuth } = t.context as Context
  const provider = await Provider.create(RELAY_HOST, rootDid, provAuth)
  const requester = await Requester.create(RELAY_HOST, rootDid, reqDid)
  const [provPin, reqPin] = await Promise.all([
    provider.attemptProvision(),
    requester.findProvider(),
  ])

  t.is(provPin, reqPin, 'Pins match')

  const [token, _] = await Promise.all([
    requester.awaitDelegation(),
    provider.approvePinAndDelegateCred(),
  ])

  await auth.checkUcan(
    token,
    auth.hasAudience(reqDid),
    auth.hasFullWritePermission(rootDid),
  )

  t.pass('Got a valid UCAN!')
})

test('AWAKE handles errors', async (t) => {
  const { rootDid, reqDid, provAuth } = t.context as Context
  const provider = await Provider.create(RELAY_HOST, rootDid, provAuth)
  const requester = await Requester.create(RELAY_HOST, rootDid, reqDid)

  await Promise.all([provider.attemptProvision(), requester.findProvider()])

  provider.denyPin()

  try {
    await requester.awaitDelegation()
  } catch (err) {
    t.true(err instanceof Error, 'throws an error on pin denial')
  }
})
