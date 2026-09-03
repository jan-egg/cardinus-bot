import { Client, GatewayIntentBits } from 'discord.js';
import { LavalinkManager } from 'lavalink-client';
import { config } from './config.js';
import { handleCommand } from './commands.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const lavalink = new LavalinkManager({
  nodes: [{ id: 'main', host: config.lavalink.host, port: config.lavalink.port, authorization: config.lavalink.password }],
  sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard.send(payload),
  autoSkip: true
});

client.on('raw', (packet) => lavalink.sendRawData(packet));
client.once('ready', (readyClient) => {
  void lavalink.init({ id: readyClient.user.id, username: readyClient.user.username });
  console.log(`Logged in as ${readyClient.user.tag}`);
});
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try { await handleCommand(interaction, lavalink); }
  catch (error) {
    console.error(error);
    const message = 'Something went wrong while handling that command.';
    if (interaction.deferred || interaction.replied) await interaction.editReply(message);
    else await interaction.reply({ content: message, ephemeral: true });
  }
});

await client.login(config.token);
