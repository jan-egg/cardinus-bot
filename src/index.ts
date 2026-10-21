import { Client, GatewayIntentBits, MessageFlags } from 'discord.js';
import { LavalinkManager } from 'lavalink-client';
import { config } from './config.js';
import { handleCommand } from './commands.js';
import { registerPlayerEvents } from './music/player.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const lavalink = new LavalinkManager({
  nodes: [{
    id: 'main',
    host: config.lavalink.host,
    port: config.lavalink.port,
    authorization: config.lavalink.password,
    retryAmount: Infinity,
    retryDelay: 10_000
  }],
  sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard.send(payload),
  autoSkip: true,
  autoSkipOnResolveError: true,
  playerOptions: {
    defaultSearchPlatform: 'ytsearch',
    requesterTransformer: (requester) => {
      const user = requester as { id?: string; username?: string };
      return { id: user.id, username: user.username };
    },
    onDisconnect: { autoReconnect: true, destroyPlayer: false },
    onEmptyQueue: { destroyAfterMs: 120_000 }
  },
  queueOptions: { maxPreviousTracks: 10 }
});

lavalink.nodeManager.on('connect', (node) => console.log(`Lavalink node "${node.id}" connected.`));
lavalink.nodeManager.on('error', (_node, error) => {
  console.error('Lavalink node error:', error.message);
});
registerPlayerEvents(client, lavalink);

client.on('raw', (packet) => lavalink.sendRawData(packet));
client.once('clientReady', (readyClient) => {
  void lavalink.init({ id: readyClient.user.id, username: readyClient.user.username });
  console.log(`Logged in as ${readyClient.user.tag}`);
});
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try { await handleCommand(interaction, lavalink); }
  catch (error) {
    console.error(error);
    const message = 'Something went wrong while handling that command.';
    if (interaction.deferred || interaction.replied) await interaction.editReply(message).catch(() => undefined);
    else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  }
});

await client.login(config.token);
