# Cardinus Bot

Discord music bot built with TypeScript, Discord.js, and Lavalink.

## Requirements

- Node.js 22 or later
- Docker Desktop
- A Discord application with a bot user

## Setup

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and optionally
`DISCORD_GUILD_ID` in `.env`. Set a private `LAVALINK_PASSWORD` shared by the
bot and Lavalink services.

The `.env` file is ignored by Git and must not be committed.

## Run

```powershell
npm install
npm run register
docker compose up --build -d
```

View logs:

```powershell
docker compose logs -f
```

Stop the services:

```powershell
docker compose down
```

## Commands

- `/ping`
- `/play query`
- `/skip`
- `/stop`
- `/queue`
- `/nowplaying`

## License

MIT
