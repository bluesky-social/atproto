import cmd from '../../lib/command.js'
import { loadDelegate } from '../../lib/client.js'
import { REPO_PATH } from '../../lib/env.js'
import { TID } from '@bluesky/common'
import chalk from 'chalk'
import { formatDate } from '../../lib/util.js'

export default cmd({
  name: 'feed',
  category: 'posts',
  help: 'List posts in your feed, or the posts of the given user.',
  args: [
    { name: 'username/did', optional: true },
    { name: 'count', optional: true },
    { name: 'from', optional: true },
  ],
  async command(args) {
    const client = await loadDelegate(REPO_PATH)
    const nameOrDid = args._[0] || client.did
    const countParsed = parseInt(args._[1])
    const count = isNaN(countParsed) ? 100 : countParsed
    const fromStr = args._[2]
    const from = fromStr ? TID.fromStr(fromStr) : undefined
    const posts = await client.listPostsFromUser(nameOrDid, count, from)
    console.log(``)
    for (const post of posts) {
      console.log(post.text)
      console.log(chalk.gray(formatDate(post.time)))
      console.log(`id: ${chalk.gray(post.tid.formatted())}`)
      console.log(``)
    }
  },
})
