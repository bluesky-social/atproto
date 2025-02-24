import {
  Main as ExternalEmbed,
  View as ExternalEmbedView,
} from '../lexicon/types/app/bsky/embed/external'
import {
  Main as ImagesEmbed,
  View as ImagesEmbedView,
} from '../lexicon/types/app/bsky/embed/images'
import {
  Main as RecordEmbed,
  View as RecordEmbedView,
  ViewRecord as PostEmbedView,
} from '../lexicon/types/app/bsky/embed/record'
import {
  Main as RecordWithMedia,
  View as RecordWithMediaView,
} from '../lexicon/types/app/bsky/embed/recordWithMedia'
import {
  Main as VideoEmbed,
  View as VideoEmbedView,
} from '../lexicon/types/app/bsky/embed/video'
import {
  BlockedPost,
  GeneratorView,
  NotFoundPost,
  PostView,
} from '../lexicon/types/app/bsky/feed/defs'
import {
  ListView,
  StarterPackViewBasic,
} from '../lexicon/types/app/bsky/graph/defs'
import { LabelerView } from '../lexicon/types/app/bsky/labeler/defs'

export type {
  Main as ImagesEmbed,
  View as ImagesEmbedView,
} from '../lexicon/types/app/bsky/embed/images'
export { isMain as isImagesEmbed } from '../lexicon/types/app/bsky/embed/images'
export type {
  Main as VideoEmbed,
  View as VideoEmbedView,
} from '../lexicon/types/app/bsky/embed/video'
export { isMain as isVideoEmbed } from '../lexicon/types/app/bsky/embed/video'
export type {
  Main as ExternalEmbed,
  View as ExternalEmbedView,
} from '../lexicon/types/app/bsky/embed/external'
export { isMain as isExternalEmbed } from '../lexicon/types/app/bsky/embed/external'
export type {
  Main as RecordEmbed,
  View as RecordEmbedView,
  ViewBlocked as EmbedBlocked,
  ViewDetached as EmbedDetached,
  ViewNotFound as EmbedNotFound,
  ViewRecord as PostEmbedView,
} from '../lexicon/types/app/bsky/embed/record'
export { isMain as isRecordEmbed } from '../lexicon/types/app/bsky/embed/record'
export type {
  Main as RecordWithMedia,
  View as RecordWithMediaView,
} from '../lexicon/types/app/bsky/embed/recordWithMedia'
export { isMain as isRecordWithMedia } from '../lexicon/types/app/bsky/embed/recordWithMedia'
export type { View as RecordWithMediaEmbedView } from '../lexicon/types/app/bsky/embed/recordWithMedia'
export type {
  BlockedPost,
  GeneratorView,
  NotFoundPost,
  PostView,
} from '../lexicon/types/app/bsky/feed/defs'
export type { ListView } from '../lexicon/types/app/bsky/graph/defs'

export type { Notification as NotificationView } from '../lexicon/types/app/bsky/notification/listNotifications'

export type Embed =
  | ImagesEmbed
  | VideoEmbed
  | ExternalEmbed
  | RecordEmbed
  | RecordWithMedia

export type EmbedView =
  | ImagesEmbedView
  | VideoEmbedView
  | ExternalEmbedView
  | RecordEmbedView
  | RecordWithMediaView

export type MaybePostView = PostView | NotFoundPost | BlockedPost

export type RecordEmbedViewInternal =
  | PostEmbedView
  | GeneratorView
  | ListView
  | LabelerView
  | StarterPackViewBasic
