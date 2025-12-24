/* eslint-env node */

'use strict'

const assert = require('node:assert')
const { Secp256k1Keypair } = require('@atproto/crypto')
const { BskyAppView, ServerConfig } = require('./dist')

const main = async () => {
  const env = getEnv()
  const config = ServerConfig.readEnv()
  assert(env.serviceSigningKey, 'must set BSKY_SERVICE_SIGNING_KEY')
  const signingKey = await Secp256k1Keypair.import(env.serviceSigningKey)
  const bsky = BskyAppView.create({ config, signingKey })
  await bsky.start()
}

const getEnv = () => ({
  serviceSigningKey: process.env.BSKY_SERVICE_SIGNING_KEY || undefined,
})

main()
