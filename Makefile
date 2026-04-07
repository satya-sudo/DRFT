APP_NAME := drft
GOCACHE := $(CURDIR)/.gocache

.PHONY: build run test frontend-install frontend-dev frontend-build docker-up docker-down docker-logs

build:
	GOCACHE=$(GOCACHE) go build -o ./bin/$(APP_NAME) ./cmd/drft

run:
	GOCACHE=$(GOCACHE) go run ./cmd/drft

test:
	GOCACHE=$(GOCACHE) go test ./...

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f drft-api postgres
