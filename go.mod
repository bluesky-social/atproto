module github.com/whyrusleeping/bluesky

go 1.16

require (
	github.com/filecoin-project/go-hamt-ipld v0.1.5
	github.com/ipfs/go-block-format v0.0.3
	github.com/ipfs/go-blockservice v0.2.1
	github.com/ipfs/go-cid v0.0.7
	github.com/ipfs/go-datastore v0.5.0
	github.com/ipfs/go-ds-flatfs v0.5.1
	github.com/ipfs/go-hamt-ipld v0.1.1
	github.com/ipfs/go-ipfs-blockstore v1.1.2
	github.com/ipfs/go-ipld-cbor v0.0.6
	github.com/ipfs/go-ipld-legacy v0.1.1 // indirect
	github.com/ipfs/go-merkledag v0.5.1
	github.com/ipld/go-car v0.3.2
	github.com/ipld/go-ipld-prime v0.12.3
	github.com/labstack/echo/v4 v4.6.1
	github.com/libp2p/go-libp2p-core v0.8.5
	github.com/mitchellh/go-homedir v1.1.0
	github.com/qri-io/ucan v0.0.0-20210908004355-a725af2c2ab3
	github.com/urfave/cli/v2 v2.3.0
	github.com/whyrusleeping/cbor-gen v0.0.0-20211110122933-f57984553008
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	gorm.io/driver/sqlite v1.2.6
	gorm.io/gorm v1.22.4
)

replace github.com/qri-io/ucan => github.com/dholms/ucan v0.0.0-20211215024958-695903849632
