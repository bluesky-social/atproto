/**
* GENERATED CODE - DO NOT MODIFY
*/
export interface Record {
  assertion:
    | AppBskyBadgeInviteAssertion
    | AppBskyBadgeEmployeeAssertion
    | AppBskyBadgeTagAssertion
    | AppBskyBadgeUnknownAssertion;
  createdAt: string;
  [k: string]: unknown;
}
export interface AppBskyBadgeInviteAssertion {
  type: 'invite';
  [k: string]: unknown;
}
export interface AppBskyBadgeEmployeeAssertion {
  type: 'employee';
  [k: string]: unknown;
}
export interface AppBskyBadgeTagAssertion {
  type: 'tag';
  tag: string;
  [k: string]: unknown;
}
export interface AppBskyBadgeUnknownAssertion {
  type: string;
  [k: string]: unknown;
}
