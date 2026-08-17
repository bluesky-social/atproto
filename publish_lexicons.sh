#!/usr/bin/env bash

set -e -u -o pipefail

echo "### tools.ozone.*"
GOAT_PASSWORD=`pass bsky/bsky.social/ozone-lexicons | head -n1` GOAT_USERNAME=ozone-lexicons.bsky.social goat lex publish --update lexicons/tools/ozone/

echo "### chat.bsky.*"
GOAT_PASSWORD=`pass bsky/bsky.social/bsky-lexicons | head -n1` GOAT_USERNAME=bsky-lexicons.bsky.social goat lex publish --update lexicons/chat/bsky

echo "### app.bsky.*"
GOAT_PASSWORD=`pass bsky/bsky.social/bsky-lexicons | head -n1` GOAT_USERNAME=bsky-lexicons.bsky.social goat lex publish --update lexicons/app/bsky

echo "### com.atproto.*"
GOAT_PASSWORD=`pass bsky/bsky.social/atproto-lexicons | head -n1` GOAT_USERNAME=atproto-lexicons.bsky.social goat lex publish --update lexicons/com/atproto
