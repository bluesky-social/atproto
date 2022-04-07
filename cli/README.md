# CLI

## Quick use guide
Run `yarn` from the project root to install all dependencies
Run `yarn build` within the `common/` folder to build the core bsky package
Run `yarn build` within this `cli/` folder to build the cli
Use it with `yarn cli {cmd}` from inside the `cli/` folder

To get this working, you'll need a server running. Pop over to `server/` and run `yarn dev`

We're running this demo with two users on our system.

Therefore, open two terminals:
in the first terminal, run `export SKY_REPO_PATH="~/.sky-alice"`
in the second terminal, run `export SKY_REPO_PATH="~/.sky-bob"`

In each terminal run
`yarn cli init` & prompt them with different usernames, for instance 'alice' & 'bob'
when prompted for a server, use the address of your dev server (`http://localhost:2583` by default)
when prompted if you want to register, use the default of `true`

- make a post as alice with `yarn cli post "hello world"`
- follow alice as bob with `yarn cli follow alice`
- like alice's post with `yarn cli like alice {post_id from alice's post}`
- view your timeline with `yarn cli timeline`
- unlike alice's post with `yarn cli unlike alice {post_id from alice's post}`
- list your follows with `yarn cli list follows`
- list your followers with `yarn cli list followers`
- view your feed with `yarn cli feed`
- view someone else's feed with `yarn cli feed alice`



