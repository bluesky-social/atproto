import User from './User'
import longPosts from './longPosts'
import postMiniBlog from './post'

export default async (allUsers: User[], date: Generator<string>) => {
  const betterweb = allUsers.find((u) => u.handle === 'betterweb.group')
  if (!betterweb) throw new Error('Cannot find group user betterweb')

  const users = allUsers.filter((u) => !u.handle.endsWith('.group'))
  if (users.length === 0) throw new Error('Cannot find non-group users')

  let userIndex = 0
  for (const longPost of longPosts) {
    const user = users[userIndex]

    await postMiniBlog(longPost, user, betterweb, date)

    userIndex = (userIndex + 1) % users.length
  }
}
