import test from 'ava'

import EcdsaKeypair from '../src/ecdsa.js'
import * as cryptoUtil from '../src/util.js'

test('public key compression', async (t) => {
  const keypair = await EcdsaKeypair.create()
  const compressed = cryptoUtil.compressPubkey(keypair.publicKey)
  t.is(compressed.length, 33, 'correct length compressed key')

  const decompressed = cryptoUtil.decompressPubkey(compressed)
  t.is(decompressed.length, 65, 'correct length decompressed key')
  t.deepEqual(decompressed, keypair.publicKey, 'decompressed matches original')
})

test('works consistently', async (t) => {
  const pubkeys = []
  for (let i = 0; i < 1000; i++) {
    const key = await EcdsaKeypair.create()
    pubkeys.push(key.publicKey)
  }
  const compressed = pubkeys.map(cryptoUtil.compressPubkey)
  const decompressed = compressed.map(cryptoUtil.decompressPubkey)
  t.deepEqual(pubkeys, decompressed)
})
