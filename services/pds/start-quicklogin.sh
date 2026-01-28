#!/bin/bash
cd /Users/jarlix/git/atproto/services/pds
export $(grep -v '^#' .env | xargs)
node index.js
