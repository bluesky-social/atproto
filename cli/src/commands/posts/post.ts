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
    const store = await repo.getLocalUserStore()

    console.log('Creating post...')
    await store.addPost({
      user: repo.account.name,
      text
    })
    await repo.rootCidFile.put(store.root)

    console.log('Uploading to server...')
    const car = await store.getCarFile()
    const blueskyDid = await service.getServerDid()
    const token = await ucan.build({
      audience: blueskyDid,
      issuer: repo.keypair,
      capabilities: [{
        'bluesky': repo.account.name,
        'cap': 'POST'
      }]
    })
    await service.updateUser(car, ucan.encode(token))
  }
})