import AddMemberConsumer from './add-member'
import RemoveMemberConsumer from './remove-member'
import AddUpvoteConsumer from './add-upvote'
import SceneVotesOnPostConsumer from './scene-votes-on-post'
import RemoveUpvoteConsumer from './remove-upvote'
import CreateNotificationConsumer from './create-notification'
import DeleteNotificationsConsumer from './delete-notifications'
import AppContext from '../../context'

export const listen = (ctx: AppContext) => {
  ctx.messageQueue.listen('add_member', new AddMemberConsumer())
  ctx.messageQueue.listen('remove_member', new RemoveMemberConsumer())
  ctx.messageQueue.listen('add_upvote', new AddUpvoteConsumer(ctx))
  ctx.messageQueue.listen(
    'scene_votes_on_post__table_updates',
    new SceneVotesOnPostConsumer(ctx),
  )
  ctx.messageQueue.listen('remove_upvote', new RemoveUpvoteConsumer(ctx))
  ctx.messageQueue.listen(
    'create_notification',
    new CreateNotificationConsumer(),
  )
  ctx.messageQueue.listen(
    'delete_notifications',
    new DeleteNotificationsConsumer(),
  )
}
