import { DidableKey } from '@atproto/crypto'
import ServerAuth from '../../auth'
import AddMemberConsumer from './add-member'
import RemoveMemberConsumer from './remove-member'
import AddUpvoteConsumer from './add-upvote'
import RemoveUpvoteConsumer from './remove-upvote'
import CreateNotificationConsumer from './create-notification'
import DeleteNotificationsConsumer from './delete-notifications'
import { MessageQueue } from '../types'
import { BlobStore } from '@atproto/repo'

export const listen = (
  messageQueue: MessageQueue,
  blobstore: BlobStore,
  auth: ServerAuth,
  keypair: DidableKey,
) => {
  const getAuthStore = (did: string) => {
    return auth.verifier.loadAuthStore(keypair, [], did)
  }
  messageQueue.listen('add_member', new AddMemberConsumer())
  messageQueue.listen('remove_member', new RemoveMemberConsumer())
  messageQueue.listen(
    'add_upvote',
    new AddUpvoteConsumer(getAuthStore, messageQueue, blobstore),
  )
  messageQueue.listen('remove_upvote', new RemoveUpvoteConsumer())
  messageQueue.listen('create_notification', new CreateNotificationConsumer())
  messageQueue.listen('delete_notifications', new DeleteNotificationsConsumer())
}
