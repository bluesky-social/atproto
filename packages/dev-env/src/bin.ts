import { generateMockSetup } from './mock'
import { TestNetwork } from './network'

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
      publicUrl: 'http://localhost:2583',
      dbPostgresSchema: 'pds',
    },
    bsky: {
      dbPostgresSchema: 'bsky',
    },
    plc: { port: 2582 },
  })
  await generateMockSetup(network)

  console.log(
    `👤 DID Placeholder server started http://localhost:${network.plc.port}`,
  )
  console.log(
    `🌞 Personal Data server started http://localhost:${network.pds.port}`,
  )
  console.log(`🌅 Bsky Appview started http://localhost:${network.bsky.port}`)
  for (const fg of network.feedGens) {
    console.log(`🤖 Feed Generator started http://localhost:${fg.port}`)
  }
}

run()
