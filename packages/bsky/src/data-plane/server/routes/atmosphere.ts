import type { ServiceImpl } from '@connectrpc/connect'
import type { Service } from '../../../proto/bsky_connect.js'

/** Empty Atmosphere responses for the local dataplane. */
export function atmosphere(): Partial<ServiceImpl<typeof Service>> {
  return {
    async getAtmosphereTimeline() {
      return { items: [] }
    },
    async getRecordsByRef() {
      return { results: [] }
    },
    async getRecordsByURI() {
      return { results: [] }
    },
    async getAtmosphereBacklinkCounts() {
      return { results: [] }
    },
    async getAtmosphereBacklinks() {
      return { backlinks: [] }
    },
    async getAtmosphereBacklinksByActor() {
      return { results: [], truncated: false }
    },
  }
}
