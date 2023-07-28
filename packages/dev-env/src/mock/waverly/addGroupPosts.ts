import { AtUri } from '@atproto/uri'
import User from './User'
import getWaverlyUrl from './getWaverlyUrl'
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

    let embed: Images | External | undefined
    if (longPost.image) {
      // If there is an embedded image, store it as a blob and embed it
      const imageBlob = await storeImageBlob(user, longPost.image)
      embed = {
        $type: 'app.bsky.embed.images',
        images: [{ image: imageBlob, alt: 'Test image' }],
      }
    } else if (longPost.external) {
      // If there is an embedded link, possibly store the image
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
    }

    const longText = longPost.text
    let shortText = longText
    const tooLong = longText.length > maxBskyLength

    let miniblog: { uri: string; cid: string } | undefined
    // Long posts require a miniblog entry
    if (tooLong) {
      // Create the long post as a `social.waverly.miniblog`
      miniblog = await user.agent.api.social.waverly.miniblog.create(
        { repo: user.did },
        { text: longText, createdAt },
      )

      // Shorten the text for the bluesky post, and add a link
      const rkey = new AtUri(miniblog.uri).rkey
      const suffix = `... ${getWaverlyUrl(user.handle, rkey)}`
      const maxLength = maxBskyLength - suffix.length
      shortText = longText.substring(0, maxLength) + suffix
    }

    // Create the bluesky post and have the group repost it
    const bskyPost = await user.agent.api.app.bsky.feed.post.create(
      { repo: user.did },
      { text: shortText, createdAt, embed },
    )
    await betterweb.agent.api.app.bsky.feed.repost.create(
      { repo: betterweb.did },
      { subject: bskyPost, createdAt },
    )

    if (miniblog) {
      // Update the miniblog with a reference to the bluesky post
      const rkey = new AtUri(miniblog.uri).rkey
      const result = await user.agent.api.social.waverly.miniblog.get({
        repo: user.did,
        rkey,
      })
      result.value.subject = bskyPost

      await user.agent.api.com.atproto.repo.putRecord({
        repo: user.did,
        collection: 'social.waverly.miniblog',
        rkey,
        record: result.value,
      })
    }

    userIndex = (userIndex + 1) % users.length
  }
}
