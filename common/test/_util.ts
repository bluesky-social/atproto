import { CID } from "multiformats"
import Timestamp from "../src/timestamp.js"
import { IdMapping } from "../src/types.js"
import SSTable from "../src/user-store/ss-table.js"

export const generateBulkIds = (count: number, startAt?: number): Timestamp[] => {
  const ids = []
  const start = startAt || Date.now()
  for(let i=0; i<count; i++) {
    ids.push(new Timestamp(start - i, 1))
  }
  return ids.reverse()
}

export const generateBulkIdMapping = (count: number, cid: CID, startAt?: number): IdMapping => {
  return generateBulkIds(count, startAt)
    .reduce((acc, cur) => {
      return  {
        ...acc,
        [cur.toString()]: cid
      }

    }, {} as IdMapping)
}

export const keysFromMapping = (mapping: IdMapping): Timestamp[] => {
  return Object.keys(mapping).map(id => Timestamp.parse(id))
}

export const keysFromMappings = (mappings: IdMapping[]): Timestamp[] => {
  return mappings.map(keysFromMapping).flat()
}

export const checkInclusionInTable = (ids: Timestamp[], table: SSTable): boolean => {
  return ids
    .map(id => table.hasEntry(id))
    .every(has => has === true)
}
