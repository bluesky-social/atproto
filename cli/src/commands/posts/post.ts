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
    const repo = await Repo.load(REPO_PATH)
    
    console.log('Creating post...')
    const store = await repo.transact(async store => {
      await store.addPost({
        user: repo.account.name,
        text
      })
      return store
    })

    console.log('Uploading to server...')
    await repo.uploadToServer(store)
  }
})