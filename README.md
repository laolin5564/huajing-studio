# Internal Image Generation System

A lightweight internal image-generation workspace built with Next.js, SQLite, and a background worker. It connects to an OpenAI-compatible image API such as sub2api and supports text-to-image, image-to-image, image editing, templates, history, conversations, user management, and admin settings.

## Features

- Text-to-image, image-to-image, and image editing workflows
- Conversation-style generation history
- Local SQLite database and local file storage
- Built-in template system
- User registration/login, groups, quotas, and admin panel
- Background worker for queued generation tasks
- Docker Compose deployment

## Tech Stack

- Next.js App Router
- React
- TypeScript
- SQLite via `node:sqlite`
- Docker / Docker Compose
- Bun for local development

## Quick Start

```bash
bun install
cp .env.example .env.local
bun run db:init
bun run dev:all
```

Then open <http://localhost:3000>.

The first registered user becomes an admin.

## Environment Variables

```env
SUB2API_BASE_URL=https://your-sub2api.example.com/v1
SUB2API_API_KEY=your_api_key
IMAGE_MODEL=gpt-image-2
IMAGE_STORAGE_DIR=./data/images
DATABASE_URL=file:./data/app.db
IMAGE_REQUEST_TIMEOUT_MS=300000
WORKER_POLL_INTERVAL_MS=3000
SESSION_COOKIE_SECURE=false
```

Set `SESSION_COOKIE_SECURE=true` only when serving the app over HTTPS.

## Docker Deployment

```bash
SUB2API_API_KEY=your_api_key docker compose up -d --build
```

By default the app listens on port `3000` and stores SQLite/images under `./data`.

## Scripts

```bash
bun run dev       # Next.js dev server
bun run worker    # image generation worker
bun run dev:all   # dev server + worker
bun run db:init   # initialize database and built-in templates
bun run build     # production build
bun run start     # production web server
bun run lint      # lint project
```

## Notes

- Do not commit `.env`, `.env.local`, `data/app.db`, or generated images.
- The image provider must expose OpenAI-compatible `/images/generations` and `/images/edits` endpoints.
- Generated files are served through the backend file API, not directly from the filesystem.

## License

MIT
