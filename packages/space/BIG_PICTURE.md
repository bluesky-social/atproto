# Permission Space
A permission space (or space for short) is an authorization and sync boundary for permissioned records representing a shared social context in the network. It can include many different types of records from many users. Each user stores their own records for a given space on their own PDS. The space exists not as a physical container but as a coordination concept: a shared identity, access control list, and sync boundary. Spaces can scale all the way down to a user’s personal data such as bookmarks/mutes or all the way up to a million(s) person forum or group.

## Space Owner
Each space is associated with a space owner: a DID that serves as the authority or root of trust for that space. Space owners can establish many spaces. The space owner’s DID document contains at minimum a signing key and a service endpoint for the space.

For personal data, the space owner is simply the user's own DID. For shared spaces like communities, a dedicated space DID is preferable. A dedicated DID allows ownership to be transferred by updating the DID document without breaking any existing references into the space.

By default, users will be able to host a space on their PDS and the reference implementation for spaces will ship in the PDS. However the notion of a space and the interface for services that host a space is defined at the protocol level and not inherently linked to the PDS. Any service may create and host a space if it supports the required APIs.

This likely means that we will need a “controlled DID” system on the PDS so that user accounts can manage community space DIDs. The intent would be to keep this system as lightweight as possible and avoid a generic controlled account system.

## Space Type
Each space has an NSID that describes the “type” or “modality” of the space - what kind of data it contains and how it's used. This type is defined by a published lexicon and serves as the OAuth consent boundary. When a user logs into an application, they grant access based on the type of space. For example: app.bsky.group, com.atmoboards.forum, app.bsky.personal.

## Permissioned Repo
For each space that a user participates in, they have a permissioned repo. Each user is expected to have many permissioned repos. A permissioned repo exposes a CRUD interface that is similar to the public repo and may contain many different types of records. A space is composed of anywhere from 1 to millions of permissioned repos.

## Record addressing
A space is addressed by the space owner, the type, and a key. The space key (skey) is similar to a record key (rkey); it’s an arbitrary string that differentiates multiple spaces of the same type under the same owner.

To address a permissioned record, six pieces of information are needed:
- Space owner (DID)
- Space type (NSID)
- Space key (string)
- User (DID)
- Collection (NSID)
- Record key (string)

We’re currently arguing about what should be considered the authority of the URI. The user DID because the record is hosted by the user and authority for the record ultimately rests with the user? Or the space owner DID because it authorizes a user’s ability to create a record in the space in the first place?

We haven't settled on a scheme yet. It probably won't be at:// — permissioned data URIs resolve through a completely different protocol from public data, and as such, we feel they should be visually distinct. ats:// is a likely candidate.

# Access control
## Member list
Each space has a single member list. Each entry is a (DID, read|write) tuple. Write access is inclusive of read access. This is the only ACL data structure.

Write enforcement is ultimately handled by readers of the space. Any user can purport to write to a space on their PDS, but readers of the space compare incoming records against the member list and use that to define the real content perimeter.

The member list is published by the space owner and is synced via the same sync protocol as permissioned repos.

Space credentials
To read records from a space, a reader needs a space credential. A space credential is a stateless authorization token issued by the space owner. 

They are: 

- Short-lived (~2-4 hour expiration)
- Scoped to a specific space
- Asymmetrically signed by the space owner's key and thus verifiable without coordinating with the owner
- Usable with any member PDS to read space contents

Space credentials are how applications gain access to sync repos within a space. A service that wants to sync space contents does the following: 
- uses an OAuth credential from a member user to obtain a member grant token (similar to a service auth token but bound to client ID) from that user's PDS
- presents that grant token to the space owner in exchange for a space credential
- uses the space credential to sync the member list from the space owner and sync records from each member's PDS

When a service loses all its member OAuth sessions (because users left or revoked access) it can no longer renew its credential and naturally loses access to the space.

## Application allow/deny lists
Spaces can be configured as "default allow" or "default deny" for service access. In default-deny mode, an explicit allowlist of application client IDs can be specified. In default-allow mode, a denylist. This is internal space configuration and is not visible to members, though applications may choose to publish it in a record if they want to.

Default allow is considered the natural choice for spaces. It supports atmospheric interoperation (internection? 😏) between applications. Default deny is offered for social modalities that are more context specific, scoped to a particular ecosystem/community, or have more rigorous security needs.

This configuration would be handled by the app that creates the space, in tandem with the user. They are in the best position to understand the security/privacy implications of interoperation with third-party clients.

# Sync
Sync is pull-based. Applications are responsible for staying in sync with all member PDSes. PDSes assist by sending lightweight write notifications to prompt pulls when new data is written.

## Permissioned repo commits
Each user’s permissioned repo within a space is represented by a cryptographic commit: a compact digest that characterizes the current set of live records, independent of history. 

We use ECMH (Elliptic Curve Multiset Hash), a set hash where adding or removing an element is a single point operation rather than a full recompute of the hash. Two permissioned repos with the same live records produce the same digest regardless of the history of operations.

This commitment plays the same role as the MST root hash for public data: a single value that definitively characterizes what's in the repo. Unlike the MST, it does not support partial sync or single record proofs. The tradeoff is a noticeably lower overhead cryptographic structure and sync protocol.

The ECMH for a permissioned repo is authenticated using a randomly generated and transient HMAC key, which is in turn signed by the user’s atproto signing key. 

The commit is composed of the ECMH hash, the computed HMAC, the HMAC key, and the signature.

Each commit is authenticated for only one party and is not intended to be rebroadcast. HMACs are used to provide deniability in the event a signature is exposed. Every reader who reads a permissioned repo from a PDS will receive a different HMAC key.

## Sync log
Sync operates via a log of recent write operations. Services query with a since parameter to retrieve operations for a given permissioned repo since their last known position. The oplog is a transport optimization, not a committed data structure. The repo host may compact or flush it at any time, though it's expected to keep it available for a backfill window.

If a consumer falls behind, the oplog is unavailable, or the commitment doesn't match after replaying operations, the consumer can always fall back to syncing the full repo state. Given expected repo sizes, a full resync is not prohibitively expensive.

## Write notifications
Real-time sync is achieved by sending write notifications to syncing services. Member PDSes don't necessarily know the full list of sync services, so notifications are routed through the space owner. Each service then initiates a pull from the user's PDS. Write notifications are best-effort. If a notification is dropped, sync is ultimately self-healing through the permissioned repo commit mechanism.

# App coordination
Spaces are most often hosted on PDSes, but the logic for governing a space typically lives in an application. Therefore space hosts expose a set of APIs that applications call, using the space owner's OAuth credential, to manage members, transfer ownership, and update configuration.

In some cases, ACLs may be governed by some application-level concept that isn’t expressible in the protocol: join requests, approval flows, invite links, etc. A user on another application may not know which application it needs to talk to in order to initiate one of these flows. The only service they know of is the host of the space itself.

To address this, each space can be configured with a managing app that it will generically route application-level requests to. This is purely internal config and is not visible to members.
