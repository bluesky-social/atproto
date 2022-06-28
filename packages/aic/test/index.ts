import {
  diffs_to_did_doc,
  sign,
  validate_sig,
  tick_from_diffs,
} from '../src/index.js'
import * as crypto from '@adxp/crypto'
import * as uint8arrays from 'uint8arrays'
import test from 'ava'
import { TID } from '@adxp/common'

const key_consortium = crypto.EcdsaKeypair.import(
  {
    // did:key:zDnaesnjCLbxSB2EiJgTZUYCBqHTkuDJDdLbSmaAn2bpqXtuY
    publicKey:
      'QUwjqkzD7TZQ1iJY5TAdAD5mJDDxZrBYyi9Ld4Kebj7ZuR87TiFhKX5QeoYvffMquYTvToRV1P3EJXVqUYDMGnCc',
    privateKey:
      '2EPbyvKQKUaUPMF7Mm94FjEzvs5tsLWfesyc97W1dqYeeZFEG2axhDPdH5LDfLF28yNjJu26wYXiSypZtaMWCajYu4hHgUvHhygV8kHzQkvszbL6BrvGP8GsYpeWBBWBxx4q816yVUBjzFH21mkekFnHF5fWAXDUN72rii66kR81rkaxCTacSMJu2XUuz',
  },
  {
    exportable: true,
    encoding: 'base58btc',
  },
)

const key_tick = crypto.EcdsaKeypair.import(
  {
    // did:key:zDnaeUseLF7DyBMA4mNdCKFk8457HAV1zpYmmHDt8L9PB3GY9
    publicKey:
      'Nnyz39Xd9ZL3fbV9mhnW4uQpziCLDCHMRo9N5AcGx48jtBwq4FRoTb9xQ4ckWjkTW3SqcFErxKUo6Hxfds5toaXP',
    privateKey:
      '2EPbyvKQKUaUPMF7Mm94FjEzvs5tsLWfesyc97W1dqYeeZFEG4JR9rLUZdbbsiZf16PBevETQqdfbtS43FaKKJzpdbUBcGzBU2UDp9bJiSCaaGecY8XyEiDJ9jwz9f2FqVrQA7YJiRg9C19XQ5BiEkJj1PoxBHKsarDQcADkKXzCLEZUFbvbQfAYu5z77',
  },
  {
    exportable: true,
    encoding: 'base58btc',
  },
)

const key_account = crypto.EcdsaKeypair.import(
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

const key_recovery = crypto.EcdsaKeypair.import(
  {
    // did:key:zDnaepvdtQ3jDLU15JihZwmMghuRugJArN8x9rm6Czt9BkHEM
    publicKey:
      'Pdc3nYP6zkJ4K4rDGFXAGHX2xj8eudn1pN55RKts8BrLbmQVHQtmRmZYztsHtSkonhbi8hNMrXJeqy1qRMyB9L5Y',
    privateKey:
      '2EPbyvKQKUaUPMF7Mm94FjEzvs5tsLWfesyc97W1dqYeeZFEG3PyNi4rRXjHP4f3dPpRBH7RYTFoVF7erKdygSbTXva5iRFV1NZRBJYhLzdwZ3Wyhi69Bct4wpj7U1yqkUd6RdpfPxyDqNgNE1RwsXZJy7SKVkSXvVqkXGK6Uwfpp7dFrV9iqQrdjJBRt',
  },
  {
    exportable: true,
    encoding: 'base58btc',
  },
)

test('diffs_to_doc basic test 1', async (t) => {
  const diffs_doc = {
    '3j55-hih-g24c-22': {
      a: 1,
      b: 2,
      c: 3,
      'adx/account_keys': [
        'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      ],
    },
    '3j55-hiu-hcxs-22': {
      prev: '3j55-hih-g24c-22',
      patches: [['put', ['d'], 4]],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: 'z58kG77wksPLi8185y6fsJG3NidUjYVBzBKVqSG3T5NQKwrNu9d6aL2UorPRzre4VCvKUASuec53jain2LRaMCtmZ',
    },
    '3j55-hk2-pbqk-22': {
      prev: '3j55-hiu-hcxs-22',
      patches: [['del', ['b']]],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: 'z45gdspAmr9W1tC2KCBrnugdQSXP7fbTUvxz8yM1QnPPNLTKHs2PWzDYgmJe8RPLhZKrfpVFEsvaCMHkhLkFGfxRo',
    },
    '3j55-hki-vs6w-22': {
      prev: '3j55-hk2-pbqk-22',
      patches: [['put', ['e', 'ea'], 'each']],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: 'z66WkmrsuVNiqBT3mhjF8G5MNcgpcKbCvXYinqFL73xYkwbSRvNNE7Mj8ak9gEN5FCkamWgsa82GrG984sJxcJdw8',
    },
    '3j55-hl6-3ctt-22': {
      prev: '3j55-hk2-pbqk-22',
      patches: [['put', ["Don't", 'put', 'me'], 'in']],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: 'z5oHy2qCSKR9Z9hXuha6c7qEpUWMzGNeZcj8D5kDAxsWP6P8FN4kmSWHcoLv4q5umiyMWcUk5CePGeh51khRGEgGL',
    },
  }

  t.deepEqual(await diffs_to_did_doc(diffs_doc), {
    id: 'did:aic:zkug3v3btzimdf4d',
    a: 1,
    c: 3,
    d: 4,
    e: { ea: 'each' },
    'adx/account_keys': [
      'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
    ],
  })
})

test('diffs_to_doc init test', async (t) => {
  const diffs_doc = {
    '2': {
      a: 1,
      b: 2,
      c: 3,
      'adx/account_keys': [
        'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      ],
    },
  }
  t.deepEqual(await diffs_to_did_doc(diffs_doc), {
    id: 'did:aic:zkug3v3btzimdf4d',
    a: 1,
    b: 2,
    c: 3,
    'adx/account_keys': [
      'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
    ],
  })
})

test('diffs_to_doc put test', async (t) => {
  const diffs_doc = {
    '2': {
      a: 1,
      b: 2,
      c: 3,
      'adx/account_keys': [
        'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      ],
    },
    '3': {
      prev: '2',
      patches: [['put', ['d'], 4]],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: 'z3X32k2MrDtWLr56qzGrpgCdLUouZGXZLCca1RH8unoF97geJpedbWAD8pnbw2KRM7qXLupPcurTNRAdPLAVqxP7u',
    },
  }
  t.deepEqual(await diffs_to_did_doc(diffs_doc), {
    id: 'did:aic:zkug3v3btzimdf4d',
    a: 1,
    b: 2,
    c: 3,
    d: 4,
    'adx/account_keys': [
      'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
    ],
  })
})

test('diffs_to_doc del test', async (t) => {
  const diffs_doc = {
    '2': {
      a: 1,
      b: 2,
      c: 3,
      'adx/account_keys': [
        'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      ],
    },
    '3': {
      prev: '2',
      patches: [['del', ['b']]],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: 'zsXdHvXFyrZQ5dtmtaEcPVbwSgMFZWznp3V8SJGUEVPWengoo1N4tsDgcvC6e2ZwiHvWekdjLmo2o2XLJfoErstN',
    },
  }
  t.deepEqual(await diffs_to_did_doc(diffs_doc), {
    id: 'did:aic:zkug3v3btzimdf4d',
    a: 1,
    c: 3,
    'adx/account_keys': [
      'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
    ],
  })
})

test('diffs_to_did_doc skip bad prev test', async (t) => {
  const diffs_doc = {
    '2': {
      a: 1,
      b: 2,
      c: 3,
      'adx/account_keys': [
        'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      ],
    },
    '3': {
      prev: '1',
      patches: [['del', ['b']]],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: 'z3wZ4j3HoKaAPfv1eTTeknCYsUbjfkbzs7qQkyaqVqBi4iNbvA16A9totDJfRaZZ5PxVwHrFBgCs4BGvns6a5TAp',
    },
  }
  t.deepEqual(await diffs_to_did_doc(diffs_doc), {
    id: 'did:aic:zkug3v3btzimdf4d',
    a: 1,
    b: 2,
    c: 3,
    'adx/account_keys': [
      'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
    ],
  })
})

test('diffs_to_did_doc test key gen', async (t) => {
  //gen key
  const key = await crypto.EcdsaKeypair.create({ exportable: true })
  // console.log(await key.export('base58btc'), key.did())

  // make message
  const data_object = {
    prev: 'tid',
    patches: [
      ['put', ['path'], 'value'],
      ['del', ['path']],
    ],
    key: key.did(),
    sig: '',
  }
  const signed = await sign(data_object, key) // replace sig with valid signature
  const msg = JSON.stringify(signed)

  // parse message
  const recv = JSON.parse(msg)
  if (recv.sig[0] !== 'z') {
    throw "signatures must be 'z'+ base58btc"
  }
  const recv_sig = uint8arrays.fromString(recv.sig.slice(1), 'base58btc')
  recv.sig = ''
  const recv_data = uint8arrays.fromString(JSON.stringify(recv))

  // validate signature
  const valid = await crypto.verifyEcdsaSig(recv_data, recv_sig, recv.key)
  t.assert(valid)
})

test('sign validate_sig', async (t) => {
  // pre baked signed diff
  t.assert(
    await validate_sig({
      prev: '3j2b-pul-dlia-22',
      patches: [],
      key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      sig: 'z5wYnrLa136SZsdxEvrbpLwu5wi6FDsynwiVeNR3KoJqVzgBUXLv9VQffLaz78w4tngKURh1cdbZ837S6PFC9Tu4y',
    }),
  )

  // fresh baked signed diff
  const diff = await sign(
    {
      prev: '3j2b-pul-dlia-22',
      patches: [],
      key: (await key_account).did(),
      sig: '',
    },
    await key_account,
  )
  // console.log(diff)
  t.assert(await validate_sig(diff))
})

test('tid next', async (t) => {
  const tic = TID.next().formatted()
  const toc = TID.next().formatted()
  // console.log(tic, toc)
  t.assert(toc > tic)
})

test('tick_from_diffs', async (t) => {
  const tick = await tick_from_diffs(
    {
      '3j55-hih-g24c-22': {
        a: 1,
        b: 2,
        c: 3,
        'adx/account_keys': [
          'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
        ],
      },
      '3j55-hiu-hcxs-22': {
        prev: '3j55-hih-g24c-22',
        patches: [['put', ['d'], 4]],
        key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
        sig: 'z58kG77wksPLi8185y6fsJG3NidUjYVBzBKVqSG3T5NQKwrNu9d6aL2UorPRzre4VCvKUASuec53jain2LRaMCtmZ',
      },
      '3j55-hk2-pbqk-22': {
        prev: '3j55-hiu-hcxs-22',
        patches: [['del', ['b']]],
        key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
        sig: 'z45gdspAmr9W1tC2KCBrnugdQSXP7fbTUvxz8yM1QnPPNLTKHs2PWzDYgmJe8RPLhZKrfpVFEsvaCMHkhLkFGfxRo',
      },
      '3j55-hki-vs6w-22': {
        prev: '3j55-hk2-pbqk-22',
        patches: [['put', ['e', 'ea'], 'each']],
        key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
        sig: 'z66WkmrsuVNiqBT3mhjF8G5MNcgpcKbCvXYinqFL73xYkwbSRvNNE7Mj8ak9gEN5FCkamWgsa82GrG984sJxcJdw8',
      },
      '3j55-hl6-3ctt-22': {
        prev: '3j55-hk2-pbqk-22',
        patches: [['put', ["Don't", 'put', 'me'], 'in']],
        key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
        sig: 'z5oHy2qCSKR9Z9hXuha6c7qEpUWMzGNeZcj8D5kDAxsWP6P8FN4kmSWHcoLv4q5umiyMWcUk5CePGeh51khRGEgGL',
      },
    },
    TID.next(),
    await key_consortium,
  )
  t.assert(
    await validate_sig({
      tid: '3j57-dxc-6tjt-2o',
      diffs: {
        '3j55-hih-g24c-22': { a: 1, b: 2, c: 3 },
        '3j55-hiu-hcxs-22': {
          prev: '3j55-hih-g24c-22',
          patches: [['put', ['d'], 4]],
          key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
          sig: 'z58kG77wksPLi8185y6fsJG3NidUjYVBzBKVqSG3T5NQKwrNu9d6aL2UorPRzre4VCvKUASuec53jain2LRaMCtmZ',
        },
        '3j55-hk2-pbqk-22': {
          prev: '3j55-hiu-hcxs-22',
          patches: [['del', ['b']]],
          key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
          sig: 'z45gdspAmr9W1tC2KCBrnugdQSXP7fbTUvxz8yM1QnPPNLTKHs2PWzDYgmJe8RPLhZKrfpVFEsvaCMHkhLkFGfxRo',
        },
        '3j55-hki-vs6w-22': {
          prev: '3j55-hk2-pbqk-22',
          patches: [['put', ['e', 'ea'], 'each']],
          key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
          sig: 'z66WkmrsuVNiqBT3mhjF8G5MNcgpcKbCvXYinqFL73xYkwbSRvNNE7Mj8ak9gEN5FCkamWgsa82GrG984sJxcJdw8',
        },
        '3j55-hl6-3ctt-22': {
          prev: '3j55-hk2-pbqk-22',
          patches: [['put', ["Don't", 'put', 'me'], 'in']],
          key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
          sig: 'z5oHy2qCSKR9Z9hXuha6c7qEpUWMzGNeZcj8D5kDAxsWP6P8FN4kmSWHcoLv4q5umiyMWcUk5CePGeh51khRGEgGL',
        },
      },
      id: 'did:aic:zwulnkrxrjkobowd',
      key: 'did:key:zDnaesnjCLbxSB2EiJgTZUYCBqHTkuDJDdLbSmaAn2bpqXtuY',
      sig: 'zE3zimBwrcerAfSATbhXjyMSaiGfmgP7BBaeCJKpFocTaj2fHiVnCbWYksb9czgRk4zEwPZ7RXvYEXmqVeiyoUNu',
    }),
  )
  t.assert(await validate_sig(JSON.parse(JSON.stringify(tick))))
})
