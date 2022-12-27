import { BlobStore } from '@atproto/repo'
import * as crypto from '@atproto/crypto'
import AddMemberConsumer from './add-member'
import RemoveMemberConsumer from './remove-member'
import AddUpvoteConsumer from './add-upvote'
import SceneVotesOnPostConsumer from './scene-votes-on-post'
import RemoveUpvoteConsumer from './remove-upvote'
import CreateNotificationConsumer from './create-notification'
import DeleteNotificationsConsumer from './delete-notifications'
import { MessageQueue } from '../types'

export const listen = (
  messageQueue: MessageQueue,
  blobstore: BlobStore,
  keypair: crypto.Keypair,
) => {
  messageQueue.listen('add_member', new AddMemberConsumer())
  messageQueue.listen('remove_member', new RemoveMemberConsumer())
  messageQueue.listen('add_upvote', new AddUpvoteConsumer())
  messageQueue.listen(
    'scene_votes_on_post__table_updates',
    new SceneVotesOnPostConsumer(keypair, messageQueue, blobstore),
  )
  messageQueue.listen('remove_upvote', new RemoveUpvoteConsumer())
  messageQueue.listen('create_notification', new CreateNotificationConsumer())
  messageQueue.listen('delete_notifications', new DeleteNotificationsConsumer())
}
