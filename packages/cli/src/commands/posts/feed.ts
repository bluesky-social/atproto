import cmd from '../../lib/command'
import { loadClient } from '../../lib/client'
import { REPO_PATH } from '../../lib/env'
import { TID } from '@adxp/common'
import chalk from 'chalk'
import { formatDate } from '../../lib/util'

export default cmd({
  name: 'feed',
  category: 'posts',
  help: 'List posts in your feed, or the posts of the given user.',
  args: [
    { name: 'username', optional: true },
    { name: 'count', optional: true },
    { name: 'from', optional: true },
  ],
  async command(args) {
    const client = await loadClient(REPO_PATH)
    const username = args._[0] || client.did
    const countParsed = parseInt(args._[1])
    const count = isNaN(countParsed) ? 100 : countParsed
    const fromStr = args._[2]
    const from = fromStr ? TID.fromStr(fromStr) : undefined
    const feed = await client.retrieveFeed(username, count, from)
    if (!feed) {
      console.log('Could not find user: ', username)
      return
    }
    console.log(``)
    for (const post of feed) {
      console.log(`"${post.text}" - ${post.author_name}`)
      console.log(`Likes: ${post.likes}`)
      console.log(chalk.gray(formatDate(post.time)))
      console.log(chalk.gray(`id: ${post.tid.formatted()}`))
      console.log(``)
    }
  },
})
