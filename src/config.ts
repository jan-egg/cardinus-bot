import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  guildId: process.env.DISCORD_GUILD_ID,
  lavalink: {
    host: process.env.LAVALINK_HOST ?? 'localhost',
    port: Number(process.env.LAVALINK_PORT ?? 2333),
    password: required('LAVALINK_PASSWORD')
  },
  rag: {
    url: process.env.RAG_URL ?? 'http://localhost:8000',
    apiKey: process.env.RAG_API_KEY ?? ''
  }
};
