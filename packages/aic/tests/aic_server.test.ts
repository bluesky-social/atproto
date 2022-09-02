import axios from 'axios'
import { pid } from '../src/pid'
import { sign, validateSig } from '../src/signature'
import { Asymmetric } from '../src/types'
import { createAsymmetric } from '../src/crypto'

// const USE_TEST_SERVER = false

const PORT = 26979
const HOST = 'localhost'
const PATH = ''

const accountJwk = {
  // did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV
  key_ops: ['sign'],
  ext: true,
  kty: 'EC',
  x: '7PdxOiABSKrek0it0485i1l6qwL7Mjbw_IChbeCNMsg',
  y: 'Ir1RRiNCrxLCcKMSsvaKBiA8Lt5NNyea5WcgqCR1OM8',
  crv: 'P-256',
  d: 'URhLRG1NE10xz0HCWUESwaT8KahrHsX4KNW7sLKsQxw',
}

describe('aic client', () => {
  let accountCrypto: Asymmetric | null = null
  let testPid = '' // will be pid for initialDoc
  let initialDoc
  let initialTick

  beforeAll(async () => {
    // if (USE_TEST_SERVER) {
    //   await runTestServer(PORT)
    // }
    accountCrypto = await createAsymmetric(accountJwk)
    initialDoc = {
      nonce: Math.random() * (Number.MAX_SAFE_INTEGER + 1),
      a: 1,
      b: 2,
      c: 3,
      'adx/account_keys': [accountCrypto.did()],
    }
    testPid = await pid(initialDoc)
  })

  it('get tid', async () => {
    const resp = await axios.get(`http://${HOST}:${PORT}/${PATH}tid`)
    expect(
      await validateSig(resp.data, accountCrypto as Asymmetric),
    ).toBeTruthy()
  })

  it('post initial doc', async () => {
    if (accountCrypto === null) {
      throw new Error('bad test initialization')
    }

    const url = `http://${HOST}:${PORT}/${PATH}${testPid}`
    const headers = { 'Content-Type': 'application/json' }
    const resp = await axios.post(url, initialDoc, { headers })
    // console.log('post init data', resp.status, resp.data)
    expect(resp.status).toEqual(200)
    initialTick = resp.data
  })

  it('get initial doc', async () => {
    if (accountCrypto === null) {
      throw new Error('bad test initialization')
    }

    const url = `http://${HOST}:${PORT}/${PATH}${testPid}`
    const resp = await axios.get(url)

    expect(resp.status).toEqual(200)
    expect(resp.data).toEqual({
      ...initialDoc,
      id: initialTick.did,
    })
  })

  it('post an update bad signature', async () => {
    const url = `http://${HOST}:${PORT}/${PATH}${testPid}`
    const data = '{}'
    const headers = { 'Content-Type': 'application/json' }

    await expect(axios.post(url, data, { headers })).rejects.toThrow(
      'Request failed with status code 500',
    )
    // console.log('update bad signature', resp.status, resp.data)
  })

  it('valid update 1 add d', async () => {
    const url = `http://${HOST}:${PORT}/${PATH}${testPid}`
    const respGet = await axios.get(`${url}/tick`)
    // console.log('get an update last tid', respGet.data)
    const data = await sign(
      {
        prev: Object.keys(respGet.data.diffs)[0],
        patches: [['put', ['d'], 4]],
        key: 'did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV',
        sig: '',
      },
      accountCrypto as Asymmetric,
    )
    const headers = { 'Content-Type': 'application/json' }
    const resp = await axios.post(url, data, { headers })
    // console.log('post an update last tid', resp.status, resp.data, 'for', data)
    expect(resp.status).toEqual(200)
  })

  it('valid update 2 del b', async () => {
    const url = `http://${HOST}:${PORT}/${PATH}${testPid}`
    const respGet = await axios.get(`${url}/tick`)
    // console.log('get an update last tid', respGet.data)
    const data = await sign(
      {
        prev: Object.keys(respGet.data.diffs)[1],
        patches: [['del', ['b']]],
        key: 'did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV',
        sig: '',
      },
      accountCrypto as Asymmetric,
    )
    const headers = { 'Content-Type': 'application/json' }
    const resp = await axios.post(url, data, { headers })
    // console.log('post an update last tid', resp.status, resp.data, 'for', data)
    expect(resp.status).toEqual(200)
  })

  it('valid update 3 put each level', async () => {
    const url = `http://${HOST}:${PORT}/${PATH}${testPid}`
    const respGet = await axios.get(`${url}/tick`)
    // console.log('get an update last tid', respGet.data)
    const data = await sign(
      {
        prev: Object.keys(respGet.data.diffs)[2],
        patches: [['put', ['e', 'ea'], 'each']],
        key: 'did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV',
        sig: '',
      },
      accountCrypto as Asymmetric,
    )
    const headers = { 'Content-Type': 'application/json' }
    const resp = await axios.post(url, data, { headers })
    // console.log('post an update last tid', resp.status, resp.data, 'for', data)
    expect(resp.status).toEqual(200)
  })

  it('invalid update 4 reject fork', async () => {
    const url = `http://${HOST}:${PORT}/${PATH}${testPid}`
    const respGet = await axios.get(`${url}/tick`)
    // console.log('get an update last tid', respGet.data)
    const data = await sign(
      {
        prev: Object.keys(respGet.data.diffs)[2],
        patches: [['put', ["Don't", 'put', 'me'], 'in']],
        key: 'did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV',
        sig: 'z5oHy2qCSKR9Z9hXuha6c7qEpUWMzGNeZcj8D5kDAxsWP6P8FN4kmSWHcoLv4q5umiyMWcUk5CePGeh51khRGEgGL',
      },
      accountCrypto as Asymmetric,
    )
    const headers = { 'Content-Type': 'application/json' }
    const resp = await axios.post(url, data, { headers })
    // console.log('post an update last tid', resp.status, resp.data, 'for', data)
    expect(resp.status).toEqual(200)
  })
})
