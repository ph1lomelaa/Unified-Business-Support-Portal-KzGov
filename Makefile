FRONTEND_PORT ?= 3000
BACKEND_PORT ?= 8000
PY := backend/.venv/bin/python

.PHONY: install install-backend install-frontend seed backend frontend build test import-news

install: install-backend install-frontend

install-backend:
	python3 -m venv backend/.venv
	backend/.venv/bin/pip install -r backend/requirements.txt

install-frontend:
	cd frontend && npm install

# Seed reference data + 6 services created THROUGH the constructor API (REQ-24).
seed:
	cd backend && ../$(PY) -m app.seed
	cd backend && ../$(PY) -m app.seed_services
	cd backend && ../$(PY) -m app.seed_apps

# Only the reference data (orgs/companies/users).
seed-ref:
	cd backend && ../$(PY) -m app.seed

# Run the FastAPI backend (http://localhost:$(BACKEND_PORT), Swagger at /api-docs)
backend:
	cd backend && ../$(PY) -m uvicorn app.main:app --reload --port $(BACKEND_PORT)

# Run the Next.js frontend (http://localhost:$(FRONTEND_PORT))
frontend:
	cd frontend && npm run dev -- -p $(FRONTEND_PORT)

build:
	cd frontend && npm run build

test:
	cd frontend && npm run test --silent
	cd backend && ../$(PY) -m pytest -q

import-news:
	@if docker compose ps backend --status running >/dev/null 2>&1; then \
		docker compose exec -T backend python -m app.import_news; \
	else \
		cd backend && ../$(PY) -m app.import_news; \
	fi
