/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoAdminRepo from './repo'
import * as ComAtprotoAdminModerationAction from './moderationAction'
import * as ComAtprotoAdminModerationReport from './moderationReport'

export interface View {
  uri: string
  cid: string
  value: {}
  indexedAt: string
  moderation: Moderation
  repo: ComAtprotoAdminRepo.View
  [k: string]: unknown
}

export function isView(v: unknown): v is View {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.record#view'
  )
}

export function validateView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.record#view', v)
}

export interface ViewDetail {
  uri: string
  cid: string
  value: {}
  indexedAt: string
  moderation: ModerationDetail
  repo: ComAtprotoAdminRepo.View
  [k: string]: unknown
}

export function isViewDetail(v: unknown): v is ViewDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.record#viewDetail'
  )
}

export function validateViewDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.record#viewDetail', v)
}

export interface Moderation {
  takedownId?: number
  [k: string]: unknown
}

export function isModeration(v: unknown): v is Moderation {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.record#moderation'
  )
}

export function validateModeration(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.record#moderation', v)
}

export interface ModerationDetail {
  actions: ComAtprotoAdminModerationAction.View[]
  reports: ComAtprotoAdminModerationReport.View[]
  takedownId?: number
  [k: string]: unknown
}

export function isModerationDetail(v: unknown): v is ModerationDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.record#moderationDetail'
  )
}

export function validateModerationDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.record#moderationDetail', v)
}
