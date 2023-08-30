import { AtUri } from '@atproto/uri'
import User from './User'
import getWaverlyUri from './getWaverlyUri'
import longPosts from './longPosts'
import { Main as Images } from '@atproto/api/src/client/types/app/bsky/embed/images'
import { Main as External } from '@atproto/api/src/client/types/app/bsky/embed/external'
import { BlobRef } from '@atproto/api'

const maxBskyLength = 300

const storeImageBlob = async (user: User, image: string) => {
  const imageBuffer = Buffer.from(image, 'base64')
  const res = await user.agent.api.com.atproto.repo.uploadBlob(imageBuffer, {
    encoding: 'image/png',
  })

  return res.data.blob
}

export default async (allUsers: User[], date: Generator<string>) => {
  const betterweb = allUsers.find((u) => u.handle === 'betterweb.group')
  if (!betterweb) throw new Error('Cannot find group user betterweb')

  const users = allUsers.filter((u) => !u.handle.endsWith('.group'))
  if (users.length === 0) throw new Error('Cannot find non-group users')

  let userIndex = 0
  for (const longPost of longPosts) {
    const user = users[userIndex]
    const createdAt = date.next().value

    // Create the miniblog
    const longText = longPost.text

    const miniblog = await user.agent.api.social.waverly.miniblog.create(
      { repo: user.did },
      { text: longText, createdAt },
    )
    const title = truncateString(longText, 60)
    const description = truncateString(longText, 160)
    const miniblogRkey = new AtUri(miniblog.uri).rkey
    const waverlyUri = getWaverlyUri(user.handle, miniblogRkey)

    // Create the embed for the bluesky post
    let miniblogLinkEmbedded = false
    let embed: Images | External | undefined
    if (longPost.image) {
      // If there is an embedded image, store it as a blob and embed it
      const imageBlob = await storeImageBlob(user, longPost.image)
      embed = {
        $type: 'app.bsky.embed.images',
        images: [{ image: imageBlob, alt: 'Test image' }],
      }
    } else if (longPost.external) {
      // If there is an embedded link, possibly store the image then create an
      // embed for the external link
      let thumbBlob: BlobRef | undefined
      if (longPost.external.thumb) {
        thumbBlob = await storeImageBlob(user, longPost.external.thumb)
      }
      embed = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: longPost.external.uri,
          title: longPost.external.title,
          description: longPost.external.description,
          thumb: thumbBlob,
        },
      }
    } else {
      // If there is no attachment, embed an external link to the miniblog
      miniblogLinkEmbedded = true
      embed = {
        $type: 'app.bsky.embed.external',
        external: { uri: waverlyUri, title, description },
      }
    }

    // Create the bluesky post with an embedded link to the miniblog, if
    // possible. If not, add the link to the body of the post.
    const truncateLength = miniblogLinkEmbedded
      ? maxBskyLength
      : maxBskyLength - waverlyUri.length - 1
    let blueskyText = truncateString(longText, truncateLength)
    if (!miniblogLinkEmbedded) {
      if (blueskyText.length > 0) blueskyText += ' '
      blueskyText += waverlyUri
    }

    const bskyPost = await user.agent.api.app.bsky.feed.post.create(
      { repo: user.did },
      { text: blueskyText, embed, createdAt },
    )

    const groupText = `Reshared in ${betterweb.handle} Waverly group.`

    await betterweb.agent.api.app.bsky.feed.post.create(
      { repo: betterweb.did },
      {
        text: groupText,
        reply: { root: bskyPost, parent: bskyPost },
        embed: {
          $type: 'app.bsky.embed.external',
          external: { uri: waverlyUri, title, description },
        },
        createdAt,
      },
    )

    // Update the miniblog with a reference to the bluesky post
    const result = await user.agent.api.social.waverly.miniblog.get({
      repo: user.did,
      rkey: miniblogRkey,
    })
    result.value.subject = bskyPost
    await user.agent.api.com.atproto.repo.putRecord({
      repo: user.did,
      collection: 'social.waverly.miniblog',
      rkey: miniblogRkey,
      record: result.value,
    })

    userIndex = (userIndex + 1) % users.length
  }
}

function truncateString(s: string, maxLength: number) {
  if (s.length <= maxLength) return s
  return s.substring(0, maxLength - 3) + '...'
}
