package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"sync"

	blocks "github.com/ipfs/go-block-format"
	bserv "github.com/ipfs/go-blockservice"
	"github.com/ipfs/go-cid"
	"github.com/ipfs/go-datastore"
	syncds "github.com/ipfs/go-datastore/sync"
	blockstore "github.com/ipfs/go-ipfs-blockstore"
	"github.com/ipfs/go-merkledag"
	car "github.com/ipld/go-car"
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
	e.Use(middleware.CORS())
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
		baseHas, err := s.Blockstore.Has(cc)
		if err != nil {
			return nil, err
		}

		if baseHas {
			// this graph is already in our blockstore
			return nil, nil
		}

		return bs.Get(cc)
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
		}

		if blk == nil {
			break
		}

		if err := tmpbs.Put(blk); err != nil {
			return err
		}
	}

	rblk, err := tmpbs.Get(roots[0])
	if err != nil {
		return err
	}

	// TODO: accept signed root & Verify signature
	// var sroot types.SignedRoot
	// if err := sroot.UnmarshalCBOR(bytes.NewReader(rblk.RawData())); err != nil {
	// 	return err
	// }

	// ublk, err := tmpbs.Get(sroot.User)
	// if err != nil {
	// 	return err
	// }

	var user types.User
	if err := user.UnmarshalCBOR(bytes.NewReader(rblk.RawData())); err != nil {
		return err
	}

	fmt.Println("user update: ", user.Name, user.NextPost, user.PostsRoot)

	if err := s.ensureGraphWalkability(ctx, &user, tmpbs); err != nil {
		return err
	}

	if err := Copy(ctx, tmpbs, s.Blockstore); err != nil {
		return err
	}

	if err := s.updateUser(&user, roots[0]); err != nil {
		return err
	}

	return nil
}

func (s *Server) updateUser(u *types.User, rcid cid.Cid) error {
	s.ulk.Lock()
	defer s.ulk.Unlock()

	// TODO: do something better okay
	s.Users[u.Name] = rcid
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

func Copy(ctx context.Context, from, to blockstore.Blockstore) error {
	ch, err := from.AllKeysChan(ctx)
	if err != nil {
		return err
	}

	for k := range ch {
		blk, err := from.Get(k)
		if err != nil {
			return err
		}

		if err := to.Put(blk); err != nil {
			return err
		}
	}

	return nil

}
