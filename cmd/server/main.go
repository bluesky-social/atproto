package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"sync"

	"github.com/filecoin-project/go-hamt-ipld"
	blocks "github.com/ipfs/go-block-format"
	bserv "github.com/ipfs/go-blockservice"
	"github.com/ipfs/go-cid"
	"github.com/ipfs/go-datastore"
	syncds "github.com/ipfs/go-datastore/sync"
	blockstore "github.com/ipfs/go-ipfs-blockstore"
	cbor "github.com/ipfs/go-ipld-cbor"
	"github.com/ipfs/go-merkledag"
	car "github.com/ipld/go-car"
	_ "github.com/ipld/go-ipld-prime/codec/dagcbor"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/whyrusleeping/bluesky/types"
	cbg "github.com/whyrusleeping/cbor-gen"
	"golang.org/x/xerrors"
)

type Server struct {
	Blockstore blockstore.Blockstore

	ulk   sync.Mutex
	Users map[string]cid.Cid
}

func main() {

	ds := syncds.MutexWrap(datastore.NewMapDatastore())
	bs := blockstore.NewBlockstore(ds)
	s := &Server{
		Users:      make(map[string]cid.Cid),
		Blockstore: bs,
	}

	e := echo.New()
	e.Use(middleware.Logger())
	e.POST("/register", s.handleRegisterUser)
	e.POST("/update", s.handleUserUpdate)
	e.GET("/user/:id", s.handleGetUser)
	panic(e.Start(":2583"))
}

func (s *Server) ensureGraphWalkability(ctx context.Context, u *types.User, bs blockstore.Blockstore) error {
	if err := s.graphWalkRec(ctx, u.PostsRoot, bs); err != nil {
		return err
	}

	return nil
}

func (s *Server) graphWalkRec(ctx context.Context, c cid.Cid, bs blockstore.Blockstore) error {
	eitherGet := func(cc cid.Cid) (blocks.Block, error) {
		baseHas, err := s.Blockstore.Has(ctx, cc)
		if err != nil {
			return nil, err
		}

		if baseHas {
			// this graph is already in our blockstore
			return nil, nil
		}

		return bs.Get(ctx, cc)
	}

	b, err := eitherGet(c)
	if err != nil {
		return err
	}

	if b == nil {
		return nil
	}

	var links []cid.Cid
	if err := cbg.ScanForLinks(bytes.NewReader(b.RawData()), func(l cid.Cid) {
		links = append(links, l)
	}); err != nil {
		return err
	}

	for _, l := range links {
		if err := s.graphWalkRec(ctx, l, bs); err != nil {
			return err
		}
	}

	return nil
}

// TODO: we probably want this to be a compare-and-swap
func (s *Server) handleUserUpdate(e echo.Context) error {
	ctx := e.Request().Context()

	// The body of the request should be a car file containing any *changed* blocks

	cr, err := car.NewCarReader(e.Request().Body)
	if err != nil {
		return err
	}

	roots := cr.Header.Roots

	if len(roots) != 1 {
		// only allow a single dag to be sent for updates
		return fmt.Errorf("cannot have multiple dag roots")
	}

	ds := syncds.MutexWrap(datastore.NewMapDatastore())
	tmpbs := blockstore.NewBlockstore(ds)

	for {
		blk, err := cr.Next()
		if err != nil {
			if !xerrors.Is(err, io.EOF) {
				return err
			}
			break
		}

		if err := tmpbs.Put(ctx, blk); err != nil {
			return err
		}
	}

	rblk, err := tmpbs.Get(ctx, roots[0])
	if err != nil {
		return err
	}

	var sroot types.SignedRoot
	if err := sroot.UnmarshalCBOR(bytes.NewReader(rblk.RawData())); err != nil {
		return err
	}

	ublk, err := tmpbs.Get(ctx, sroot.User)
	if err != nil {
		return err
	}

	var user types.User
	if err := user.UnmarshalCBOR(bytes.NewReader(ublk.RawData())); err != nil {
		return err
	}

	fmt.Println("user update: ", user.Name, user.NextPost, user.PostsRoot)

	if err := s.ensureGraphWalkability(ctx, &user, tmpbs); err != nil {
		return err
	}

	// TODO: verify signature

	if err := Copy(ctx, tmpbs, s.Blockstore); err != nil {
		return err
	}

	if err := s.updateUser(user.DID, roots[0]); err != nil {
		return err
	}

	return nil
}

func (s *Server) updateUser(did string, rcid cid.Cid) error {
	s.ulk.Lock()
	defer s.ulk.Unlock()

	s.Users[did] = rcid
	return nil
}

func (s *Server) getUser(id string) (cid.Cid, error) {
	s.ulk.Lock()
	defer s.ulk.Unlock()

	c, ok := s.Users[id]
	if !ok {
		return cid.Undef, fmt.Errorf("no such user")
	}

	return c, nil
}

func (s *Server) handleGetUser(c echo.Context) error {
	ctx := c.Request().Context()

	ucid, err := s.getUser(c.Param(":id"))
	if err != nil {
		return err
	}

	ds := merkledag.NewDAGService(bserv.New(s.Blockstore, nil))
	return car.WriteCar(ctx, ds, []cid.Cid{ucid}, c.Response().Writer)
}

type userRegisterBody struct {
	DID  string
	Name string
}

func (s *Server) handleRegisterUser(c echo.Context) error {
	ctx := c.Request().Context()
	var body userRegisterBody
	if err := c.Bind(&body); err != nil {
		return err
	}

	cst := cbor.NewCborStore(s.Blockstore)

	u := new(types.User)
	u.DID = body.DID
	u.Name = body.Name

	rcid, err := s.getEmptyPostsRoot(ctx, cst)
	if err != nil {
		return fmt.Errorf("failed to get empty posts root: %w", err)
	}
	u.PostsRoot = rcid

	cc, err := cst.Put(ctx, u)
	if err != nil {
		return fmt.Errorf("failed to write user to blockstore: %w", err)
	}

	s.updateUser(u.DID, cc)

	ds := merkledag.NewDAGService(bserv.New(s.Blockstore, nil))
	if err := car.WriteCar(ctx, ds, []cid.Cid{cc}, c.Response().Writer); err != nil {
		return fmt.Errorf("failed to write car: %w", err)
	}
	return nil
}

func Copy(ctx context.Context, from, to blockstore.Blockstore) error {
	ch, err := from.AllKeysChan(ctx)
	if err != nil {
		return err
	}

	for k := range ch {
		blk, err := from.Get(ctx, k)
		if err != nil {
			return err
		}

		if err := to.Put(ctx, blk); err != nil {
			return err
		}
	}

	return nil

}

func (s *Server) getEmptyPostsRoot(ctx context.Context, cst cbor.IpldStore) (cid.Cid, error) {
	n := hamt.NewNode(cst)
	return cst.Put(ctx, n)
}
