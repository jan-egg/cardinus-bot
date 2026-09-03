# Cardinus Bot

TypeScript Discord music bot using Discord.js and Lavalink.

## Requirements

- Node.js 22 or later
- Docker Desktop
- A Discord application with a bot user

## Configuration

Copy `.env.example` to `.env` and fill in the values:

```powershell
Copy-Item .env.example .env
```

- `DISCORD_TOKEN`: Bot token from the Discord Developer Portal
- `DISCORD_CLIENT_ID`: Application ID from the General Information page
- `DISCORD_GUILD_ID`: Optional test server ID. Leave blank for global commands.

The `.env` file is ignored by Git and must never be committed.

## Install and Run

```powershell
npm install
npm run register
npm start
```

## Docker

```powershell
docker compose up --build -d
docker compose logs -f cardinus
```

Stop the services with:

```powershell
docker compose down
```

## Commands

- `/ping` checks the bot connection.
- `/play query` searches YouTube or loads a URL.
- `/skip` skips the current track.
- `/stop` stops playback and leaves the voice channel.
- `/queue` lists queued tracks.
- `/nowplaying` shows the current track.

## Project Structure

```text
src/
├── commands.ts          Slash-command definitions and handlers
├── config.ts            Environment configuration
├── index.ts             Discord and Lavalink startup
└── register-commands.ts Slash-command registration
lavalink/
├── application.yml      Lavalink server configuration
└── Dockerfile           Lavalink image with YouTube source plugin
```

## License

MIT
