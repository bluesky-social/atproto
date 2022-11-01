/**
* GENERATED CODE - DO NOT MODIFY
*/
export type ActorKnown = 'app.bsky.actorUser' | 'app.bsky.actorScene'
export type ActorUnknown = string

export interface Record {
  actorType: ActorKnown | ActorUnknown;
  [k: string]: unknown;
}
