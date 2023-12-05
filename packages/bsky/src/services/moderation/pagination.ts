import { InvalidRequestError } from '@atproto/xrpc-server'
import { DynamicModule, sql } from 'kysely'

import { Cursor, GenericKeyset } from '../../db/pagination'

type StatusKeysetParam = {
  lastReviewedAt: string | null
  lastReportedAt: string | null
  id: number
}

export class StatusKeyset extends GenericKeyset<StatusKeysetParam, Cursor> {
  labelResult(result: StatusKeysetParam): Cursor
  labelResult(result: StatusKeysetParam) {
    const primaryField = (
      this.primary as ReturnType<DynamicModule['ref']>
    ).dynamicReference.includes('lastReviewedAt')
      ? 'lastReviewedAt'
      : 'lastReportedAt'

    return {
      primary: result[primaryField]
        ? new Date(`${result[primaryField]}`).getTime().toString()
        : '',
      secondary: result.id.toString(),
    }
  }
  labeledResultToCursor(labeled: Cursor) {
    return {
      primary: labeled.primary,
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: Cursor) {
    return {
      primary: cursor.primary
        ? new Date(parseInt(cursor.primary, 10)).toISOString()
        : '',
      secondary: cursor.secondary,
    }
  }
  unpackCursor(cursorStr?: string): Cursor | undefined {
    if (!cursorStr) return
    const result = cursorStr.split('::')
    const [primary, secondary, ...others] = result
    if (!secondary || others.length > 0) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary,
      secondary,
    }
  }
  // This is specifically built to handle nullable columns as primary sorting column
  getSql(labeled?: Cursor, direction?: 'asc' | 'desc') {
    if (labeled === undefined) return
    if (direction === 'asc') {
      return !labeled.primary
        ? sql`(${this.primary} IS NULL AND ${this.secondary} > ${labeled.secondary})`
        : sql`((${this.primary}, ${this.secondary}) > (${labeled.primary}, ${labeled.secondary}) OR (${this.primary} is null))`
    } else {
      return !labeled.primary
        ? sql`(${this.primary} IS NULL AND ${this.secondary} < ${labeled.secondary})`
        : sql`((${this.primary}, ${this.secondary}) < (${labeled.primary}, ${labeled.secondary}) OR (${this.primary} is null))`
    }
  }
}

type TimeIdKeysetParam = {
  id: number
  createdAt: string
}
type TimeIdResult = TimeIdKeysetParam

export class TimeIdKeyset extends GenericKeyset<TimeIdKeysetParam, Cursor> {
  labelResult(result: TimeIdResult): Cursor
  labelResult(result: TimeIdResult) {
    return { primary: result.createdAt, secondary: result.id.toString() }
  }
  labeledResultToCursor(labeled: Cursor) {
    return {
      primary: new Date(labeled.primary).getTime().toString(),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: Cursor) {
    const primaryDate = new Date(parseInt(cursor.primary, 10))
    if (isNaN(primaryDate.getTime())) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: primaryDate.toISOString(),
      secondary: cursor.secondary,
    }
  }
}
