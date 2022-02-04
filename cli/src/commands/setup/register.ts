import { Repo } from '../../lib/repo.js'
import { service } from '@bluesky-demo/common'
import * as ucan from 'ucans'
import cmd from '../../lib/command.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'register',
  category: 'setup',
  help: 'Registers the repo with the configured server.',
  args: [],
  opts: [],
  async command (args) {
    const repo = await Repo.load(REPO_PATH)
    console.log('Registering with server...')
    try {
      // TODO - service needs to use `server`
      const userStore = await repo.getLocalUserStore()
      const blueskyDid = await service.getServerDid()
      const token = await ucan.build({
        audience: blueskyDid,
        issuer: repo.keypair
      })
      await service.register(await userStore.getCarFile(), ucan.encode(token))
    } catch (e: any) {
      console.error(`Failed to register with server`)
      console.error(e.toString())
    }
  }
})