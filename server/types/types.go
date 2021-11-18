package types

import "github.com/ipfs/go-cid"

type SignedRoot struct {
	User      cid.Cid `cborgen:"user"`
	Signature []byte  `cborgen:"sig"`
}

type User struct {
	Name      string  `cborgen:"name"`
	PostsRoot cid.Cid `cborgen:"postsRoot"`
	NextPost  int64   `cborgen:"nextPost"`
}
