# Cardinus Bot

Discord music bot and D&D assistant, built with TypeScript, Discord.js and Lavalink, with a
FastAPI knowledge base that answers questions from your own rulebooks and notes using a local
AI model (Ollama).

## Services

| Service     | What it does                                                                |
|-------------|------------------------------------------------------------------------------|
| `cardinus`  | The Discord bot                                                              |
| `lavalink`  | Audio server: YouTube, SoundCloud, Bandcamp, Spotify links, direct URLs      |
| `yt-cipher` | Solves YouTube's signature ciphers so YouTube playback keeps working         |
| `rag`       | D&D knowledge base API (FastAPI + ChromaDB + fastembed)                       |
| `ollama`    | Runs the local language model that writes the answers                        |

## Requirements

- Node.js 22 or later
- Docker Desktop
- A Discord application with a bot user
- For the knowledge base: about 8 GB of free RAM for the default model. An NVIDIA GPU makes
  answers much faster but is not required.

## Setup

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and optionally `DISCORD_GUILD_ID` in `.env`. Set a
private `LAVALINK_PASSWORD` and `RAG_API_KEY`. The `.env` file is ignored by Git and must not be
committed.

### YouTube sign-in

YouTube often blocks servers it thinks are bots. Signing Lavalink in with a Google account
fixes most "this track won't play" problems. **Use a spare Google account, not your main one.**

1. Leave `YOUTUBE_REFRESH_TOKEN` empty and start the stack (see Run).
2. Watch the Lavalink logs: `docker compose logs -f lavalink`
3. Open the URL it prints, enter the code and sign in with the spare account.
4. Lavalink then logs a refresh token. Copy it into `YOUTUBE_REFRESH_TOKEN` in `.env` and run
   `docker compose up -d` so you don't have to sign in again after every restart.

When a track still fails, the bot looks for the same song on SoundCloud and plays that
instead. Searches fall back from YouTube to SoundCloud too.

### Spotify (optional)

Create an app at https://developer.spotify.com/dashboard, then set `SPOTIFY_ENABLED=true`,
`SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. Spotify tracks, albums and playlists are
played by finding each song on YouTube (or SoundCloud).

### Knowledge base model

The first start downloads the model (`OLLAMA_MODEL`, default `llama3.1:8b`, about 5 GB).
`/ask` replies "not ready" until that finishes; `http://localhost:8000/health` shows progress.

- **NVIDIA GPU:** start with `docker compose -f compose.yaml -f compose.gpu.yaml up -d`.
- **Ollama installed on Windows** (also uses the GPU): set
  `OLLAMA_URL=http://host.docker.internal:11434` in `.env`, run `ollama pull llama3.1:8b`
  once, and you can stop the `ollama` container.
- **Low on RAM:** try `OLLAMA_MODEL=llama3.2:3b` (faster, weaker answers).

## Run

```powershell
npm install
npm run register
docker compose up --build -d
```

Run `npm run register` again whenever commands change.

View logs:

```powershell
docker compose logs -f
```

Stop the services:

```powershell
docker compose down
```

## Adding D&D sources

PDFs, Markdown, text and Word files are supported. There are three ways to add them:

- **Knowledge folder** (best for big rulebooks): copy files into `knowledge/`. They are indexed
  when the `rag` service starts, or immediately via `POST /documents/sync`. Deleting a file
  there removes it on the next sync.
- **API docs page:** open http://localhost:8000/docs, click *Authorize*, enter your
  `RAG_API_KEY`, and use `POST /documents` to upload.
- **Discord:** `/dnd-upload` with an attachment (Manage Server permission; Discord limits
  attachment size, so use the folder for large PDFs).

Indexing runs in the background; `/dnd-sources` shows the status. Scanned PDFs without a text
layer can't be read and show as failed; run them through OCR first.

## Commands

Music:

- `/play query [source]`: song, playlist or URL; `source` picks YouTube, YouTube Music,
  SoundCloud or Spotify search
- `/pause`, `/resume`, `/skip`, `/stop`
- `/queue [page]`, `/nowplaying`
- `/volume level`, `/seek position` (e.g. `1:30`)
- `/shuffle`, `/loop off|track|queue`, `/remove position`, `/clear`

The bot leaves after a minute alone in the voice channel, or two minutes after the queue ends.

D&D:

- `/ask question`: answers from the uploaded sources, with citations
- `/dnd-sources`: list documents and their indexing status
- `/dnd-upload file`, `/dnd-remove id`: manage documents (Manage Server permission)

## Development

```powershell
npm run dev                         # bot with reload; needs Lavalink running
cd rag; pip install -r requirements.txt pytest; python -m pytest
```

## License

MIT
