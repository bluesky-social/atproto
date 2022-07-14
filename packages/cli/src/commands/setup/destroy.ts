import prompt from 'prompt'
import cmd from '../../lib/command'
import { REPO_PATH } from '../../lib/env'
import * as config from '../../lib/config'

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
      description: 'Are you sure? This keypair will be unrecoverable [y/N]',
      type: 'string',
      pattern: /y|yes|n|no/,
      required: true,
      default: 'no',
    })
    if (isSure.question === 'n' || isSure.question === 'no') {
      console.log('Exiting without deleting')
      return
    }

    await config.destroy(REPO_PATH)
    console.log(`Repo deleted at: ${REPO_PATH}`)
  },
})
