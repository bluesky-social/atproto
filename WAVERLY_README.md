# Waverly specific documentation for Atproto

This version of atproto has been specialized for [Waverly](https://waverly.social). The changes have been kept to the minimum and isolated in outside files so as to make it easier to pull any change to atproto done by the bluesky team. *PLEASE KEEP IT LIKE THAT!*

## What is changed?

We added the type `social.waverly.miniblog` to the lexicon so that it can be stored in our PDS. This type is not indexed and we added some code to skip external indexing in `pds/src/services/record`.

In addition, we generate some Waverly specific data in `dev-env/src/mock` so 

## The Waverly architecture

Waverly posts are _miniblog_ posts, and are meant to be longer than bluesky posts. We store these in the user's PDS in the `social.waverly.miniblog` collection. Each miniblog post is associated with a bluesky post which contains a truncated version of the miniblog post together with a link `https://waverly.social/mb/philbeaudoin.waverly.social/3jwdwj2ctlk26` that references the miniblog post.

This link corresponds to the following [AT URI](https://atproto.com/specs/at-uri-scheme): `at://philbeaudoin.waverly.social/social.waverly.miniblog/3jwdwj2ctlk26`. Following the https URL brings the user to the Waverly client which renders the full miniblog post.

All the social interactions (likes, comments, etc.) happen directly on a bluesky post.

In addition to that, Waverly supports groups. The way this works is that we have users that have a special handle which is known by Waverly to represent a group. For now we're using group names like `betterweb.group` in the `dev-env` environment, but we will likely evolve to `betterweb.group.social` eventually.

## Our GitHub structure

Our `main` branch is meant to be kept in sync with the `main` of the bluesky team. Whenever there are new changes at bluesky that we want to pull we go to [the main branch](https://github.com/waverlyai/atproto/tree/main) in our GitHub repo and click the _Sync fork_ button to bring the latest changes.

Our default branch, which contains all our changes is [waverly](https://github.com/waverlyai/atproto/tree/waverly). This is the one we target for all our pull requests (see below). When the `main` branch contains changes from the bluesky team, we want to merge these into our `waverly` branch:

```sh
git checkout main
git pull origin main
git checkout waverly
git checkout -b waverly-update
git merge main
git commit -m "Merge changes from main into waverly"
git push origin waverly-update
```

Then see below to see how to create a PR with this `waverly-update` branch.

## Creating a PR

Always make sure you `git checkout waverly` before doing `git checkout -b my-feature`. We only want to be operating on top of the waverly branch.

Once you've written, committed and pushed your code, go to the GitHub repo and select the button to `Compare & pull request`. *Now be careful!* By default, the pull request will target the bluesky repository (`bluesky-social/atproto`). You'll want to change the target to be `waverlyai/atproto`. *Important!* You will also need to change the branch. GitHub defaults to `base:main`, you'll need to pick the `waverly` branch. 

## Running the dev environment

To run our dev environment, from the main directory:

```sh
yarn
cd packages/dev-env
yarn build && yarn start
```

## Resetting all the node_modules

Careful! This deletes a lot of stuff, commit or backup or stash before you proceed. From the main directory:

```sh
find . -name "node_modules" -type d -exec rm -rf {} +
find . -name "yarn.lock" -exec rm -f {} +
yarn
```

## Running our tests

For now, the only waverly-specific tests are in pds. From the main directory:

```sh
yarn
cd packages/pds
yarn test --testPathPattern=waverly.crud.test.ts
```
