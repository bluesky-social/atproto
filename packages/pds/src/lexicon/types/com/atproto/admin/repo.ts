/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import * as ComAtprotoAdminModerationAction from './moderationAction'
import * as ComAtprotoAdminModerationReport from './moderationReport'

export interface View {
  did: string
  handle: string
  account?: Account
  relatedRecords: {}[]
  indexedAt: string
  moderation: Moderation
  [k: string]: unknown
}

export function isView(v: unknown): v is View {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'com.atproto.admin.repo#view'
  )
}

export function validateView(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.repo#view', v)
}

export interface ViewDetail {
  did: string
  handle: string
  account?: Account
  relatedRecords: {}[]
  indexedAt: string
  moderation: ModerationDetail
  [k: string]: unknown
}

export function isViewDetail(v: unknown): v is ViewDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.repo#viewDetail'
  )
}

export function validateViewDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.repo#viewDetail', v)
}

export interface Account {
  email: string
  [k: string]: unknown
}

export function isAccount(v: unknown): v is Account {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.repo#account'
  )
}

export function validateAccount(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.repo#account', v)
}

export interface Moderation {
  currentAction?: ComAtprotoAdminModerationAction.ViewCurrent
  [k: string]: unknown
}

export function isModeration(v: unknown): v is Moderation {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.repo#moderation'
  )
}

export function validateModeration(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.repo#moderation', v)
}

export interface ModerationDetail {
  currentAction?: ComAtprotoAdminModerationAction.ViewCurrent
  actions: ComAtprotoAdminModerationAction.View[]
  reports: ComAtprotoAdminModerationReport.View[]
  [k: string]: unknown
}

export function isModerationDetail(v: unknown): v is ModerationDetail {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.admin.repo#moderationDetail'
  )
}

export function validateModerationDetail(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.admin.repo#moderationDetail', v)
}
