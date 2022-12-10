import { DidableKey } from '@atproto/crypto'
import ServerAuth from '../../auth'
import { MessageQueue } from '../../db/types'
import AddMember from './add-member'
import RemoveMember from './remove-member'
import AddUpvote from './add-upvote'
import RemoveUpvote from './remove-upvote'
import CreateNotification from './create-notification'
import DeleteNotifications from './delete-notifications'

export const listen = (
  messageQueue: MessageQueue,
  auth: ServerAuth,
  keypair: DidableKey,
) => {
  const getAuthStore = (did: string) => {
    return auth.verifier.loadAuthStore(keypair, [], did)
  }
  messageQueue.listen('add_member', new AddMember().listener)
  messageQueue.listen('remove_member', new RemoveMember().listener)
  messageQueue.listen('add_upvote', new AddUpvote(getAuthStore).listener)
  messageQueue.listen('remove_upvote', new RemoveUpvote().listener)
  messageQueue.listen('create_notification', new CreateNotification().listener)
  messageQueue.listen(
    'delete_notifications',
    new DeleteNotifications().listener,
  )
}
