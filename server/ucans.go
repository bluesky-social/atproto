package main

import (
	"fmt"
	"net/http"
	"strings"

	ucan "github.com/dholms/ucan"
)

func GetBearer(req *http.Request) string {
	reqToken := req.Header.Get("Authorization")
	splitToken := strings.Split(reqToken, "Bearer ")
	return splitToken[1]
}

func TwitterAC(m map[string]interface{}) (ucan.Attenuation, error) {

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

func EmptyAC(m map[string]interface{}) (ucan.Attenuation, error) {
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
