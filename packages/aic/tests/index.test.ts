import {
  diffs_to_did_doc,
  sign,
  validate_sig,
  tick_from_diffs,
  update_tick,
  pid,
  tick_to_did_doc,
} from '../src/index'
import { EcdsaKeypair, verifyDidSig } from '@adxp/crypto'
import * as uint8arrays from 'uint8arrays'
import test from 'ava'
import { TID } from '@adxp/common'

const key_consortium = EcdsaKeypair.import(
  {
    // did:key:zDnaeeL44gSLMViH9khhTbngNd9r72MhUPo4WKPeSfB8xiDTh
    key_ops: [ 'sign' ],
    ext: true,
    kty: 'EC',
    x: 'zn_OWx4zJM5zy8E_WUAJH9OS75K5t6q74D7lMf7AmnQ',
    y: 'trzc_f9i_nOuYRCLMyXxBcpc3OVlylmxdESQ0zdKHeQ',
    crv: 'P-256',
    d: 'Ii__doqqQ5YYZLfKh-LSh1Vm6AqCWHGMrBTDYKaEWfU',
  },
  {
    exportable: true,
  },
)

const key_tick = EcdsaKeypair.import(
  {
    // did:key:zDnaenyrpzvz4VNQVRTSRUwQWM8wLNcUeh1mmoBiTb1PLQrht
    key_ops: [ 'sign' ],
    ext: true,
    kty: 'EC',
    x: 'Twyq87vXIh8MEbj02V8scuY3uVGK6FUv9uPi2guD268',
    y: 'OrG4Yt23_smcwVnN6kzjdcTAWRNkS_R0rUxQwVk88QM',
    crv: 'P-256',
    d: 'FnLpO2CNkLP-D2ZhOPwBjeyFCnPQM6G4wXBhDQcgu1Q'
  },
  {
    exportable: true,
  },
)

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

const key_recovery = EcdsaKeypair.import(
  {
    // did:key:zDnaepvdtQ3jDLU15JihZwmMghuRugJArN8x9rm6Czt9BkHEM  
    key_ops: [ 'sign' ],
    ext: true,
    kty: 'EC',
    x: 'dLiYUIcjLiBo7p7Ve6k8ts_IZ8sRlk5Sarx14UD95W0',
    y: 'LP5TyYkAVRVXFSMq_izgYLHg6MTprsSEsANS6hF-qeo',
    crv: 'P-256',
    d: 'KXpzn4Tuo9YEVTm_HMqy2w_LukGhqK4Ql21Q8wcAHHc',
  },
  {
    exportable: true,
  },
)

describe('aic test test', () => {
  // it('works', async () => {
  //   console.log(TID.next().formatted())
  //   console.log(await (await EcdsaKeypair.create({exportable: true})).export())
  //   console.log('key_consortium', (await key_consortium).did())
  //   console.log('key_tick', (await key_tick).did())
  //   console.log('key_account', (await key_account).did())
  //   console.log('key_recovery', (await key_recovery).did())
  //   expect(true)
  // })


// old test to migrate.

  it('diffs_to_doc basic test 1', async () => {
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

  expect(
    await diffs_to_did_doc(diffs_doc)
  ).toEqual(
    {
      id: 'did:aic:zkug3v3btzimdf4d',
      a: 1,
      c: 3,
      d: 4,
      e: { ea: 'each' },
      'adx/account_keys': [
        'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
      ],
   }
  )
})

  it('diffs_to_doc init test', async () => {
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
    expect(
      await diffs_to_did_doc(diffs_doc),
    ).toEqual(
      {
        id: 'did:aic:zkug3v3btzimdf4d',
        a: 1,
        b: 2,
        c: 3,
        'adx/account_keys': [
          'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
        ],
      }
    )
  })

  it('diffs_to_doc put test', async () => {
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
    expect(
      await diffs_to_did_doc(diffs_doc),
    ).toEqual(
      {
        id: 'did:aic:zkug3v3btzimdf4d',
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        'adx/account_keys': [
          'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
        ],
      }
    )
  })

  it('diffs_to_doc del test', async () => {
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
    expect(
      await diffs_to_did_doc(diffs_doc),
    ).toEqual(
      {
        id: 'did:aic:zkug3v3btzimdf4d',
        a: 1,
        c: 3,
        'adx/account_keys': [
          'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
        ],
      }
    )
  })

  it('diffs_to_did_doc skip bad prev test', async () => {
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
    expect(
      await diffs_to_did_doc(diffs_doc),
    ).toEqual(
      {
        id: 'did:aic:zkug3v3btzimdf4d',
        a: 1,
        b: 2,
        c: 3,
        'adx/account_keys': [
          'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
        ],
      }
    )
  })

  it('diffs_to_did_doc test key gen', async () => {
    //gen key
    const key = await EcdsaKeypair.create({ exportable: true })
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
    const valid = await verifyDidSig(recv.key, recv_data, recv_sig)
    expect(valid).toBeTruthy()
  })

  it('sign validate_sig', async () => {
    // pre baked signed diff
    expect(
      await validate_sig({
        prev: '3j2b-pul-dlia-22',
        patches: [],
        key: 'did:key:zDnaeYgdnK7nVH2xNQENrBRJbdCQ1KKjxt5sbykiUGLAh46Ez',
        sig: 'z5wYnrLa136SZsdxEvrbpLwu5wi6FDsynwiVeNR3KoJqVzgBUXLv9VQffLaz78w4tngKURh1cdbZ837S6PFC9Tu4y',
      }),
    ).toBeTruthy()

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
    expect(await validate_sig(diff)).toBeTruthy()
  })

  it('tid next', async () => {
    const tic = TID.next().formatted()
    const toc = TID.next().formatted()
    // console.log(tic, toc)
    expect(toc > tic).toBeTruthy()
  })

  it('tick_from_diffs', async () => {
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
    expect(
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
    ).toBeTruthy()
    expect(await validate_sig(JSON.parse(JSON.stringify(tick)))).toBeTruthy()
  })

  it('should update_tick', async () => {
    const doc = {
      'adx/account_keys': [
        'did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV',
      ],
      'adx/recovery_keys':[
        'did:key:zDnaeYHbbWiaCwAXvHXRyVqENDv8Sr3fwHW8P5eakkz4MqsTa',
      ],
    }
    const did_of_doc = "did:aic:zrr5lxhs4rjlowv5"
    if (did_of_doc !== `did:aic:${await pid(doc)}`) {
      console.log('pid', await pid(doc))
    }
    const tick1 = await update_tick(
      did_of_doc, 
      TID.next(), 
      doc,
      null,
      (await key_consortium)
    )
    if ('error' in tick1){
      console.log(tick1)
      expect(false).toBeTruthy()
      return
    }
    console.log('tick1', tick1, await tick_to_did_doc(tick1, (await key_consortium).did()))

    expect(await validate_sig(tick1)).toBeTruthy()
    expect(tick1.did).toEqual(did_of_doc)
    expect(tick1.key).toEqual('did:key:zDnaeeL44gSLMViH9khhTbngNd9r72MhUPo4WKPeSfB8xiDTh')
    
    const tids1 = Object.keys(tick1.diffs).sort()
    const tick2 = await update_tick(
      did_of_doc, 
      TID.next(),
      await sign(
        // candidate_diff is singed on clint then sent to consortium
        {
          prev: tids1.at(-1),
          patches: [
            ['put', ['name'], 'aaron.blueskyweb.xyz'],
          ],
          key: (await key_account).did(),
          sig: ''
        },
        (await key_account), // only the client has this key
      ),
      tick1,
      (await key_consortium) // only the consortium has this key
    )
    if ('error' in tick2){
      console.log(tick2)
      expect(false).toBeTruthy()
      return
    }
    console.log('tick2', tick2, await tick_to_did_doc(tick2, (await key_consortium).did()))

    expect(await validate_sig(tick2)).toBeTruthy()
    expect(tick1.did).toEqual(did_of_doc)
    expect(tick1.key).toEqual('did:key:zDnaeeL44gSLMViH9khhTbngNd9r72MhUPo4WKPeSfB8xiDTh')


    const tids2 = Object.keys(tick2.diffs).sort()
    const tick3 = await update_tick(
      did_of_doc,
      TID.next(),
      await sign(
        {
          prev: tids2.at(-1),
          patches: [
            ['del', ['adx/account_keys']],
          ],
          key: (await key_account).did(),
          sig: ''
        },
        (await key_account),
      ),
      tick2,
      (await key_consortium)
    )
    if ('error' in tick3){
      console.log(tick3)
      expect(false).toBeTruthy()
      return
    }
    console.log('tick3', JSON.stringify(tick3), await tick_to_did_doc(tick3, (await key_consortium).did()))
    expect(await validate_sig(tick3)).toBeTruthy()
    expect(tick3.did).toEqual(did_of_doc)
    expect(tick3.key).toEqual('did:key:zDnaeeL44gSLMViH9khhTbngNd9r72MhUPo4WKPeSfB8xiDTh')

    const tids3 = Object.keys(tick3.diffs).sort()
    const tick4 = await update_tick(
      did_of_doc,
      TID.next(),
      await sign(
        {
          prev: tids3.at(-1),
          patches: [
            ['put', ['hello'], 'world'],
          ],
          key: (await key_account).did(),
          sig: ''
        },
        (await key_account),
      ),
      tick3,
      (await key_consortium)
    )
    if ('error' in tick4){
      console.log(tick4)
      expect(false).toBeTruthy()
      return
    }
    console.log('tick4', JSON.stringify(tick4), await tick_to_did_doc(tick4, (await key_consortium).did()))
    expect(await validate_sig(tick4)).toBeTruthy()
    expect(tick4.did).toEqual(did_of_doc)
    expect(tick4.key).toEqual('did:key:zDnaeeL44gSLMViH9khhTbngNd9r72MhUPo4WKPeSfB8xiDTh')
  })
})
