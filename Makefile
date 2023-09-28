
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
	pnpm build

.PHONY: test
test: ## Run all tests
	pnpm test

.PHONY: run-dev-env
run-dev-env: ## Run a "development environment" shell
	cd packages/dev-env; pnpm run start

.PHONY: run-dev-pds
run-dev-pds: ## Run PDS locally
	if [ ! -f "packages/pds/.dev.env" ]; then cp packages/pds/example.dev.env packages/pds/.dev.env; fi
	cd packages/pds; ENV=dev pnpm run start | pnpm exec pino-pretty

.PHONY: run-dev-bsky
run-dev-bsky: ## Run appview ('bsky') locally
	if [ ! -f "packages/bsky/.dev.env" ]; then cp packages/bsky/example.dev.env packages/bsky/.dev.env; fi
	cd packages/bsky; ENV=dev pnpm run start | pnpm exec pino-pretty

.PHONY: codegen
codegen: ## Re-generate packages from lexicon/ files
	cd packages/api; pnpm run codegen
	cd packages/pds; pnpm run codegen
	cd packages/bsky; pnpm run codegen
	# clean up codegen output
	pnpm format

.PHONY: lint
lint: ## Run style checks and verify syntax
	pnpm verify

.PHONY: fmt
fmt: ## Run syntax re-formatting
	pnpm format

.PHONY: deps
deps: ## Installs dependent libs using 'pnpm install'
	pnpm install --frozen-lockfile

.PHONY: nvm-setup
nvm-setup: ## Use NVM to install and activate node+pnpm
	nvm install 18
	nvm use 18
	npm install --global pnpm
