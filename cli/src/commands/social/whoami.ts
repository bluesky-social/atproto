import chalk from 'chalk'
import { loadDelegate } from '../../lib/client.js'
import cmd from '../../lib/command.js'
import { loadCfg } from '../../lib/config.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'whoami',
  category: 'social',
  help: 'Display the profile of the local user.',
  args: [],
  opts: [],
  async command(args) {
    const cfg = await loadCfg(REPO_PATH)
    const client = await loadDelegate(REPO_PATH)
    console.log(`${cfg.account.username} ${chalk.gray(client.did)}`)
    // @TODO display follow/follwer/post counts
  },
})
