'use strict' /* eslint-env node */

const assert = require('node:assert')
const { BskyAppView, ServerConfig } = require('@atproto/bsky')
const { Secp256k1Keypair } = require('@atproto/crypto')

async function main() {
  const serviceSigningKey = process.env.BSKY_SERVICE_SIGNING_KEY
  const config = ServerConfig.readEnv()
  assert(serviceSigningKey, 'must set BSKY_SERVICE_SIGNING_KEY')
  const signingKey = await Secp256k1Keypair.import(serviceSigningKey)
  const bsky = BskyAppView.create({ config, signingKey })
  await bsky.start()
  // stop
  process.on('SIGTERM', async () => {
    await bsky.destroy()
  })
}

main()
