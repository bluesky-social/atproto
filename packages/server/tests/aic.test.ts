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
    // did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV
    key_ops: [ 'sign' ],
    ext: true,
    kty: 'EC',
    x: '7PdxOiABSKrek0it0485i1l6qwL7Mjbw_IChbeCNMsg',
    y: 'Ir1RRiNCrxLCcKMSsvaKBiA8Lt5NNyea5WcgqCR1OM8',
    crv: 'P-256',
    d: 'URhLRG1NE10xz0HCWUESwaT8KahrHsX4KNW7sLKsQxw',
  },
  {
    exportable: true,
  },
)

describe('delegator client', () => {
  it('works', () => {
    expect(true)
  })

  beforeAll(async () => {
    if (USE_TEST_SERVER) {
      await runTestServer(PORT)
    }
  })

  it('get tid', async () => {
    const resp = await axios.get(`http://${HOST}:${PORT}/${PATH}/tid`)
    expect(await validate_sig(resp.data)).toBeTruthy()
  })

  it('post init data', async () => {
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
    expect(resp.status == 200).toBeTruthy()
  })

  it('post an update bad signature', async () => {
    const url = `http://${HOST}:${PORT}/${PATH}/${test_pid}`
    const data = '{}'
    const headers = { 'Content-Type': 'application/json' }

    const resp = await axios.post(url, data, { headers })
    console.log('update bad signature', resp.status, resp.data)
    expect(resp.status == 200).toBeTruthy()
  })

  it('valid update 1 add d', async () => {
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
    expect(resp.status == 200).toBeTruthy()
  })
  it('valid update 2 del b', async () => {
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
    expect(resp.status == 200).toBeTruthy()
  })

  it('valid update 3 put each level', async () => {
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
    expect(resp.status == 200).toBeTruthy()
  })

  it('invalid update 4 reject fork', async () => {
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
    expect(resp.status == 200).toBeTruthy()
  })
})
