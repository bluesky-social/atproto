import User from './User'
import aliceAvatarB64 from './img/alice-avatar-b64'
import carlaAvatarB64 from './img/carla-avatar-b64'
import betterWebAvatarB64 from './img/better-web-avatar-b64'
import { BlobRef } from '@atproto/api'
import { Record as Profile } from '@atproto/api/src/client/types/app/bsky/actor/profile'

interface UserUpdate {
  avatar?: string
  displayName?: string
}

const userUpdates: { [handle: string]: UserUpdate } = {
  'alice.test': { avatar: aliceAvatarB64 },
  'carla.test': { avatar: carlaAvatarB64 },
  'betterweb.group': { avatar: betterWebAvatarB64, displayName: 'Better Web' },
}

export default async (users: User[]) => {
  for (const user of users) {
    const update = userUpdates[user.handle]
    if (!update) continue

    let avatar: BlobRef | undefined
    if (update.avatar) {
      const avatarImg = Buffer.from(update.avatar, 'base64')
      avatar = (
        await user.agent.api.com.atproto.repo.uploadBlob(avatarImg, {
          encoding: 'image/png',
        })
      ).data.blob
    }

    const profile = await user.agent.api.com.atproto.repo.getRecord({
      repo: user.did,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
    })
    const record = profile.data.value as Profile

    if (avatar) record.avatar = avatar
    if (update.displayName) record.displayName = update.displayName

    await user.agent.api.com.atproto.repo.putRecord({
      repo: user.did,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
      record,
    })
  }
}
