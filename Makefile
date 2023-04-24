
SHELL = /bin/bash
.SHELLFLAGS = -o pipefail -c

.PHONY: help
help: ## Print info about all commands
	@echo "Helper Commands:"
	@echo
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[01;32m%-20s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "NOTE: dependencies between commands are not automatic. Eg, you must run 'deps' and 'build' first, and after any changes"

.PHONY: build
build: ## Compile all modules
	yarn build

.PHONY: test
test: ## Run all tests
	yarn test

.PHONY: run-dev-env
run-dev-env: ## Run a "development environment" shell
	cd packages/dev-env; yarn run start

.PHONY: run-dev-pds
run-dev-pds: ## Run PDS locally
	if [ ! -f "packages/pds/.dev.env" ]; then cp packages/pds/example.dev.env packages/pds/.dev.env; fi
	cd packages/pds; ENV=dev yarn run start | yarn exec pino-pretty

.PHONY: run-dev-bsky
run-dev-bsky: ## Run appview ('bsky') locally
	if [ ! -f "packages/bsky/.dev.env" ]; then cp packages/bsky/example.dev.env packages/bsky/.dev.env; fi
	cd packages/bsky; ENV=dev yarn run start | yarn exec pino-pretty

.PHONY: lint
lint: ## Run style checks and verify syntax
	yarn verify

.PHONY: fmt
fmt: ## Run syntax re-formatting
	yarn prettier

.PHONY: deps
deps: ## Installs dependent libs using 'yarn install'
	yarn install --frozen-lockfile

.PHONY: nvm-setup
nvm-setup: ## Use NVM to install and activate node+yarn
	nvm install 18
	nvm use 18
	npm install --global yarn
