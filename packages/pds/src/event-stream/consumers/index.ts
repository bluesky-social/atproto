import CreateNotificationConsumer from './create-notification'
import DeleteNotificationsConsumer from './delete-notifications'
import AppContext from '../../context'

export const listen = (ctx: AppContext) => {
  ctx.messageQueue.listen(
    'create_notification',
    new CreateNotificationConsumer(),
  )
  ctx.messageQueue.listen(
    'delete_notifications',
    new DeleteNotificationsConsumer(),
  )
}
