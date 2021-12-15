package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strings"
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

	ucan "github.com/dholms/ucan"
	didkey "github.com/qri-io/ucan/didkey"
	"github.com/whyrusleeping/bluesky/types"
	cbg "github.com/whyrusleeping/cbor-gen"
	"golang.org/x/xerrors"
)

type Server struct {
	Blockstore blockstore.Blockstore
	UcanStore  ucan.TokenStore

	ulk       sync.Mutex
	UserRoots map[string]cid.Cid
	UserDids  map[string]*didkey.ID
}

var twitterCaps = ucan.NewNestedCapabilities("POST")

func main() {
	ds := syncds.MutexWrap(datastore.NewMapDatastore())
	bs := blockstore.NewBlockstore(ds)
	s := &Server{
		UserRoots:  make(map[string]cid.Cid),
		UserDids:   make(map[string]*didkey.ID),
		Blockstore: bs,
		UcanStore:  ucan.NewMemTokenStore(),
	}

	e := echo.New()
	e.Use(middleware.CORS())
	e.POST("/update", s.handleUserUpdate)
	e.POST("/register", s.handleRegister)
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

	// check ucan permission
	encoded := getBearer(e.Request())
	p := ucan.NewTokenParser(twitterAC, ucan.StringDIDPubKeyResolver{}, s.UcanStore.(ucan.CIDBytesResolver))
	token, err := p.ParseAndVerify(ctx, encoded)
	if err != nil {
		return err
	}

	checkUser := func(user string) bool {
		att := ucan.Attenuation{
			Rsc: NewAccountResource("twitter", "dholms"),
			Cap: twitterCaps.Cap("POST"),
		}

		isGood := token.Attenuations.Contains(ucan.Attenuations{att})

		if !isGood {
			return false
		}

		if token.Issuer.String() != s.UserDids[user].String() {
			return false
		}

		return true
	}

	return s.updateUser(ctx, e.Request(), checkUser)
}

func (s *Server) updateUser(ctx context.Context, req *http.Request, checkUser func(user string) bool) error {
	// The body of the request should be a car file containing any *changed* blocks
	cr, err := car.NewCarReader(req.Body)
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

	if !checkUser(user.Name) {
		return fmt.Errorf("Ucan does not properly permission user")
	}

	fmt.Println("user update: ", user.Name, user.NextPost, user.PostsRoot)

	if err := s.ensureGraphWalkability(ctx, &user, tmpbs); err != nil {
		return err
	}

	if err := Copy(ctx, tmpbs, s.Blockstore); err != nil {
		return err
	}

	if err := s.updateUserRoot(&user, roots[0]); err != nil {
		return err
	}

	return nil
}

func (s *Server) updateUserRoot(u *types.User, rcid cid.Cid) error {
	s.ulk.Lock()
	defer s.ulk.Unlock()

	// TODO: do something better okay
	s.UserRoots[u.Name] = rcid
	return nil
}

func (s *Server) getUser(id string) (cid.Cid, error) {
	s.ulk.Lock()
	defer s.ulk.Unlock()

	c, ok := s.UserRoots[id]
	if !ok {
		return cid.Undef, fmt.Errorf("no such user")
	}

	return c, nil
}

func (s *Server) handleGetUser(c echo.Context) error {
	ctx := c.Request().Context()

	ucid, err := s.getUser(c.Param("id"))
	if err != nil {
		return err
	}

	ds := merkledag.NewDAGService(bserv.New(s.Blockstore, nil))
	c.Response().Header().Set(echo.HeaderContentType, echo.MIMEOctetStream)
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

func (s *Server) handleRegister(e echo.Context) error {
	ctx := e.Request().Context()
	encoded := getBearer(e.Request())

	// don't bother with attenuations
	// ac := func(m map[string]interface{}) (ucan.Attenuation, error) {
	// 	return ucan.Attenuation{}, nil
	// }

	p := ucan.NewTokenParser(emptyAC, ucan.StringDIDPubKeyResolver{}, s.UcanStore.(ucan.CIDBytesResolver))
	token, err := p.ParseAndVerify(ctx, encoded)
	if err != nil {
		return err
	}

	bytes, err := ioutil.ReadAll(e.Request().Body)
	if err != nil {
		return err
	}
	username := string(bytes)

	if s.UserDids[username] != nil {
		return fmt.Errorf("Username already taken")
	}

	s.UserDids[username] = &token.Issuer

	return nil
}

func getBearer(req *http.Request) string {
	reqToken := req.Header.Get("Authorization")
	splitToken := strings.Split(reqToken, "Bearer ")
	return splitToken[1]
}

func twitterAC(m map[string]interface{}) (ucan.Attenuation, error) {

	var (
		cap string
		rsc ucan.Resource
	)
	for key, vali := range m {
		val, ok := vali.(string)
		if !ok {
			return ucan.Attenuation{}, fmt.Errorf(`expected attenuation value to be a string`)
		}

		if key == ucan.CapKey {
			cap = val
		} else {
			rsc = NewAccountResource(key, val)
		}
	}

	return ucan.Attenuation{
		Rsc: rsc,
		Cap: twitterCaps.Cap(cap),
	}, nil
}

func emptyAC(m map[string]interface{}) (ucan.Attenuation, error) {
	return ucan.Attenuation{}, nil
}

type accountRsc struct {
	t string
	v string
}

// NewStringLengthResource is a silly implementation of resource to use while
// I figure out what an OR filter on strings is. Don't use this.
func NewAccountResource(typ, val string) ucan.Resource {
	return accountRsc{
		t: typ,
		v: val,
	}
}

func (r accountRsc) Type() string {
	return r.t
}

func (r accountRsc) Value() string {
	return r.v
}

func (r accountRsc) Contains(b ucan.Resource) bool {
	return r.Type() == b.Type() && r.Value() <= b.Value()
}
