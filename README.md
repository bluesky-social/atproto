# Bluesky

Welcome to the Bluesky network prototype 🌞

To learn more about the Bluesky network check out our docs on [Network architecture]() and the [Blogpost on self-authenticating data structures]().

We encourage you to play around with the tools here, but please do not use anything here in production. This is a _proof of concept_ meant to demonstrate the core functionality of the bluesky network.

## 🔍 What's here?

This is a monorepo containing three packages:

- `common`: This is the bluesky SDK that contains implementations of:
  - the repository data structure 
  - a sample network namespace (microblogging) with both a full client and delegator client implementation
  - an authorization library for working with bluesky-capable UCANs
  - some helpers for making calls to a bluesky data server

  This package is published on npm as [bsky](https://www.npmjs.com/package/bsky)

- `server`: This is an implementation of a bluesky server. For simplicity's sake, it actually combines the function of three "roles" in the network:
  - **Identity:** 
    - maintains a mapping of username -> DID
  - **Data:** 
    - maintains a pointer to the latest root CID of a data repository. 
    - verifies the authority of pushes to your repo and updates the root.
    - serves the repository for pulls.
    - acts as a delgatee and makes updates to your repository for properly authorized requests
    - sends updates to other data/indexing servers that have subscribed to a particular DID that it is hosting
  - **Indexing:**
    - stores an indexed version of repositories that it is hosting or that its user's are following
    - returned global view of data including follower lists, aggregated like counts, and user timelines.

- `cli`: This is a basic command line interface for interactions with the bluesky network :
  - creating a local repository
  - registering a user
  - creating/editing/deleting posts
  - creating/deleting likes
  - viewing a user's timeline
  - viewing a user's feed

  _Note: the cli uses a delegator client at the moment. We are adding the option to use a full client soon._

---

## 🏎️ Quick use
_Requires Node>=15, and yarn_

Want to jump right in? Follow these steps to get a sample two server network up and running.

This demo takes four terminal windows: 
- two servers to show off data federation (you can use just one here if you like)
- two cli clients representing two users on separate servers interaction

The number in parantheses tells you which terminal to run each command in

From project root:
```bash
# install dependencies
(1) yarn

# build projects
(1) yarn build

# run server
(1) yarn server # runs on localhost:2583

# in a separate terminal, run a second server
(2) yarn server:alt # runs on localhost:2584

# set an env var to store alice's repo in a scoped dir
(3) export SKY_REPO_PATH="~/.sky-alice"

# set an env var to store bob's repo in a scoped dir
(4) export SKY_REPO_PATH="~/.sky-bob"

# register alice
(3) yarn cli init
# prompt with 'alice' for username, 'localhost:2583' for host & true for registration

# register bob
(4) yarn cli init
# prompt with 'bob' for username, 'localhost:2584' for host & true for registration

# make a couple posts as alice
(3) yarn cli post "hello world"
(3) yarn cli post "howdy"

# follow alice as bob
(4) yarn cli follow alice@localhost:2583

# like alice's post
(4) yarn cli like alice@localhost:2583 {post_id from alice post} # the post id has the format `3iwc-gvs-ehpk-2s`

# view your timeline
(4) yarn cli timeline

# list your follows
(3/4) yarn cli list follows

# list your followers
(3/4) yarn cli list followers

# list your feed
(3/4) yarn cli feed

# list your followers
(3/4) yarn cli list followers

# list your feed
(3/4) yarn cli feed

# view alice's feed as bob
(4) yarn cli feed alice@localhost:2583

# Keep playing around. Try unliking, deleting or editing posts, or add a third user into the mix! They can be registered to one of the existing servers
```

---

## 🗒️ Documentation
We are putting together more detailed documentation for the server API as well as the SDK.

If you are inclined to play with either, your best bet is to check the tests to see how to use each part of the library.

Specifically:

`server/test/delegator.ts` contains an example of a delegator client (the simplest client to work with)

`server/test/indexer.ts` contains an example of multiple users interaction on a 2 server network

`common/test/repo.ts` contains an examples of directly performing updates to a user repo

`common/test/microblog.ts` contains an examples of using the microblog library to create/update microblog namespace objects in the repository

For communicating directly with the server api, there is a schema above each route that details the exact parameters it expects to receive. Any post route will require a valid UCAN as a Bearer token. We recommend using the SDK to make these requests as these tokens can be difficult to roll by hand.

---

## 🔦 Notes for code spelunkers
We hope you jump into the code to explore these concepts alongside us! Feel free to create issues/discussion with problems that you come across or questions that you have.

A few notes for the curious ones that find themselves trawling the depths of the code:

### Namespaces

Data is separated in the user repository by namespace.

A user's microblogging data lives separately from their community forum data which lives separate from their long form writing data and so on. Each namespace following its respective data spec.

We've implemented only one sample namespace here: microblogging.

You'll notice that we sometimes switch between using the words "interactions" and "likes". The reason for this is that the user repository speaks in terms of "interactions", which is any sort of interaction generated by an application. These may be likes, retweets, upvotes, shares, rsvps, etc. Our current (simplified) microblogging spec only allows for "likes" as interactions.

Therefore we try to talk about the general concept as "interactions" and the particular as "likes". There is some gray area here where those two concepts blur together and will be better demarcated as we develop our schema system.

### DIDs and UCANs

In this prototype a user's root DID is a simple `did:key`. In the future, these will be more permanent identifiers such as `did:bsky` (read our proposal in the architecture docs) or `did:ion`. 

You'll notice that we delegate a UCAN from the root key to the root key (which is a no-op), this is to mirror the process of receiving a fully delegated UCAN _from your actual root key_ to a _fully permissioned device key_.

You'll also notice that the DID for the microblogging namespace is just `did:bsky:microblog` (which is not an actual valid DID). This is a stand in until we have an addressed network for schemas.

UCAN permissions are also simplified at the current moment, allowing for scoped `WRITE` permission or full-repo `MAINTENANCE` permission. These permissions will be expanding in the future to allow presenting CRUD operations, and more detailed maintenance (ie creation vs merging vs cleanup, etc)

### Client types

In the architecture overview, we specify three client types: full, light, and delegator. This library only contains implementaions of full and delegator. Thus we use delegator for light weight operations and a full client when we want the entire repository. 

The main ramification of this is that data server subscribers must receive the _full repo_ of the users that they subscribe to. Once we add in light clients, they can receive only the _sections_ the repo that they are interested in (for instance a single post or a like) while having the same trust model as a full repo.

