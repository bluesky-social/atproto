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

  const network = await TestNetwork.create()
  await generateMockSetup(network)
}

run()
