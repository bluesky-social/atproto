import { Headers } from '@atproto/xrpc'
import {
  ProfileViewBasic,
  ProfileView,
  ProfileViewDetailed,
} from '../../../../../lexicon/types/app/bsky/actor/defs'
import { Record as ProfileRecord } from '../../../../../lexicon/types/app/bsky/actor/profile'

export type ApiRes<T> = {
  headers: Headers
  data: T
}

export const getClock = (headers: Headers): number | null => {
  const clock = headers['atproto-clock']
  if (!clock) return null
  const parsed = parseInt(clock)
  return isNaN(parsed) ? null : parsed
}

export const updateProfileViewBasic = (
  view: ProfileViewBasic,
  record: ProfileRecord,
): ProfileViewBasic => {
  // @TODO add avatar
  return {
    ...view,
    displayName: record.displayName,
  }
}

export const updateProfileView = (
  view: ProfileView,
  record: ProfileRecord,
): ProfileView => {
  return {
    ...updateProfileViewBasic(view, record),
    description: record.description,
  }
}

export const updateProfileDetailed = (
  view: ProfileViewDetailed,
  record: ProfileRecord,
): ProfileViewDetailed => {
  // @TODO add banner
  return {
    ...updateProfileView(view, record),
  }
}
