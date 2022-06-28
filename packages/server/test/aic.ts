import test from 'ava'
import axios from 'axios'
import { EcdsaKeypair } from '@adxp/crypto'
import { pid, sign, validate_sig } from '@adxp/aic'
import { runTestServer } from './_util.js'

const USE_TEST_SERVER = false

const PORT = 2583
const HOST = `localhost`
const PATH = `aic`
let test_pid = ''
const key_account = EcdsaKeypair.import(
  {
    // did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez
    publicKey:
      'PvdZYuB2AbDamAfR15EvMbrs3t1JYfnEbRUFz7DNKTwmBGHVXKWReh48vtsYqnBWZQp5SWdD6jXBQ4YMmcjseJ5D',
    privateKey:
      '2EPbyvKQKUaUPMF7Mm94FjEzvs5tsLWfesyc97W1dqYeeZFEG3rMrUSc66hCErARA2MFKBWMZMcLmYvcDC8RA8RSFycxYN2HAEg7c5ZdyXM9HEA8GLkdBqcNJ8Q3BV9hGhmhsvfcYeXwKGRKZ7BXNiRGtVR6AhgSvK5DUQo9bgGc6cvfASrV3Y8X5rdhy',
  },
  {
    exportable: true,
    encoding: 'base58btc',
  },
)

test.before('run server', async () => {
  if (USE_TEST_SERVER) {
    await runTestServer(PORT)
  }
})

test.serial('get tid', async (t) => {
  const resp = await axios.get(`http://${HOST}:${PORT}/${PATH}/tid`)
  t.assert(await validate_sig(resp.data))
})

test.serial('post init data', async (t) => {
  const data = {
    nonce: Math.random() * (Number.MAX_SAFE_INTEGER + 1),
    a: 1,
    b: 2,
    c: 3,
    'adx/account_keys': [(await key_account).did()],
  }
  test_pid = await pid(data)
  const url = `http://${HOST}:${PORT}/${PATH}/${test_pid}`
  const headers = { 'Content-Type': 'application/json' }
  const resp = await axios.post(url, data, { headers })
  console.log('post init data', resp.status, resp.data)
  t.assert(resp.status == 200)
})

test.serial('post an update bad signature', async (t) => {
  const url = `http://${HOST}:${PORT}/${PATH}/${test_pid}`
  const data = '{}'
  const headers = { 'Content-Type': 'application/json' }

  const resp = await axios.post(url, data, { headers })
  console.log('update bad signature', resp.status, resp.data)
  t.assert(resp.status == 200)
})

test.serial('valid update 1 add d', async (t) => {
  const url = `http://${HOST}:${PORT}/${PATH}/${test_pid}`
  const resp_get = await axios.get(url)
  console.log('get an update last tid', resp_get.data)
  const data = await sign(
    {
      prev: Object.keys(resp_get.data.diffs)[0],
      patches: [['put', ['d'], 4]],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: '',
    },
    await key_account,
  )
  const headers = { 'Content-Type': 'application/json' }
  const resp = await axios.post(url, data, { headers })
  console.log('post an update last tid', resp.status, resp.data, 'for', data)
  t.assert(resp.status == 200)
  t.pass()
})
test.serial('valid update 2 del b', async (t) => {
  const url = `http://${HOST}:${PORT}/${PATH}/${test_pid}`
  const resp_get = await axios.get(url)
  console.log('get an update last tid', resp_get.data)
  const data = await sign(
    {
      prev: Object.keys(resp_get.data.diffs)[1],
      patches: [['del', ['b']]],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: '',
    },
    await key_account,
  )
  const headers = { 'Content-Type': 'application/json' }
  const resp = await axios.post(url, data, { headers })
  console.log('post an update last tid', resp.status, resp.data, 'for', data)
  t.assert(resp.status == 200)
  t.pass()
})

test.serial('valid update 3 put each level', async (t) => {
  const url = `http://${HOST}:${PORT}/${PATH}/${test_pid}`
  const resp_get = await axios.get(url)
  console.log('get an update last tid', resp_get.data)
  const data = await sign(
    {
      prev: Object.keys(resp_get.data.diffs)[2],
      patches: [['put', ['e', 'ea'], 'each']],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: '',
    },
    await key_account,
  )
  const headers = { 'Content-Type': 'application/json' }
  const resp = await axios.post(url, data, { headers })
  console.log('post an update last tid', resp.status, resp.data, 'for', data)
  t.assert(resp.status == 200)
  t.pass()
})

test.serial('invalid update 4 reject fork', async (t) => {
  const url = `http://${HOST}:${PORT}/${PATH}/${test_pid}`
  const resp_get = await axios.get(url)
  console.log('get an update last tid', resp_get.data)
  const data = await sign(
    {
      prev: Object.keys(resp_get.data.diffs)[2],
      patches: [['put', ["Don't", 'put', 'me'], 'in']],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: 'z5oHy2qCSKR9Z9hXuha6c7qEpUWMzGNeZcj8D5kDAxsWP6P8FN4kmSWHcoLv4q5umiyMWcUk5CePGeh51khRGEgGL',
    },
    await key_account,
  )
  const headers = { 'Content-Type': 'application/json' }
  const resp = await axios.post(url, data, { headers })
  console.log('post an update last tid', resp.status, resp.data, 'for', data)
  t.assert(resp.status == 200)
  t.pass()
})
