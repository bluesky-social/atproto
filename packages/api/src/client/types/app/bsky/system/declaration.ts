/**
* GENERATED CODE - DO NOT MODIFY
*/
export type ActorKnown =
  | 'app.bsky.system.actorUser'
  | 'app.bsky.system.actorScene'
export type ActorUnknown = string

export interface Record {
  actorType: ActorKnown | ActorUnknown;
  [k: string]: unknown;
}
