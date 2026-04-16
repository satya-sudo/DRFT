APP_NAME := drft
GOCACHE := $(CURDIR)/.gocache
DEV_COMPOSE := docker compose -f docker-compose.dev.yml
PROD_COMPOSE := docker compose --env-file .env.prod -f docker-compose.prod.yml

.PHONY: build run test frontend-install frontend-dev frontend-build docker-up docker-down docker-logs docker-prod-up docker-prod-down docker-prod-logs docker-publish

build:
	GOCACHE=$(GOCACHE) go -C backend build -o ../bin/$(APP_NAME) ./cmd/drft

run:
	GOCACHE=$(GOCACHE) go -C backend run ./cmd/drft

test:
	GOCACHE=$(GOCACHE) go -C backend test ./...

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

docker-up:
	$(DEV_COMPOSE) up --build -d

docker-down:
	$(DEV_COMPOSE) down

docker-logs:
	$(DEV_COMPOSE) logs -f drft-api drft-web postgres

docker-prod-up:
	$(PROD_COMPOSE) up -d

docker-prod-down:
	$(PROD_COMPOSE) down

docker-prod-logs:
	$(PROD_COMPOSE) logs -f drft-api drft-web postgres

docker-publish:
	./scripts/publish-images.sh
