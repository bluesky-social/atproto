import { BlobStore } from '@atproto/repo'
import { DidableKey } from '@atproto/crypto'
import ServerAuth from '../../auth'
import AddMemberConsumer from './add-member'
import RemoveMemberConsumer from './remove-member'
import AddUpvoteConsumer from './add-upvote'
import SceneVotesOnPostConsumer from './scene-votes-on-post'
import RemoveUpvoteConsumer from './remove-upvote'
import CreateNotificationConsumer from './create-notification'
import DeleteNotificationsConsumer from './delete-notifications'
import { MessageOfType, MessageQueue } from '../types'
import Database from '../../db'
import {
  isAddMember,
  isAddUpvote,
  isCreateNotification,
  isDeleteNotifications,
  isRemoveMember,
  isRemoveUpvote,
  isSceneVotesOnPostTableUpdates,
} from '../messages'

export const listen = (
  messageQueue: MessageQueue,
  blobstore: BlobStore,
  auth: ServerAuth,
  keypair: DidableKey,
) => {
  const getAuthStore = (did: string) => {
    return auth.verifier.loadAuthStore(keypair, [], did)
  }

  const addMemberConsumer = new AddMemberConsumer()
  const removeMemberConsumer = new RemoveMemberConsumer()
  const addUpvoteConsumer = new AddUpvoteConsumer()
  const sceneVotesOnPostConsumer = new SceneVotesOnPostConsumer(
    getAuthStore,
    messageQueue,
    blobstore,
  )
  const removeUpvoteConsumer = new RemoveUpvoteConsumer()
  const createNotificationConsumer = new CreateNotificationConsumer()
  const deleteNotificationsConsumer = new DeleteNotificationsConsumer()

  messageQueue.listen('*', {
    async listener(ctx: { message: MessageOfType; db: Database }) {
      const { message, db } = ctx
      if (isAddMember(message)) {
        return addMemberConsumer.dispatch({ message, db })
      } else if (isRemoveMember(message)) {
        return removeMemberConsumer.dispatch({ message, db })
      } else if (isAddUpvote(message)) {
        return addUpvoteConsumer.dispatch({ message, db })
      } else if (isSceneVotesOnPostTableUpdates(message)) {
        return sceneVotesOnPostConsumer.dispatch({ message, db })
      } else if (isRemoveUpvote(message)) {
        return removeUpvoteConsumer.dispatch({ message, db })
      } else if (isCreateNotification(message)) {
        return createNotificationConsumer.dispatch({ message, db })
      } else if (isDeleteNotifications(message)) {
        return deleteNotificationsConsumer.dispatch({ message, db })
      }
      throw new Error('Catch-all listener could not handle message')
    },
  })
}
