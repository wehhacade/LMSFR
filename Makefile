# LMSBR v2 — Docker backend + local Next.js frontend
#
# Override compose file:
#   export COMPOSE_FILE=docker-compose.yml
#   make migrate
# One-shot:
#   make migrate COMPOSE_FILE=docker-compose.yml
#
# Optional host-port overrides: copy compose.ports.env.example → compose.ports.env (gitignored)

# Windows: GNU Make defaults to cmd.exe; shell recipes need Git Bash (ships with Git for Windows).
ifeq ($(OS),Windows_NT)
# Short path avoids "path not found" / cmd.exe fallback when SHELL contains spaces.
GIT_BASH := C:/PROGRA~1/Git/bin/bash.exe
ifeq ($(wildcard $(GIT_BASH)),)
GIT_BASH := C:/Program Files/Git/bin/bash.exe
endif
ifeq ($(wildcard $(GIT_BASH)),)
$(error Git Bash not found. Install Git for Windows: https://git-scm.com/download/win)
endif
SHELL := $(GIT_BASH)
.SHELLFLAGS := -ec
endif

COMPOSE_FILE ?= docker-compose.yml
COMPOSE_ENV_FILE := $(wildcard compose.ports.env)
COMPOSE_ENV_FLAGS := $(if $(COMPOSE_ENV_FILE),--env-file compose.ports.env,)
# Use the wrapper so `make start` works when this shell is not yet in the docker group.
DC = bash scripts/lmsbr-compose $(COMPOSE_ENV_FLAGS) -f $(COMPOSE_FILE)

# Host ports (override via compose.ports.env — see compose.ports.env.example)
POSTGRES_PORT ?= 5433
REDIS_PORT ?= 6379
-include compose.ports.env
export POSTGRES_PORT REDIS_PORT

# LAN IP for Flutter / mobile (auto-detected; override: make start LAN_API_HOST=10.x.x.x)
ifeq ($(OS),Windows_NT)
LAN_API_HOST ?= $(shell "$(GIT_BASH)" -c "ipconfig 2>/dev/null | grep -i 'IPv4' | grep -v '127.0.0.1' | head -1 | sed 's/.*: //' | tr -d '\r'")
else
LAN_API_HOST ?= $(shell hostname -I 2>/dev/null | awk '{print $$1}')
endif
API_PORT ?= 8000

.PHONY: help init start dev up down stop restart logs status start-backend sync-lan-env fix-stack fix-permissions \
	migrate makemigrations startapp createsuperuser shell test collectstatic warm-cache \
	frontend-install frontend-dev frontend-build frontend-deploy start-frontend frontend-lint stop-frontend frontend-logs \
	deploy dep fe fer fed fel \
	mobile-install mobile-start mobile-sync-env \
	mobile-services-install mobile-services-start mobile-services-sync-env \
	backend-install db-shell db-logs redis-shell reset-db reset-db-real db-dump db-restore load-prod-dump free-ports docker-prune clean \
	import-legacy import-legacy-list import-users import-users-fresh import-all-legacy import-raw-legacy import-user-locations seed-locations seed-hubkadhigis seed-dhacdooyinka \
	import-auth-groups-fresh \
	truncate-legacy truncate-locations truncate-users truncate-auth-groups \
	insightface-ensure insightface-enroll

BACKEND := django
FRONTEND := frontend
DB_SERVICE := db
DB_NAME := lmsbrdb
DB_USER := postgres
FRONTEND_PID_FILE := .frontend.pid

BACKEND_EXEC = $(DC) exec -T $(BACKEND)
BACKEND_EXEC_IT = $(DC) exec $(BACKEND)

help:
	@echo "LMSBR v2 — Django commands run inside Docker; frontend runs on the host."
	@echo ""
	@echo "Compose file (default: docker-compose.yml):"
	@echo "  export COMPOSE_FILE=docker-compose.yml"
	@echo ""
	@echo "Optional ports: copy compose.ports.env.example → compose.ports.env"
	@echo ""
	@echo "Stack:"
	@echo "  make start             - Backend (Docker) + frontend (npm) together"
	@echo "  make init              - First-time setup: .env + backend + migrate"
	@echo "  make deploy / make dep - ONE command: makemigrations + migrate + rebuild/restart backend + build/restart frontend"
	@echo "                         Live API uses the Docker IMAGE only — editing backend/ does nothing"
	@echo "                         until you rebuild (make deploy / make dep). Frontend needs make fed."
	@echo "  make start-backend     - Docker only (db, redis, django, celery, nginx)"
	@echo "  make up                - Build and start backend services (Docker only)"
	@echo "  make down / make stop  - Stop all Docker services"
	@echo "  make restart           - down + up --build + start frontend"
	@echo "  make status            - docker compose ps"
	@echo "  make logs              - Tail all service logs"
	@echo "  make logs-django       - Tail Django logs"
	@echo "  make logs-celery       - Tail Celery logs"
	@echo ""
	@echo "Backend (container: $(BACKEND)):"
	@echo "  make migrate           - Run migrations"
	@echo "  make makemigrations app=<app>"
	@echo "  make startapp app=<name>  - New Django app under backend/apps/<name>/"
	@echo "  make createsuperuser"
	@echo "  make shell"
	@echo "  make test"
	@echo "  make collectstatic"
	@echo "  make warm-cache"
	@echo "  make backend-install   - pip install in container"
	@echo ""
	@echo "Database snapshot (share migrated data via git):"
	@echo "  make db-dump           - dump lmsbrdb → backend/data/seed/appdb_seed.dump"
	@echo "  make db-restore        - load lmsbrdb from backend/data/seed/appdb_seed.dump"
	@echo "  make reset-db-real     - wipe ALL volumes + reload the real data snapshot"
	@echo "  make load-prod-dump    - copy Downloads MySQL dump → split → import ALL mappable tables"
	@echo "                           DUMP=~/Downloads/lmsbr_prod_latest.sql (override path)"
	@echo "  make import-all-legacy - import every mappable table from data/split/ (--truncate)"
	@echo "  make import-raw-legacy - load EVERY split table into Postgres schema legacy.* (no skips)"
	@echo "  make import-user-locations - copy legacy GPS tracks + backfill user lat/lng"
	@echo ""
	@echo "Legacy import (phpMyAdmin SQL → data/<table>.sql):"
	@echo "  make import-users              - Import users"
	@echo "  make import-users-fresh        - seed locations + truncate + import users"
	@echo "  make import-auth-groups-fresh  - truncate + import auth groups"
	@echo "  make import-directorate        - Import directorates"
	@echo "  make import-<table>            - Any table (users, suspects, county, …)"
	@echo "  make import-legacy table=suspects ARGS=\"--truncate\""
	@echo "  make import-legacy-list"
	@echo "  make seed-locations"
	@echo "  make seed-hubkadhigis          - Locations + hub lookups + access roles"
	@echo "  make seed-dhacdooyinka        - Locations + dhacdooyinka demo data"
	@echo "  make insightface-ensure        - Create lmsbr-suspects collection if missing"
	@echo "  make insightface-enroll        - Backfill suspect photos into InsightFace (limit=50)"
	@echo ""
	@echo "Truncate (empty table, reset id):"
	@echo "  make truncate-users"
	@echo "  make truncate-auth-groups"
	@echo "  make truncate-region / truncate-county / truncate-subcounty"
	@echo "  make truncate-locations        - region + county + sub-county"
	@echo "  make truncate-<table>          - any table"
	@echo "  make truncate-legacy table=suspects"
	@echo ""
	@echo "Frontend (host, $(FRONTEND)/):"
	@echo "  make fe                - status (systemd lmsbr-frontend)"
	@echo "  make fer               - restart frontend"
	@echo "  make fed               - build + restart frontend (production deploy)"
	@echo "  make start-frontend    - start frontend systemd service (no build)"
	@echo "  make fel               - follow frontend logs"
	@echo "  make frontend-install  - npm install"
	@echo "  make frontend-dev      - npm run dev  → http://localhost:3000"
	@echo "  make frontend-build    - npm run build"
	@echo "  make frontend-deploy   - npm run build + restart systemd service"
	@echo "  make frontend-lint     - npm run lint"
	@echo ""
	@echo "Mobile (React Native + Metro + USB):"
	@echo "  make mobile-install    - npm install in mobile/"
	@echo "  make mobile-start      - Metro bundler (then: npm run android)"
	@echo "  make mobile-sync-env   - refresh USB API config"
	@echo "  make mobile-services-install - npm install in mobile_services/"
	@echo "  make mobile-services-start   - Metro for survey app (port 8082)"
	@echo ""
	@echo "Database / Redis:"
	@echo "  make db-shell          - psql in $(DB_SERVICE) container"
	@echo "  make db-logs"
	@echo "  make redis-shell       - redis-cli in redis container"
	@echo "  make reset-db          - Destructive: remove volumes and restart"
	@echo ""
	@echo "Utilities:"
	@echo "  make docker-prune"
	@echo "  make clean             - Remove Python __pycache__"
	@echo ""
	@echo "URLs (when running):"
	@echo "  API (LAN):  http://$(LAN_API_HOST):$(API_PORT)/api/v3/"
	@echo "  API (local): http://localhost:$(API_PORT)/api/v3/"
	@echo "  Admin:       http://localhost:$(API_PORT)/admin/"
	@echo "  Frontend:    http://localhost:3000"
	@echo ""
	@echo "LAN IP (Flutter / Expo): make start  or  make mobile-start"

# Ensure root .env has LAN API URLs for mobile / host-side Redis (Postgres creds stay in docker-compose.yml)
sync-lan-env:
	@host='$(LAN_API_HOST)'; port='$(API_PORT)'; base="http://$$host:$$port"; \
	file=".env"; \
	if [ ! -f "$$file" ]; then cp .env.example "$$file" 2>/dev/null || touch "$$file"; fi; \
	redis='redis://127.0.0.1:$(REDIS_PORT)/0'; \
	hosts="localhost,127.0.0.1,0.0.0.0,$$host"; \
	for kv in "ALLOWED_HOSTS=$$hosts" "PUBLIC_API_BASE_URL=$$base" "REDIS_URL=$$redis" \
	  "POSTGRES_HOST=127.0.0.1" "POSTGRES_PORT=$(POSTGRES_PORT)"; do \
	  key=$${kv%%=*}; val=$${kv#*=}; \
	  if grep -q "^$$key=" "$$file"; then sed -i "s|^$$key=.*|$$key=$$val|" "$$file"; \
	  else echo "$$key=$$val" >> "$$file"; fi; \
	done; \
	sed -i '/^DATABASE_URL=/d' "$$file" 2>/dev/null || true; \
	sed -i '/^POSTGRES_USER=/d' "$$file" 2>/dev/null || true; \
	sed -i '/^POSTGRES_PASSWORD=/d' "$$file" 2>/dev/null || true; \
	sed -i '/^POSTGRES_DB=/d' "$$file" 2>/dev/null || true; \
	echo "✓ LAN API ready: $$base/api/v3/ (ALLOWED_HOSTS includes $$host)"

init:
	@if [ ! -f .env ]; then \
		echo "Creating .env from defaults..."; \
		cp .env.example .env 2>/dev/null || true; \
	fi
	@$(MAKE) sync-lan-env
	@$(MAKE) start-backend
	@$(MAKE) migrate
	@echo ""
	@echo "✅ Initialized ($(COMPOSE_FILE))."
	@echo "   Next: make createsuperuser"
	@echo "   Then: make start"

start-backend: sync-lan-env
	@echo "🚀 Starting backend ($(COMPOSE_FILE))..."
	@echo "   Services: db, redis, django, celery (nginx skipped — run make start-nginx if needed)"
	@$(DC) up -d db redis
	@$(DC) up -d --wait db redis
	@$(DC) up -d --force-recreate django celery celery-beat
	@$(MAKE) insightface-ensure
	@echo ""
	@echo "✅ Backend stack is up."
	@echo "   API (LAN):   http://$(LAN_API_HOST):$(API_PORT)/api/v3/"
	@echo "   API (local): http://localhost:$(API_PORT)/api/v3/"
	@echo "   Admin:       http://localhost:$(API_PORT)/admin/"

fix-stack:
	@echo "🔧 Recreating Docker network (fixes 'db' hostname / port conflicts)..."
	@$(DC) down --remove-orphans
	@$(MAKE) start-backend

# Fix root-owned files from Docker (git add / edit permission errors).
# On Windows, Git Bash MSYS converts /workspace → C:/Program Files/Git/workspace and breaks the mount.
ifeq ($(OS),Windows_NT)
fix-permissions:
	@echo "Skipping fix-permissions on Windows (Docker Desktop does not need chown)."
else
fix-permissions:
	@echo "🔧 Fixing repo ownership (Docker-created root files)..."
	@docker run --rm -v "$(CURDIR):/workspace" alpine chown -R $$(id -u):$$(id -g) /workspace/.git /workspace/frontend /workspace
	@echo "✅ Ownership restored to $$(id -un):$$(id -gn)"
endif

start-nginx:
	@echo "🌐 Starting nginx reverse proxy (profile: proxy)..."
	@$(DC) --profile proxy up -d nginx
	@echo "   Proxy: http://localhost:$${NGINX_PORT:-8080}"

ifeq ($(OS),Windows_NT)
BASH := $(GIT_BASH)
else
BASH := bash
endif

start:
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env 2>/dev/null || cp backend/.env.example .env 2>/dev/null || true; \
	fi
	@$(MAKE) sync-lan-env
	@if [ ! -d $(FRONTEND)/node_modules ]; then \
		echo "Installing frontend dependencies..."; \
		cd $(FRONTEND) && npm install; \
	fi
	@$(MAKE) start-backend
	@if [ -f $(FRONTEND_PID_FILE) ] && kill -0 $$(cat $(FRONTEND_PID_FILE)) 2>/dev/null; then \
		echo "Frontend already running (PID $$(cat $(FRONTEND_PID_FILE))) — skipping."; \
	else \
		( cd $(FRONTEND) && npm run dev >> ../frontend.log 2>&1 ) & echo $$! > $(FRONTEND_PID_FILE); \
		echo "Frontend started (PID $$(cat $(FRONTEND_PID_FILE)))"; \
	fi
	@echo ""
	@echo "  App:         http://localhost:3000"
	@echo "  API (local): http://localhost:$(API_PORT)/api/v3/"
	@echo "  Admin:       http://localhost:$(API_PORT)/admin/"
	@echo ""
	@echo "  Logs:        make frontend-logs   (tail -f frontend.log)"
	@echo "  Stop all:    make down"
	@echo "  Mobile:      cd mobile && npm start"

# Alias for older docs/scripts
dev: start

up:
	$(DC) up --build -d

down: stop-frontend
	$(DC) down

stop-frontend:
	@systemctl --user stop lmsbr-frontend.service 2>/dev/null || true
	@if [ -f $(FRONTEND_PID_FILE) ]; then \
		pid=$$(cat $(FRONTEND_PID_FILE)); \
		kill $$pid 2>/dev/null && echo "Frontend stopped (PID $$pid)" || echo "Frontend process already gone."; \
		rm -f $(FRONTEND_PID_FILE); \
	else \
		echo "Frontend stop requested."; \
	fi

# Short aliases for systemd frontend service
fe:
	@systemctl --user status lmsbr-frontend.service --no-pager -l || true

fer:
	@systemctl --user restart lmsbr-frontend.service
	@systemctl --user --no-pager -l status lmsbr-frontend.service || true

fed: frontend-deploy

fel:
	@journalctl --user -u lmsbr-frontend.service -f

frontend-logs: fel

stop: down

restart: down up start-frontend

logs:
	$(DC) logs -f --tail=200

logs-django:
	$(DC) logs -f --tail=200 $(BACKEND)

logs-celery:
	$(DC) logs -f --tail=200 celery

status:
	$(DC) ps

migrate:
	$(BACKEND_EXEC) python manage.py migrate

makemigrations:
	$(BACKEND_EXEC) python manage.py makemigrations $(app)

# Full production deploy: migrations + backend rebuild/restart + frontend build/restart
deploy:
	@echo "🚀 Deploy start — backend + frontend"
	@$(MAKE) sync-lan-env
	@echo "▶ Ensuring db/redis are up..."
	@$(DC) up -d db redis
	@$(DC) up -d --wait db redis
	@echo "▶ Rebuilding & restarting Django + Celery + Beat..."
	@$(DC) up -d --build --force-recreate django celery celery-beat
	@echo "▶ Waiting for Django..."
	@for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do \
		if $(BACKEND_EXEC) python -c "import django; print('ok')" >/dev/null 2>&1; then break; fi; \
		sleep 2; \
	done
	@echo "▶ makemigrations..."
	@$(BACKEND_EXEC) python manage.py makemigrations $(app)
	@echo "▶ migrate..."
	@$(BACKEND_EXEC) python manage.py migrate
	@echo "▶ InsightFace suspects collection..."
	@$(MAKE) insightface-ensure
	@echo "▶ Frontend build + restart..."
	@$(MAKE) frontend-deploy
	@curl -sf -o /dev/null -w "API HTTP %{http_code}\n" http://127.0.0.1:8000/api/v3/ || echo "API check: container may still be booting"
	@echo ""
	@echo "✅ Deploy complete"
	@echo "   Frontend: http://127.0.0.1:3000  (lmsbr.com)"
	@echo "   API:      http://127.0.0.1:8000/api/v3/"

dep: deploy

startapp:
	@if [ -z "$(app)" ]; then \
		echo "Usage: make startapp app=<name>"; \
		echo "Example: make startapp app=surveys  →  backend/apps/surveys/"; \
		exit 1; \
	fi
	@if [ -d "backend/apps/$(app)" ] && [ -n "$$(ls -A backend/apps/$(app) 2>/dev/null)" ]; then \
		echo "Error: backend/apps/$(app) already exists and is not empty"; \
		exit 1; \
	fi
	@mkdir -p backend/apps/$(app)
	$(BACKEND_EXEC) python manage.py startapp $(app) apps/$(app)
	@echo ""
	@echo "✓ Created backend/apps/$(app)/"
	@echo "  1. Set name = \"apps.$(app)\" in backend/apps/$(app)/apps.py"
	@echo "  2. Add \"apps.$(app)\" to LOCAL_APPS in backend/config/settings/base.py"

collectstatic:
	$(BACKEND_EXEC) python manage.py collectstatic --noinput

createsuperuser:
	$(BACKEND_EXEC_IT) python manage.py createsuperuser

shell:
	$(BACKEND_EXEC_IT) python manage.py shell

test:
	$(BACKEND_EXEC) python manage.py test

warm-cache:
	$(BACKEND_EXEC) python manage.py warm_cache --verbose

seed-locations:
	$(BACKEND_EXEC) python manage.py seed_locations

seed-hubkadhigis:
	$(BACKEND_EXEC) python manage.py seed_locations
	$(BACKEND_EXEC) python manage.py seed_hubkadhigis_lookups
	$(BACKEND_EXEC) python manage.py seed_hubkadhigis_access

seed-dhacdooyinka:
	$(BACKEND_EXEC) python manage.py seed_locations
	$(BACKEND_EXEC) python manage.py seed_dhacdooyinka

# InsightFace: create lmsbr-suspects if missing. Used by make start / init / deploy.
# Talks to the InsightFace server from .env so this works even before a Django rebuild.
LIMIT ?= 50
insightface-ensure:
	@if [ ! -f .env ]; then echo "▶ InsightFace: no .env, skip"; exit 0; fi
	@base=$$(grep -E '^INSIGHTFACE_BASE_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" | sed 's:/*$$::'); \
	key=$$(grep -E '^INSIGHTFACE_API_KEY=' .env | cut -d= -f2- | tr -d '"' | tr -d "'"); \
	cid=$$(grep -E '^INSIGHTFACE_SUSPECTS_COLLECTION=' .env | cut -d= -f2- | tr -d '"' | tr -d "'"); \
	thr=$$(grep -E '^INSIGHTFACE_SEARCH_THRESHOLD=' .env | cut -d= -f2- | tr -d '"' | tr -d "'"); \
	dedup=$$(grep -E '^INSIGHTFACE_DEDUP_THRESHOLD=' .env | cut -d= -f2- | tr -d '"' | tr -d "'"); \
	if [ -z "$$base" ] || [ -z "$$key" ]; then echo "▶ InsightFace: not configured, skip"; exit 0; fi; \
	cid=$${cid:-lmsbr-suspects}; \
	thr=$${thr:-0.4}; \
	dedup=$${dedup:-0.55}; \
	echo "▶ InsightFace collection $$cid ..."; \
	code=$$(curl -sS -m 8 -o /tmp/lmsbr-insight-col.json -w "%{http_code}" \
		-H "Authorization: Bearer $$key" "$$base/v1/collections/$$cid" || echo 000); \
	if [ "$$code" = "200" ]; then echo "   already exists"; exit 0; fi; \
	if [ "$$code" != "404" ]; then echo "   skip (HTTP $$code)"; exit 0; fi; \
	echo "   missing — creating"; \
	curl -sS -m 15 -o /tmp/lmsbr-insight-col.json -w "   create HTTP %{http_code}\n" \
		-H "Authorization: Bearer $$key" -H "Content-Type: application/json" \
		-d "{\"id\":\"$$cid\",\"name\":\"LMSBR Suspects\",\"description\":\"TipPhone and mobile suspect / wanted gallery\",\"threshold\":$$thr,\"dedup_threshold\":$$dedup,\"save_face_crops\":false}" \
		"$$base/v1/collections" || echo "   InsightFace unreachable — start continues"

insightface-enroll:
	$(BACKEND_EXEC) python manage.py enroll_insightface_suspects --limit=$(LIMIT)

seed-surveys:
	$(BACKEND_EXEC) python manage.py seed_locations
	$(BACKEND_EXEC) python manage.py seed_surveys --flush

seed-survey-perf:
	$(BACKEND_EXEC) python manage.py seed_survey_responses_bulk --count 100000

seed-survey-perf-500k:
	$(BACKEND_EXEC) python manage.py seed_survey_responses_bulk --count 500000 --use-existing-users

import-legacy-list:
	$(BACKEND_EXEC) python manage.py import_legacy list

import-legacy:
	@if [ -z "$(table)" ]; then \
		echo "Usage: make import-legacy table=<name> [ARGS=\"--truncate\"]"; \
		echo "Example: make import-legacy table=suspects ARGS=\"--truncate --dry-run\""; \
		exit 1; \
	fi
	$(BACKEND_EXEC) python manage.py import_legacy $(table) $(ARGS)

import-users:
	$(BACKEND_EXEC) python manage.py import_legacy users $(ARGS)

import-users-fresh:
	$(BACKEND_EXEC) python manage.py seed_locations
	$(BACKEND_EXEC) python manage.py import_legacy users --truncate

import-locations-fresh:
	$(MAKE) truncate-locations
	$(MAKE) import-region
	$(MAKE) import-county
	$(MAKE) import-subcounty

# make import-directorate, import-suspects, import-suspectcase, …
import-%:
	$(BACKEND_EXEC) python manage.py import_legacy $* $(ARGS)

truncate-legacy-list:
	$(BACKEND_EXEC) python manage.py truncate_legacy --list

truncate-legacy:
	@if [ -z "$(table)" ]; then \
		echo "Usage: make truncate-legacy table=<name>"; \
		exit 1; \
	fi
	$(BACKEND_EXEC) python manage.py truncate_legacy $(table)

truncate-locations:
	$(BACKEND_EXEC) python manage.py truncate_legacy locations

truncate-users:
	$(BACKEND_EXEC) python manage.py truncate_legacy users

truncate-auth-groups:
	$(BACKEND_EXEC) python manage.py truncate_legacy auth-groups

import-auth-groups-fresh:
	$(BACKEND_EXEC) python manage.py import_legacy auth-groups --truncate

# make truncate-region, truncate-county, truncate-subcounty, …
truncate-%:
	$(BACKEND_EXEC) python manage.py truncate_legacy $*

backend-install:
	$(DC) run --rm $(BACKEND) pip install -r requirements.txt

frontend-install:
	cd $(FRONTEND) && npm install

frontend-dev:
	cd $(FRONTEND) && npm run dev

frontend-build:
	cd $(FRONTEND) && npm run build

start-frontend:
	@systemctl --user start lmsbr-frontend.service
	@sleep 1
	@systemctl --user is-active lmsbr-frontend.service
	@curl -sf -o /dev/null -w "Frontend HTTP %{http_code}\n" http://127.0.0.1:3000/dashboard || (echo "Frontend not responding on :3000" && exit 1)
	@echo "Frontend up → http://127.0.0.1:3000 (Apache: lmsbr.com)"

frontend-deploy: frontend-build
	@systemctl --user restart lmsbr-frontend.service
	@sleep 1
	@systemctl --user is-active lmsbr-frontend.service
	@curl -sf -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3000/dashboard || (echo "Frontend not responding on :3000" && exit 1)
	@echo "Frontend deployed → http://127.0.0.1:3000 (Apache: lmsbr.com)"

frontend-lint:
	cd $(FRONTEND) && npm run lint

MOBILE := mobile

mobile-install:
	cd $(MOBILE) && npm install

mobile-sync-env: sync-lan-env
	API_PORT=$(API_PORT) API_HOST=$(LAN_API_HOST) node $(MOBILE)/scripts/sync-usb-env.js

mobile-start: sync-lan-env
	@if [ ! -d $(MOBILE)/node_modules ]; then $(MAKE) mobile-install; fi
	@API_PORT=$(API_PORT) API_HOST=$(LAN_API_HOST) node $(MOBILE)/scripts/sync-usb-env.js
	@echo ""
	@echo "📱 React Native + Metro — Terminal 1: npm start"
	@echo "   Terminal 2: cd mobile && npm run android"
	@echo "   API (LAN):  http://$(LAN_API_HOST):$(API_PORT)/api/v3/"
	@echo "   API (USB):  http://localhost:$(API_PORT)/api/v3/ (after adb reverse)"
	@echo ""
	@cd $(MOBILE) && npm start

MOBILE_SERVICES := mobile_services

mobile-services-install:
	cd $(MOBILE_SERVICES) && npm install

mobile-services-sync-env: sync-lan-env
	API_PORT=$(API_PORT) API_HOST=$(LAN_API_HOST) node $(MOBILE_SERVICES)/scripts/sync-usb-env.js

mobile-services-start: sync-lan-env
	@if [ ! -d $(MOBILE_SERVICES)/node_modules ]; then $(MAKE) mobile-services-install; fi
	@API_PORT=$(API_PORT) API_HOST=$(LAN_API_HOST) node $(MOBILE_SERVICES)/scripts/sync-usb-env.js
	@echo ""
	@echo "📱 Services RN + Metro (port 8082) — Terminal 1: npm start"
	@echo "   Terminal 2: cd mobile_services && npm run android"
	@echo "   API (LAN):  http://$(LAN_API_HOST):$(API_PORT)/api/v3/"
	@echo ""
	@cd $(MOBILE_SERVICES) && npm start -- --port 8082

db-shell:
	$(DC) exec $(DB_SERVICE) psql -U $(DB_USER) -d $(DB_NAME)

db-logs:
	$(DC) logs -f --tail=200 $(DB_SERVICE)

redis-shell:
	$(DC) exec redis redis-cli

# Shared database snapshot (committed to git so the team can sync data)
DB_SEED_FILE := backend/data/seed/appdb_seed.dump

# Latest phpMyAdmin MySQL dump (Downloads → Postgres via split + import_legacy)
PROD_SQL_NAME := lmsbr_prod_latest.sql
# Prefer explicit DUMP=…; otherwise Windows USERPROFILE, else Unix HOME.
ifeq ($(origin DUMP),command line)
  # keep caller override
else ifneq ($(USERPROFILE),)
  DUMP := $(shell cygpath -u "$(USERPROFILE)/Downloads/$(PROD_SQL_NAME)" 2>/dev/null || echo "$(USERPROFILE)/Downloads/$(PROD_SQL_NAME)" | sed 's#\\\\#/#g; s#^\([A-Za-z]\):#/\L\1#')
else ifneq ($(HOME),)
  DUMP := $(HOME)/Downloads/$(PROD_SQL_NAME)
else
  DUMP := backend/data/$(PROD_SQL_NAME)
endif
PROD_SQL_DEST := backend/data/$(PROD_SQL_NAME)
# Ordered for FK-safe import into v3 models
PROD_IMPORT_TABLES := region county sub_county people_section directorate departments user_type users auth-groups \
	suspectstatus suspects suspectcase damiinada suspectresponse fcmtoken notices agents staff \
	darajooyin ciidanka nuucahubka goobtalaguwareejiyey hubkadhigis hubkadhigis_images \
	noocadhacdooyinkaguud noocyada_dhacdooyinka dhacdooyinka faahfaahinta dhibanayaashas dhibane_documents \
	surveys_survey surveys_surveysection surveys_question surveys_choice surveys_response surveys_answer

load-prod-dump:
	@set -e; \
	if [ ! -f "$(DUMP)" ]; then \
		echo "❌ Dump not found: $(DUMP)"; \
		echo "   Place the file there, or run: make load-prod-dump DUMP=/path/to/lmsbr_prod_latest.sql"; \
		exit 1; \
	fi; \
	echo "⚠️  This REPLACES imported app tables from $(DUMP). Continue in 3s (Ctrl+C to abort)..."; \
	sleep 3 || true; \
	echo "→ Copying dump to $(PROD_SQL_DEST)"; \
	mkdir -p backend/data; \
	cp -f "$(DUMP)" "$(PROD_SQL_DEST)"; \
	$(DC) up -d $(DB_SERVICE) redis $(BACKEND); \
	echo "Waiting for Postgres..."; \
	until $(DC) exec -T $(DB_SERVICE) pg_isready -U $(DB_USER) >/dev/null 2>&1; do sleep 1; done; \
	$(BACKEND_EXEC) python manage.py migrate --noinput; \
	echo "→ Splitting phpMyAdmin dump into data/split/ …"; \
	MSYS_NO_PATHCONV=1 $(BACKEND_EXEC) python data/split_prod_dump.py data/$(PROD_SQL_NAME); \
	echo "→ Importing ALL mappable tables into PostgreSQL…"; \
	$(BACKEND_EXEC) python manage.py import_legacy all --truncate; \
	echo "→ Loading unmapped tables into schema legacy.* (full dump, no skips)…"; \
	$(BACKEND_EXEC) python -c "exec(open('data/import_raw_legacy.py', encoding='utf-8').read())"; \
	echo "→ Importing GPS tracks (legacy.user_location → public.user_location)…"; \
	$(BACKEND_EXEC) python manage.py import_user_locations; \
	$(DC) restart django celery; \
	USERS=$$($(DC) exec -T $(DB_SERVICE) psql -U $(DB_USER) -d $(DB_NAME) -tAc "SELECT COUNT(*) FROM users" 2>/dev/null || echo 0); \
	echo ""; \
	echo "✓ load-prod-dump finished — users=$$USERS"; \
	echo "  Source: $(DUMP)"; \
	echo "  Tip: make db-dump  # save Postgres snapshot for fast make reset-db-real on server"

import-all-legacy:
	@$(BACKEND_EXEC) python manage.py import_legacy all --truncate

import-raw-legacy:
	@$(BACKEND_EXEC) python -c "exec(open('data/import_raw_legacy.py', encoding='utf-8').read())"

import-user-locations:
	@$(BACKEND_EXEC) python manage.py import_user_locations $(ARGS)

db-dump:
	$(DC) exec -T $(DB_SERVICE) pg_dump -U $(DB_USER) -d $(DB_NAME) -Fc -Z 9 -f /tmp/appdb_seed.dump
	$(DC) cp $(DB_SERVICE):/tmp/appdb_seed.dump $(DB_SEED_FILE)
	@echo "✓ Dump written to $(DB_SEED_FILE) — commit and push it to share with the team"

# Wait for Postgres, then drop/recreate lmsbrdb and stream the seed dump into it.
# Uses stdin (not `docker compose cp`) so Git Bash path mangling can't break it.
define RESTORE_SEED
	echo "Waiting for Postgres to accept connections..."; \
	until $(DC) exec -T $(DB_SERVICE) pg_isready -U $(DB_USER) >/dev/null 2>&1; do sleep 1; done; \
	$(DC) exec -T $(DB_SERVICE) psql -U $(DB_USER) -d postgres -c "DROP DATABASE IF EXISTS $(DB_NAME) WITH (FORCE);"; \
	$(DC) exec -T $(DB_SERVICE) psql -U $(DB_USER) -d postgres -c "CREATE DATABASE $(DB_NAME);"; \
	echo "Restoring $(DB_SEED_FILE) (this can take a minute)..."; \
	$(DC) exec -T $(DB_SERVICE) pg_restore -U $(DB_USER) -d $(DB_NAME) --no-owner --no-privileges < $(DB_SEED_FILE); \
	USERS=$$($(DC) exec -T $(DB_SERVICE) psql -U $(DB_USER) -d $(DB_NAME) -tAc "SELECT COUNT(*) FROM users" 2>/dev/null || echo 0); \
	if [ "$$USERS" -gt 0 ] 2>/dev/null; then \
		echo "✓ Restore verified: $$USERS users in $(DB_NAME)"; \
	else \
		echo "❌ Restore FAILED — $(DB_NAME) is empty. Check the pg_restore output above."; \
		exit 1; \
	fi
endef

db-restore:
	@if [ ! -f "$(DB_SEED_FILE)" ]; then \
		echo "❌ $(DB_SEED_FILE) not found. Run 'git pull' first."; \
		exit 1; \
	fi
	@echo "⚠️  This REPLACES all data in $(DB_NAME) with $(DB_SEED_FILE). Continue in 3s (Ctrl+C to abort)..."
	@sleep 3 || true
	$(DC) up -d $(DB_SERVICE)
	@$(RESTORE_SEED)
	$(DC) restart django celery
	@echo "✓ Database restored from $(DB_SEED_FILE)"

# Full clean slate: wipe all volumes, then load the real (migrated) data from the seed dump.
reset-db-real:
	@if [ ! -f "$(DB_SEED_FILE)" ]; then \
		echo "❌ $(DB_SEED_FILE) not found. Run 'git pull' first."; \
		exit 1; \
	fi
	@echo "⚠️  This removes all Postgres/Redis/static/media volumes and reloads the real data. Continue in 3s (Ctrl+C to abort)..."
	@sleep 3 || true
	$(DC) down -v
	$(DC) up -d $(DB_SERVICE) redis
	@$(RESTORE_SEED)
	$(DC) up -d
	@echo "✓ Clean stack up with real data loaded from $(DB_SEED_FILE)"

reset-db:
	@echo "⚠️  This removes all Postgres/Redis/static/media volumes. Continue in 3s (Ctrl+C to abort)..."
	@sleep 3
	$(DC) down -v
	$(DC) up -d $(DB_SERVICE) redis
	@echo "Waiting for database..."
	@sleep 5
	$(DC) up -d
	@$(MAKE) migrate

# Free host ports 5432 and 80 so Docker can bind them (stops system postgresql/nginx/apache).
free-ports:
	@echo "Stopping services that commonly hold 5432 and 80..."
	@sudo systemctl stop postgresql nginx apache2 httpd 2>/dev/null || true
	@sudo /opt/lampp/lampp stop 2>/dev/null || true
	@sudo fuser -k 5432/tcp 80/tcp 2>/dev/null || true
	@sleep 1
	@echo "Port check:"
	@ss -tln | grep -E ':5432|:80 ' || echo "  5432 and 80 are free."

docker-prune:
	docker system prune -f

clean:
	find backend -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find backend -name '*.pyc' -delete 2>/dev/null || true
