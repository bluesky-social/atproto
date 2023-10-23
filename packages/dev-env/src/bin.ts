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

  // For Waverly
  let port = 2583
  let hostname = 'localhost'
  let defaultPublicUrl = 'https://bsky.public.url'
  if (process.env.PUBLIC_URL) {
    defaultPublicUrl = process.env.PUBLIC_URL
    if (defaultPublicUrl !== 'LOCALHOST') {
      const url = new URL(process.env.PUBLIC_URL)
      port = Number(url.port)
      hostname = url.hostname
    }
  }

  const network = await TestNetwork.create({
    pds: {
      port,
      hostname,
      dbPostgresSchema: 'pds',
    },
    bsky: {
      dbPostgresSchema: 'bsky',
      defaultPublicUrl,
    },
    plc: { port: 2582 },
  })
  mockMailer(network.pds)
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

  // For Waverly
  // Useful debug info
  console.log(`🌐 Using public bsky URL ${network.bsky.ctx.cfg.publicUrl}`)
}

run()
