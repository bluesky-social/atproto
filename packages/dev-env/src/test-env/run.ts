import { TestNetwork } from './network'

const run = async () => {
  logStart()
  const network = await TestNetwork.create()
}

const logStart = () => {
  console.log(`
██████╗
██╔═══██╗
██║██╗██║
██║██║██║
╚█║████╔╝
 ╚╝╚═══╝  protocol

[ created by Bluesky ]`)
}
