
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
build: codegen ## Compile all modules
	pnpm build

.PHONY: test
test: ## Run all tests
	pnpm test

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
clean: clean-deps clean-build clean-prebuild

.PHONY: clean-gen
clean-gen: clean-build clean-prebuild

.PHONY: clean-deps
clean-deps: ## Deletes all installed dependencies (node_modules) in all packages
	find . -type d -name "node_modules" -prune -exec rm -rf {} +;

.PHONY: clean-build
clean-build: ## Deletes all build artifacts (dist, tsbuildinfo) in all packages
	find . -type d -name "dist" -not -path "*/node_modules/*" -prune -exec rm -rf {} +;
	find . -type f -name "*.tsbuildinfo" -not -path "*/node_modules/*" -exec rm {} +;

.PHONY: clean-prebuild
clean-prebuild: ## Deletes all prebuild artifacts (codegen, lingui, etc.) in all packages
	for f in packages/*/src/proto packages/*/src/lexicons packages/lex/*/src/lexicons packages/lex/*/tests/lexicons packages/oauth/*/src/lexicons packages/oauth/*/src/locales/*/messages.ts packages/api/src/client packages/api/src/moderation/const/labels.ts packages/ozone/src/lexicon; do rm -r "$$f"; done || true;

.PHONY: nvm-setup
nvm-setup: ## Use NVM to install and activate node+pnpm
	nvm install
	nvm use
	corepack enable
	corepack install
