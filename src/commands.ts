import type { ChatInputCommandInteraction } from 'discord.js';
import type { LavalinkManager, Player } from 'lavalink-client';

export const commandDefinitions = [
  { name: 'ping', description: 'Check whether the bot is responding.' },
  { name: 'play', description: 'Play a YouTube URL or search query.', options: [{ type: 3, name: 'query', description: 'URL or search terms', required: true }] },
  { name: 'skip', description: 'Skip the current track.' },
  { name: 'stop', description: 'Stop playback and leave the voice channel.' },
  { name: 'queue', description: 'Show the current queue.' },
  { name: 'nowplaying', description: 'Show the current track.' }
] as const;

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
  lavalink: LavalinkManager
): Promise<void> {
  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  if (interaction.commandName === 'play') {
    await play(interaction, lavalink);
    return;
  } else if (interaction.commandName === 'skip') {
    await skip(interaction, lavalink.getPlayer(guild.id));
  } else if (interaction.commandName === 'stop') {
    await stop(interaction, lavalink.getPlayer(guild.id));
  } else if (interaction.commandName === 'queue') {
    await showQueue(interaction, lavalink.getPlayer(guild.id));
  } else if (interaction.commandName === 'nowplaying') {
    await nowPlaying(interaction, lavalink.getPlayer(guild.id));
  }
}

async function play(interaction: ChatInputCommandInteraction, lavalink: LavalinkManager): Promise<void> {
  const member = await interaction.guild!.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
    return;
  }

  const query = interaction.options.getString('query', true);
  await interaction.deferReply();
  const player = lavalink.createPlayer({
    guildId: interaction.guild!.id,
    voiceChannelId: voiceChannel.id,
    textChannelId: interaction.channelId,
    selfDeaf: true
  });
  await player.connect();
  const node = lavalink.nodeManager.leastUsedNodes('players')[0];
  if (!node) {
    await interaction.editReply('Lavalink is not connected yet. Try again shortly.');
    return;
  }
  const result = await node.search({ query, source: query.startsWith('http') ? undefined : 'ytsearch' }, interaction.user);
  const track = result.tracks[0];
  if (!track) {
    await interaction.editReply('No playable tracks found.');
    return;
  }
  await player.queue.add(track);
  if (!player.playing) await player.play({ paused: false });
  await interaction.editReply(`Queued: **${track.info.title}**`);
}

async function skip(interaction: ChatInputCommandInteraction, player: Player | undefined): Promise<void> {
  if (!player?.playing) { await interaction.reply('Nothing is playing.'); return; }
  await player.skip();
  await interaction.reply('Skipped.');
}

async function stop(interaction: ChatInputCommandInteraction, player: Player | undefined): Promise<void> {
  if (!player) { await interaction.reply('Nothing is playing.'); return; }
  await player.destroy();
  await interaction.reply('Playback stopped.');
}

async function showQueue(interaction: ChatInputCommandInteraction, player: Player | undefined): Promise<void> {
  const tracks = player?.queue.tracks ?? [];
  await interaction.reply(tracks.length ? tracks.slice(0, 10).map((track, i) => `${i + 1}. ${track.info.title}`).join('\n') : 'The queue is empty.');
}

async function nowPlaying(interaction: ChatInputCommandInteraction, player: Player | undefined): Promise<void> {
  const track = player?.queue.current;
  await interaction.reply(track ? `Now playing: **${track.info.title}**` : 'Nothing is playing.');
}
