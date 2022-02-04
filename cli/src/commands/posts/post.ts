import { service } from '@bluesky-demo/common'
import * as ucan from 'ucans'
import cmd from '../../lib/command.js'
import { Repo } from '../../lib/repo.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'post',
  category: 'posts',
  help: 'Create a new post.',
  args: [{name: 'text'}],
  async command (args) {
    const text = args._[0]
    if (!text) {
      console.error(`Error: Post text is required`)
      process.exit(1)
    }

    const repo = await Repo.load(REPO_PATH)
    const carFile = await repo.transact(async store => {
      console.log('Creating post...')
      await store.addPost({
        user: repo.account.name,
        text
      })
      return await store.getCarFile()
    })

    console.log('Uploading to server...')
    const blueskyDid = await service.getServerDid()
    const token = await ucan.build({
      audience: blueskyDid,
      issuer: repo.keypair,
      capabilities: [{
        'bluesky': repo.account.name,
        'cap': 'POST'
      }]
    })
    await service.updateUser(carFile, ucan.encode(token))
  }
})