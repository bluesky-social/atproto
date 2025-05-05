# PDS Scripts

This directory includes some low-level administrative scripts primarily meant to help recover from situations of data loss or repository corruption.

These scripts are included in the Docker image. The recommended way to run them is to shell into the PDS container (`docker exec -it pds /bin/sh`) and run the relevant script using `node run-script.js SCRIPT_NAME`.

### rebuild-repo

Rebuild a repo's MST and sign a new commit based on data stored in the actor's record table. Intended to be used if a repository is corrupted and there are missing MST blocks.

`node run-script.js rebuild-repo DID`

### publish-identity

Publishes an identity event on the PDS's outgoing firehose for the relevant DID. Intended to be used if a user's identity is out of date and a refresh of their identity needs to be pushed through the system.

`node run-script.js publish-identity DID`
`node run-script.js publish-identity DID1 DID2 DID3 ...`
`node run-script.js publish-identity-file dids.txt` (where `dids.txt` is a `\n` delimited text file of dids)

### rotate-keys

Ensures that an account's signing key in their PLC DID document matches the signing key that the PDS is holidng for them locally. If not, then update their PLC document. Does not work for `did:web`s. Intended to be used in recovery situations where an accounts' signing key is lost and it needs to be re-generated. This script _does not_ regenerate the key.

`node run-script.js rotate-keys DID`
`node run-script.js rotate-keys DID1 DID2 DID3 ...`
`node run-script.js rotate-keys-file dids.txt` (where `dids.txt` is a `\n` delimited text file of dids)
`node run-script.js rotate-keys-recovery` (to be used after `sequencer-recovery` script)

### sequencer-recovery

Replays the sequencer file on top of actor stores. Creates new actor stores & keys for actors that do not exist but are in the sequencer. Deletes actor stores & entries in the accounts DB when processing an account deletion on the stream. This script is meant to be re-runnable. Though because it processes events in parallel, it is important to be discerning about the cursor you pick up from if you stop & start the script.

Does _not_ rotate signing keys even if it generates them. Signing keys that need to be rotated are stored in a recovery DB and can be actually rotated with the `rotate-keys-recovery` script.

Intended to be used for recovery from data loss.

`node run-script.js sequencer-recovery START_CURSOR CONCURRENCY` (both params are optional & default to `0` and `10` respectively)

Failures are also tracked in the recovery DB and can be recovered from with `node run-script.js recovery-repair-repos`. Which will rebuild repos (a la `rebuild-repo`) and then play back the events from the sequencer only pertaining to the recovered DIDs.
