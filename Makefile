
SHELL = /bin/bash
.SHELLFLAGS = -o pipefail -c
DOCKER_AVAIL := $(shell docker ps >/dev/null 2>&1 && echo true)

.PHONY: help
help: ## Print info about all commands
	node packages/dev-infra/src/make

.PHONY: build
build: ## Compile all modules
	pnpm build

.PHONY: test
test: ## Run all tests
ifeq ($(DOCKER_AVAIL),true)
	pnpm clean-docker
endif
ifeq ($(OS),Windows_NT)
ifeq ($(DOCKER_AVAIL),true)
	pnpm test:docker
else
	@echo This requires docker to be installed and running
endif
else
	pnpm test:shards
endif

.PHONY: test-docker
test-docker: ## Run all tests on a docker
ifeq ($(DOCKER_AVAIL),true)
	pnpm test:docker
else
	@echo This requires docker to be installed and running
endif

.PHONY: run-dev-env
run-dev-env: ## Run a "development environment" shell
	cd packages/dev-env; NODE_ENV=development pnpm run start

.PHONY: run-dev-env-logged
run-dev-env-logged: ## Run a "development environment" shell (with logging)
	cd packages/dev-env; LOG_ENABLED=true NODE_ENV=development pnpm run start | pnpm exec pino-pretty

.PHONY: codegen
codegen: ## Re-generate packages from lexicon/ files
	pnpm codegen

.PHONY: lint
lint: ## Run style checks and verify syntax
	pnpm verify

.PHONY: fmt
fmt: ## Run syntax re-formatting
	pnpm format

.PHONY: fmt-lexicons
fmt-lexicons: ## Run syntax re-formatting, just on .json files
	pnpm exec eslint ./lexicons/ --ext .json --fix

.PHONY: deps
deps: ## Installs dependent libs using 'pnpm install'
	pnpm install --frozen-lockfile

.PHONY: clean
clean: ## Clean node_modules
	@echo Cleaning node_modules
	node packages/dev-infra/src/make --clean

.PHONY: all
all: ## Clean node_modules, build, and test
	@echo Clean node_modules, build, and test
	node packages/dev-infra/src/make --clean
	pnpm install --frozen-lockfile
	pnpm build
ifeq ($(DOCKER_AVAIL),true)
	pnpm clean-docker
endif
	pnpm test:shards
