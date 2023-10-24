# Waverly specific documentation for Atproto

This version of atproto has been specialized for [Waverly](https://waverly.social). The changes have been kept to the minimum and isolated in outside files so as to make it easier to pull any change to atproto done by the bluesky team. *PLEASE KEEP IT LIKE THAT!*

## What is changed?

We added some types to the lexicon, including `social.waverly.miniblog`. These can be stored in our PDS. Our types are not indexed and we added some code to skip external indexing in `pds/src/services/record`.

In addition, we generate some Waverly specific data in `dev-env/src/mock`. This means the `dev-env` in this repo can be used as a backend for Waverly.

As the `atproto` ecosystem matures, our goal will be to move our change out of this fork and into our own repo and to ensure our types can be stored in any PDS.

## The Waverly architecture

Waverly posts are *miniblog* posts, and are meant to be longer than bluesky posts. We store these in the user's PDS in the `social.waverly.miniblog` collection. Each miniblog post is associated with a bluesky post which contains a truncated version of the miniblog post together with a link `https://waverly.social/profile/philbeaudoin.waverly.social/w/3jwdwj2ctlk26` that references the miniblog post.

This link corresponds to the following [AT URI](https://atproto.com/specs/at-uri-scheme): `at://philbeaudoin.waverly.social/social.waverly.miniblog/3jwdwj2ctlk26`. Following the https URL brings the user to the Waverly client which renders the full miniblog post.

All the social interactions (likes, comments, etc.) happen directly on a bluesky post.

In addition to that, Waverly supports groups. The way this works is that we have users that have a special handle which is known by Waverly to represent a group. For now we're using group names like `betterweb.group` in the `dev-env` environment, but we will likely evolve to `betterweb.group.social` eventually.

## Our GitHub structure

Our `main` branch is meant to be kept in sync with the `main` of the bluesky team. Whenever there are new changes at bluesky that we want to pull we go to [the main branch](https://github.com/waverlyai/atproto/tree/main) in our GitHub repo and click the *Sync fork* button to bring the latest changes.

Our default branch, which contains all our changes is [waverly](https://github.com/waverlyai/atproto/tree/waverly). This is the one we target for all our pull requests (see below). When the `main` branch contains changes from the bluesky team, we want to merge these into our `waverly` branch:

```sh
git checkout main
git remote add upstream https://github.com/bluesky-social/atproto.git
git fetch upstream
git pull upstream main
git checkout waverly
git pull
git merge main
# Fix merge conflicts and `git add` the fixed files
# git merge --continue
git push
```

## Creating a PR

Always make sure you `git checkout waverly` before doing `git checkout -b my-feature`. We only want to be operating on top of the waverly branch.

Once you've written, committed and pushed your code, go to the GitHub repo and select the button to `Compare & pull request`. *Now be careful!* By default, the pull request will target the bluesky repository (`bluesky-social/atproto`). You'll want to change the target to be `waverlyai/atproto`. *Important!* You will also need to change the branch. GitHub defaults to `base:main`, you'll need to pick the `waverly` branch.

## Running the dev environment

To run our dev environment, from the main directory:

```sh
# One time setup
brew install nvm
nvm install 18
nvm use 18
npm install --global pnpm

# To build and run dev-env
# (Repeat the last two when you change code)
make deps
make build
make run-dev-env

# If you change the lexicon
make codegen

```

## Resetting all the node_modules and lock-file

Careful! This deletes a lot of stuff, commit or backup or stash before you proceed. From the main directory:

```sh
find . -name "node_modules" -type d -exec rm -rf {} +
rm -rf pnpm-lock.yaml
make deps
```

## Publishing as an npm package

For now we support three npm package, which are light deviation from their equivalent in the bluesky atproto repo. They are:

- [@waverlyai/atproto-api](https://www.npmjs.com/package/@waverlyai/atproto-api) ([@atproto/api](https://www.npmjs.com/package/@atproto/api))
- [@waverlyai/atproto-pds](https://www.npmjs.com/package/@waverlyai/atproto-pds) ([@atproto/pds](https://www.npmjs.com/package/@atproto/pds))
- [@waverlyai/atproto-dev-env](https://www.npmjs.com/package/@waverlyai/atproto-dev-env) ([@atproto/dev-env](https://www.npmjs.com/package/@atproto/dev-env))

To publish any of these:

```sh
# First time only: make sure you have jq.
brew install jq

# Start from a clean, up-to-date, and fully committed git repo on the `waverly` branch.
git checkout waverly
git pull

# Build everything
make deps
make build

# For each of the package you want to publish, run the corresponding line.
# You do not need to publish them all.
# Use `prerelease`, `patch`, `minor` or `major` to suit your needs 
# These three lines are valid as of October 2023
pnpm version patch -w @waverlyai/atproto-api --no-workspaces-update
pnpm version prerelease -w @waverlyai/atproto-pds --no-workspaces-update
pnpm version patch -w @waverlyai/atproto-dev-env --no-workspaces-update

# Do a quick sanity check, only the version numbers in the package.json
# of the three packages should have changed.
git diff

# Commit, tag, push and publish to npm.
waverly-scripts/push-and-publish.sh
```

If you see any error running this script then you may have an unclean git repo. Reverse the version change, commit, and proceed again. Once this is done, check the npm repos linked above to make sure it worked.

## Running our tests

From the main directory:

```sh
make build
pnpm -filter ./packages/pds test -- waverly.crud.test.ts
```
