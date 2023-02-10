#!/usr/bin/env ts-node

import { EcdsaKeypair } from '@atproto/crypto'
import Client from '../src/client'

export async function main() {
  const url = process.argv[2]
  const handle = process.argv[3]
  console.log({ url, handle })
  const signingKey = await EcdsaKeypair.create()
  const recoveryKey = await EcdsaKeypair.create()
  const client = new Client(url)
  const did = await client.createDid(
    signingKey,
    recoveryKey.did(),
    handle,
    handle.split('.').slice(1).join('.'),
  )
  console.log(`Created did: ${url}/${did}`)
}

main()
