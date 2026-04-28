#!/usr/bin/env node
import './env'
import { generateMockSetup } from './mock'
import { TestNetwork } from './network'
import { mockMailer } from './util'

const run = async () => {
  console.log(`
██████╗
██╔═══██╗
██║██╗██║
██║██║██║
╚█║████╔╝
 ╚╝╚═══╝  protocol

[ created by Bluesky ]`)

  const network = await TestNetwork.create({
    pds: {
      port: 2583,
      hostname: 'localhost',
      enableDidDocWithSession: true,
    },
    bsky: {
      dbPostgresSchema: 'bsky',
      port: 2584,
      publicUrl: 'http://localhost:2584',
    },
    plc: { port: 2582 },
    ozone: {
      port: 2587,
      chatUrl: 'http://localhost:2590', // must run separate chat service
      chatDid: 'did:example:chat',
      dbMaterializedViewRefreshIntervalMs: 30_000,
    },
    introspect: { port: 2581 },
  })
  mockMailer(network.pds)

  if (network.introspect) {
    console.log(
      `🔍 Dev-env introspection server http://localhost:${network.introspect.port}`,
    )
  }
  console.log(`👤 DID Placeholder server http://localhost:${network.plc.port}`)
  console.log(`🌞 Main PDS http://localhost:${network.pds.port}`)
  console.log(`🌞 Main PDS account DB`, network.pds.ctx.cfg.db.accountDbLoc)
  console.log(
    `🔨 Lexicon authority DID ${network.pds.ctx.cfg.lexicon.didAuthority}`,
  )
  console.log(`🗼 Ozone server http://localhost:${network.ozone.port}`)
  console.log(`🗼 Ozone service DID ${network.ozone.ctx.cfg.service.did}`)
  console.log(`🌅 Bsky Appview http://localhost:${network.bsky.port}`)
  console.log(`🌅 Bsky Appview DID ${network.bsky.serverDid}`)
  for (const fg of network.feedGens) {
    console.log(`🤖 Feed Generator (${fg.did}) http://localhost:${fg.port}`)
  }

  await generateMockSetup(network)

  console.log('✅ Dev environment is ready')
}

run()
