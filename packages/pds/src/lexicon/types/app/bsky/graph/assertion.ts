/**
* GENERATED CODE - DO NOT MODIFY
*/
export type ActorKnown =
  | 'app.bsky.system.actorUser'
  | 'app.bsky.system.actorScene'
export type ActorUnknown = string

export interface Record {
  assertion: string;
  subject: {
    did: string,
    declaration: Declaration,
    [k: string]: unknown,
  };
  createdAt: string;
  [k: string]: unknown;
}
export interface Declaration {
  cid: string;
  actorType: ActorKnown | ActorUnknown;
  [k: string]: unknown;
}
