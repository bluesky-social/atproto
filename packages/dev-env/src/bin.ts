import { generateMockSetup } from './mock'
import { TestNetworkNoAppView } from './network-no-appview'

const run = async () => {
  console.log(`
██████╗
██╔═══██╗
██║██╗██║
██║██║██║
╚█║████╔╝
 ╚╝╚═══╝  protocol

[ created by Bluesky ]`)

  const network = await TestNetworkNoAppView.create({
    pds: { port: 2583, publicUrl: 'http://localhost:2583' },
    plc: { port: 2582 },
  })
  await generateMockSetup(network)

  console.log(
    `👤 DID Placeholder server started http://localhost:${network.plc.port}`,
  )
  console.log(
    `🌞 Personal Data server started http://localhost:${network.pds.port}`,
  )
  for (const fg of network.feedGens) {
    console.log(`🤖 Feed Generator started http://localhost:${fg.port}`)
  }
}

run()
