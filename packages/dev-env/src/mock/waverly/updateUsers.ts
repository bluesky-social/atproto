import User from './User'
import aliceAvatarB64 from './img/alice-avatar-b64'
import carlaAvatarB64 from './img/carla-avatar-b64'
import betterWebAvatarB64 from './img/better-web-avatar-b64'
import philAvatarB64 from './img/phil-avatar-b64'
import kiraAvatarB64 from './img/kira-avatar-b64'
import daveAvatarB64 from './img/dave-avatar-b64'
import amanAvatarB64 from './img/aman-avatar-b64'
import aiEverydayAvatarB64 from './img/ai-everyday-avatar-b64'
import aiGlamAvatarB64 from './img/ai-glam-avatar-b64'
import photoTrioAvatarB64 from './img/photo-trio-avatar-b64'
import smartGadgetsAvatarB64 from './img/smart-gadgets-avatar-b64'
import { BlobRef } from '@atproto/api'
import { Record as Profile } from '@atproto/api/src/client/types/app/bsky/actor/profile'

interface UserUpdate {
  avatar?: string
  displayName?: string
}

const userUpdates: { [handle: string]: UserUpdate } = {
  'alice.test': { avatar: aliceAvatarB64 },
  'carla.test': { avatar: carlaAvatarB64 },
  'phil.test': { avatar: philAvatarB64, displayName: 'Philippe Beaudoin' },
  'dave.test': { avatar: daveAvatarB64, displayName: 'Dave Burke' },
  'kira.test': { avatar: kiraAvatarB64, displayName: 'Kira Cheung' },
  'aman.test': { avatar: amanAvatarB64, displayName: 'Aman Patel' },
  'betterweb.group': { avatar: betterWebAvatarB64, displayName: 'Better Web' },
  'aimagiceveryday.group': {
    avatar: aiEverydayAvatarB64,
    displayName: 'AI Magic Everyday',
  },
  'aiglamsquad.group': {
    avatar: aiGlamAvatarB64,
    displayName: 'AI Glam Squad, like totally💅',
  },
  'thephototriothatrules.group': {
    avatar: photoTrioAvatarB64,
    displayName: 'The Photo Trio That Rules',
  },
  'smarthomegadgets.group': {
    avatar: smartGadgetsAvatarB64,
    displayName: 'Smart Home Gadgets',
  },
  'testgroup.group': {
    displayName: 'Test Group',
  },
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
