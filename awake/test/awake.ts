import test from 'ava'
import http from 'http'
import wsRelay from '@adxp/ws-relay'
import Provider, { PinParams } from '../src/provider.js'
import Requester from '../src/requester.js'
import * as auth from '@adxp/auth'

const RELAY_PORT = 3005
const RELAY_HOST = `http://localhost:${RELAY_PORT}`

let server: http.Server

test.before(() => {
  server = wsRelay.server(RELAY_PORT)
})

test.after(() => {
  server.close()
})

type Context = {
  rootDid: string
  provAuth: auth.AuthStore
  reqAuth: auth.AuthStore
}

test.beforeEach('setup', async (t) => {
  const provAuth = await auth.MemoryStore.load()
  const rootDid = await provAuth.getDid()

  // we claim full authority for provider
  const tokenBuilder = await provAuth.buildUcan()
  const fullToken = await tokenBuilder
    .toAudience(rootDid)
    .withLifetimeInSeconds(100000)
    .claimCapability(auth.writeCap(rootDid))
    .build()
  await provAuth.addUcan(fullToken)

  const reqAuth = await auth.MemoryStore.load()

  t.context = { rootDid, provAuth, reqAuth } as Context
})

test('test', async (t) => {
  const { rootDid, provAuth, reqAuth } = t.context as Context
  const provShowPin = (pin: PinParams) => {
    console.log(pin)
  }
  const onProvSuccess = () => {
    console.log('prov success')
  }
  const reqShowPin = (pin: number) => {
    console.log(pin)
  }
  const onReqSuccess = () => {
    t.pass('yay')
    console.log('prov success')
  }
  const provider = await Provider.openChannel(
    RELAY_HOST,
    rootDid,
    provAuth,
    provShowPin,
    onProvSuccess,
  )
  const requester = await Requester.openChannel(
    RELAY_HOST,
    rootDid,
    reqAuth,
    reqShowPin,
    onReqSuccess,
  )

  await wait(3)
  t.pass('asdf')
})

const wait = (s: number) => {
  return new Promise((resolve) => setTimeout(resolve, s * 1000))
}
