import { loadClient } from '../../lib/client.js'
import { loadCfg } from '../../lib/config.js'
import cmd from '../../lib/command.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'register',
  category: 'setup',
  help: 'Registers the repo with the configured server.',
  args: [],
  opts: [],
  async command(_args) {
    const client = await loadClient(REPO_PATH)
    const cfg = await loadCfg(REPO_PATH)
    console.log('Registering with server...')
    try {
      await client.register(cfg.account.username)
    } catch (e) {
      console.error(`Failed to register with server`)
      console.error(e)
    }
  },
})
