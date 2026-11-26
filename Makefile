.PHONY: build-frontend-image build-backend-image pull-core-images smoke-test _start-frontend clean-smoke-test clean-integration-test test-module help dev-up dev-up-core dev-up-demo dev-down dev-logs dev-reset dev-enable-upstream dev-check-collectoss

FRONTEND_IMAGE ?= frontend-smoke-local
BACKEND_IMAGE ?= backend-smoke-local
CORE_TAG ?= v$(shell node -p "require('@org-pulse/core/package.json').version")
FRONTEND_CONTAINER := frontend-smoke-local
BACKEND_CONTAINER := backend-smoke-local
PLAYWRIGHT_IMAGE := quay.io/browser/playwright-chromium:playwright-1.60.0
BACKEND_PORT := 3001
FRONTEND_PORT := 8080
WORKSPACE := /workspace

# Used for configuring container-based commands
CONTAINER_RUNTIME ?= $(shell basename $$(command -v podman 2>/dev/null) || echo "docker")
COMPOSE ?= $(CONTAINER_RUNTIME) compose
OS := $(shell uname -s)

# Environment variables for Playwright container
# PLAYWRIGHT_BROWSERS_PATH: Use pre-installed browsers in the container
# instead of downloading them at runtime (saves time, ensures consistency)
COMMON_ENV := \
	-e HOME=/tmp \
	-e PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright \
	-e XDG_CACHE_HOME=/tmp/.cache \
	-e npm_config_cache=/tmp/.npm \
	-e BASE_URL=http://localhost:$(FRONTEND_PORT)

CONTAINER_FLAGS := --rm -t \
	--network host \
	--entrypoint "" \
	--user 0:0 \
	-v $(CURDIR):$(WORKSPACE):z \
	-w $(WORKSPACE)

# Smoke tests setup command: install dependencies in container
# Note: npm ci inherently replaces node_modules with Linux packages via bind mount
SETUP_CMD := mkdir -p /tmp/.cache /tmp/.npm && npm ci --silent --engine-strict=false

# Helper function to start a frontend or backend container for smoke testing,
# then wait for the health check to pass
define start-container
	@echo "Starting $(1) container..."
	@if [ "$(CONTAINER_RUNTIME)" = "podman" ] && [ "$(OS)" = "Darwin" ]; then \
		$(CONTAINER_RUNTIME) run -d \
			-p $(3):$(3) \
			$(5) \
			--name $(1) \
			$(2) > /dev/null; \
	else \
		$(CONTAINER_RUNTIME) run -d \
			--network host \
			$(5) \
			--name $(1) \
			$(2) > /dev/null; \
	fi
	@echo "Waiting for $(1) to be ready..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		if curl -sf http://localhost:$(3)$(4) > /dev/null 2>&1; then \
			echo "$(1) is ready (attempt $$i)"; \
			break; \
		fi; \
		if [ $$i -eq 10 ]; then \
			echo "$(1) failed to start after 10 attempts"; \
			$(MAKE) clean-smoke-test; \
			exit 1; \
		fi; \
		sleep 2; \
	done
endef

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-25s\033[0m %s\n", $$1, $$2}'

# ========================================
# Core Images — Pull from Quay
# ========================================
pull-core-images: ## Pull core images from Quay (version from @org-pulse/core)
	@echo "Pulling core images tagged $(CORE_TAG)..."
	$(CONTAINER_RUNTIME) pull quay.io/osaipo-data/org-pulse-core-backend:$(CORE_TAG)
	$(CONTAINER_RUNTIME) pull quay.io/osaipo-data/osaipo-pulse-frontend-builder:$(CORE_TAG)
	$(CONTAINER_RUNTIME) pull quay.io/osaipo-data/osaipo-pulse-frontend-runtime:$(CORE_TAG)

# ========================================
# Image Builds — AI Engineering (full)
# ========================================
build-frontend-image: ## Build AI Eng frontend image
	@echo "Building AI Eng frontend container image..."
	@$(CONTAINER_RUNTIME) build -f deploy/osaipo-eng.frontend.Dockerfile --build-arg CORE_TAG=$(CORE_TAG) -t $(FRONTEND_IMAGE) .

build-backend-image: ## Build AI Eng backend image
	@echo "Building AI Eng backend container image..."
	@$(CONTAINER_RUNTIME) build -f deploy/osaipo-eng.backend.Dockerfile --build-arg CORE_TAG=$(CORE_TAG) -t $(BACKEND_IMAGE) .

# ========================================
# Smoke Tests
# ========================================
smoke-test: ## Run smoke tests against AI Eng images
	# Start backend container in demo mode (uses fixture data, no credentials needed)
	$(call start-container,$(BACKEND_CONTAINER),$(BACKEND_IMAGE),$(BACKEND_PORT),/api/healthz,-e DEMO_MODE=true)
	# Start frontend (macOS/Podman uses gateway IP, others use localhost)
	@if [ "$(CONTAINER_RUNTIME)" = "podman" ] && [ "$(OS)" = "Darwin" ]; then \
		BACKEND_HOST=$$($(CONTAINER_RUNTIME) run --rm alpine ip route | awk '/default/ {print $$3}'); \
		$(MAKE) -s _start-frontend BACKEND_HOST=$$BACKEND_HOST; \
	else \
		$(MAKE) -s _start-frontend BACKEND_HOST=127.0.0.1; \
	fi
	# Run Playwright tests in container (no local browser installation needed)
	@echo "Running Playwright smoke tests in container..."
	$(CONTAINER_RUNTIME) run $(CONTAINER_FLAGS) $(COMMON_ENV) \
		$(PLAYWRIGHT_IMAGE) \
		bash -c "$(SETUP_CMD) && npm run test:smoke" || \
		(EXIT_CODE=$$?; $(MAKE) clean-smoke-test; exit $$EXIT_CODE)
	@echo "All smoke tests passed!"
	@$(MAKE) clean-smoke-test

# Helper target to start frontend with dynamic BACKEND_HOST
# Note: This is a target (not a function) because calling $(call start-container,...)
# on a backslash-continued line causes Makefile escaping issues with @ and $$ symbols
_start-frontend:
	$(call start-container,$(FRONTEND_CONTAINER),$(FRONTEND_IMAGE),$(FRONTEND_PORT),/healthz,--add-host=backend:$(BACKEND_HOST))

# ========================================
# Integration Tests
# ========================================
# Generic target for running module-specific integration tests
# Usage: make test-module MODULE=ai-impact
# This starts the app containers and runs Playwright tests tagged with @<MODULE>
test-module: ## Run integration tests for a module (MODULE=<name>)
	@if [ -z "$(MODULE)" ]; then \
		echo "ERROR: MODULE variable is required"; \
		echo "Usage: make test-module MODULE=ai-impact"; \
		exit 1; \
	fi
	@echo "Running integration tests for module: $(MODULE)"
	# Start backend container
	$(call start-container,$(BACKEND_CONTAINER),$(BACKEND_IMAGE),$(BACKEND_PORT),/api/healthz,-e DEMO_MODE=true)
	# Start frontend container
	@if [ "$(CONTAINER_RUNTIME)" = "podman" ] && [ "$(OS)" = "Darwin" ]; then \
		BACKEND_HOST=$$($(CONTAINER_RUNTIME) run --rm alpine ip route | awk '/default/ {print $$3}'); \
		$(MAKE) -s _start-frontend BACKEND_HOST=$$BACKEND_HOST; \
	else \
		$(MAKE) -s _start-frontend BACKEND_HOST=127.0.0.1; \
	fi
	# Run integration tests filtered by module tag
	@echo "Running Playwright tests tagged with @$(MODULE)..."
	$(CONTAINER_RUNTIME) run $(CONTAINER_FLAGS) $(COMMON_ENV) \
		$(PLAYWRIGHT_IMAGE) \
		bash -c "$(SETUP_CMD) && npx playwright test --grep @$(MODULE)" || \
		(EXIT_CODE=$$?; $(MAKE) clean-integration-test; exit $$EXIT_CODE)
	@echo "Integration tests for $(MODULE) passed!"
	@$(MAKE) clean-integration-test

# ========================================
# Docker Local Development
# ========================================
dev-up: ## Start the full live-data development stack
	@mkdir -p data secrets
	@sh scripts/dev-bootstrap.sh preflight
	$(COMPOSE) up --build -d
	@COMPOSE="$(COMPOSE)" sh scripts/dev-bootstrap.sh || echo "WARNING: first-run bootstrap did not complete; continuing."

dev-up-core: ## Start only the Pulse frontend and backend
	mkdir -p data secrets
	COMPOSE_PROFILES= $(COMPOSE) up --build -d

dev-up-demo: ## Start Pulse with fixture data and no upstream services
	mkdir -p data secrets
	COMPOSE_PROFILES= $(COMPOSE) -f docker-compose.yml -f docker-compose.demo.yml up --build -d

dev-down: ## Stop all development containers, preserving data and volumes
	$(COMPOSE) --profile upstream down

dev-logs: ## Follow logs from all development services
	$(COMPOSE) --profile upstream logs -f

dev-reset: ## Remove development containers and named volumes, preserving ./data
	$(COMPOSE) --profile upstream down -v
	@echo "Named volumes removed; ./data was preserved (run rm -rf data separately for a full Pulse reset)."

dev-enable-upstream: ## Run the idempotent Upstream Pulse first-run bootstrap
	@COMPOSE="$(COMPOSE)" sh scripts/dev-bootstrap.sh

dev-check-collectoss: ## Check CollectOSS reachability and read-only schema access
	@test -f .env || { echo "ERROR: copy .env.docker.example to .env and configure COLLECTOSS_* first"; exit 1; }
	@. scripts/dev-env.sh; \
		URL="$$(envval COLLECTOSS_DATABASE_URL)"; \
		SCHEMA="$$(envval COLLECTOSS_SCHEMA)"; \
		SCHEMA="$${SCHEMA:-data}"; \
		if [ -z "$$URL" ]; then echo "ERROR: set COLLECTOSS_DATABASE_URL in .env"; exit 1; fi; \
		if ! printf '%s' "$$SCHEMA" | grep -Eq '^[a-z_][a-z0-9_]*$$'; then \
			echo "ERROR: COLLECTOSS_SCHEMA must match ^[a-z_][a-z0-9_]*$$"; exit 1; \
		fi; \
		COLLECTOSS_DATABASE_URL="$$URL" COLLECTOSS_SCHEMA="$$SCHEMA" \
		$(CONTAINER_RUNTIME) run --rm \
			--add-host=host.docker.internal:host-gateway \
			-e COLLECTOSS_DATABASE_URL \
			-e COLLECTOSS_SCHEMA \
			postgres:16-alpine sh -c '\
			set -e; \
			pg_isready -d "$$COLLECTOSS_DATABASE_URL"; \
			PGOPTIONS="-c default_transaction_read_only=on" \
				psql -d "$$COLLECTOSS_DATABASE_URL" -c "SELECT count(*) AS repo_count FROM $${COLLECTOSS_SCHEMA}.repo;"'

# ========================================
# Clean targets
# ========================================
clean-smoke-test:
	@echo "Cleaning up..."
	@$(CONTAINER_RUNTIME) stop $(FRONTEND_CONTAINER) > /dev/null 2>&1 || true
	@$(CONTAINER_RUNTIME) rm $(FRONTEND_CONTAINER) > /dev/null 2>&1 || true
	@$(CONTAINER_RUNTIME) stop $(BACKEND_CONTAINER) > /dev/null 2>&1 || true
	@$(CONTAINER_RUNTIME) rm $(BACKEND_CONTAINER) > /dev/null 2>&1 || true
	@echo "Cleanup complete"

# Alias for integration test cleanup (uses same containers as smoke tests for now)
clean-integration-test: clean-smoke-test
