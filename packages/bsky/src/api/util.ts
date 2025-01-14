import { FeedPresentation } from '../proto/bsky_pb'
import { ParsedLabelers, formatLabelerHeader } from '../util'

export const ATPROTO_CONTENT_LABELERS = 'Atproto-Content-Labelers'
export const ATPROTO_REPO_REV = 'Atproto-Repo-Rev'

type ResHeaderOpts = {
  labelers: ParsedLabelers
  repoRev: string | null
}

export const resHeaders = (
  opts: Partial<ResHeaderOpts>,
): Record<string, string> => {
  const headers = {}
  if (opts.labelers) {
    headers[ATPROTO_CONTENT_LABELERS] = formatLabelerHeader(opts.labelers)
  }
  if (opts.repoRev) {
    headers[ATPROTO_REPO_REV] = opts.repoRev
  }
  return headers
}

export const clearlyBadCursor = (cursor?: string) => {
  // hallmark of v1 cursor, highly unlikely in v2 cursors based on time or rkeys
  return !!cursor?.includes('::')
}

const PRESENTATION_TO_FEED_PRESENTATION = {
  immersive: FeedPresentation.IMMERSIVE,
}

export const presentationToFeedPresentation = (
  presentation: string | undefined,
): FeedPresentation => {
  if (presentation && presentation in PRESENTATION_TO_FEED_PRESENTATION) {
    return PRESENTATION_TO_FEED_PRESENTATION[presentation]
  }
  return FeedPresentation.DEFAULT
}
