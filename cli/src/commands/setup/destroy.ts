import prompt from 'prompt'
import cmd from '../../lib/command.js'
import { REPO_PATH } from '../../lib/env.js'
import * as config from '../../lib/config.js'

prompt.colors = false
prompt.message = ''

export default cmd({
  name: 'destroy',
  category: 'setup',
  help: 'Destroy the local copy of your user account',
  opts: [],
  async command(args) {
    console.log(`Repo path: ${REPO_PATH}`)
    prompt.start()
    const isSure = await prompt.get({
      description: 'Are you sure? This keypair will be unrecoverable',
      type: 'boolean',
      required: true,
      default: false,
    })
    if (!isSure) {
      console.log('Exiting without deleting')
      return
    }

    await config.destroy(REPO_PATH)
    console.log(`Repo deleted at: ${REPO_PATH}`)
  },
})
