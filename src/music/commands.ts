import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember
} from 'discord.js';
import type { LavalinkManager, Player, RepeatMode, SearchPlatform } from 'lavalink-client';
import { formatDuration, parseTimestamp, progressBar, trackLabel } from './format.js';
import { search } from './player.js';

const QUEUE_PAGE_SIZE = 10;

export const musicCommands = [
  new SlashCommandBuilder().setName('play').setDescription('Play a song, playlist or URL (YouTube, SoundCloud, Spotify...).')
    .addStringOption((o) => o.setName('query').setDescription('URL or search terms').setRequired(true))
    .addStringOption((o) => o.setName('source').setDescription('Where to search (default: YouTube, then SoundCloud)')
      .addChoices(
        { name: 'YouTube', value: 'ytsearch' },
        { name: 'YouTube Music', value: 'ytmsearch' },
        { name: 'SoundCloud', value: 'scsearch' },
        { name: 'Spotify', value: 'spsearch' }
      )),
  new SlashCommandBuilder().setName('pause').setDescription('Pause playback.'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume playback.'),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current track.'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop playback, clear the queue and leave.'),
  new SlashCommandBuilder().setName('queue').setDescription('Show the queue.')
    .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1)),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current track.'),
  new SlashCommandBuilder().setName('volume').setDescription('Set the volume.')
    .addIntegerOption((o) => o.setName('level').setDescription('0-150').setMinValue(0).setMaxValue(150).setRequired(true)),
  new SlashCommandBuilder().setName('seek').setDescription('Jump to a position in the current track.')
    .addStringOption((o) => o.setName('position').setDescription('e.g. 1:30 or 90').setRequired(true)),
  new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue.'),
  new SlashCommandBuilder().setName('loop').setDescription('Set the loop mode.')
    .addStringOption((o) => o.setName('mode').setDescription('What to repeat').setRequired(true)
      .addChoices({ name: 'Off', value: 'off' }, { name: 'Track', value: 'track' }, { name: 'Queue', value: 'queue' })),
  new SlashCommandBuilder().setName('remove').setDescription('Remove a track from the queue.')
    .addIntegerOption((o) => o.setName('position').setDescription('Position in /queue').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('Remove all upcoming tracks from the queue.')
];

const musicCommandNames = new Set(musicCommands.map((command) => command.name));

export function isMusicCommand(name: string): boolean {
  return musicCommandNames.has(name);
}

export async function handleMusicCommand(interaction: ChatInputCommandInteraction<'cached'>, lavalink: LavalinkManager): Promise<void> {
  if (interaction.commandName === 'play') {
    await play(interaction, lavalink);
    return;
  }
  if (interaction.commandName === 'queue') {
    await showQueue(interaction, lavalink.getPlayer(interaction.guildId));
    return;
  }
  if (interaction.commandName === 'nowplaying') {
    await nowPlaying(interaction, lavalink.getPlayer(interaction.guildId));
    return;
  }

  // Everything below changes playback, so the user must be listening with the bot.
  const player = lavalink.getPlayer(interaction.guildId);
  if (!player) {
    await reply(interaction, 'Nothing is playing.');
    return;
  }
  if (interaction.member.voice.channelId !== player.voiceChannelId) {
    await reply(interaction, 'Join my voice channel to control playback.');
    return;
  }

  switch (interaction.commandName) {
    case 'pause':
      if (player.paused) return reply(interaction, 'Already paused.');
      await player.pause();
      await interaction.reply('⏸️ Paused.');
      break;
    case 'resume':
      if (!player.paused) return reply(interaction, 'Not paused.');
      await player.resume();
      await interaction.reply('▶️ Resumed.');
      break;
    case 'skip': {
      const current = player.queue.current;
      if (!current) return reply(interaction, 'Nothing is playing.');
      // skip() refuses to skip the last track, so stop playback instead.
      if (player.queue.tracks.length) await player.skip();
      else await player.stopPlaying(false, false);
      await interaction.reply(`⏭️ Skipped **${current.info.title}**.`);
      break;
    }
    case 'stop':
      await player.destroy('Stopped by command');
      await interaction.reply('⏹️ Stopped and left the channel.');
      break;
    case 'volume': {
      const level = interaction.options.getInteger('level', true);
      await player.setVolume(level);
      await interaction.reply(`🔊 Volume set to ${level}%.`);
      break;
    }
    case 'seek': {
      const current = player.queue.current;
      const position = parseTimestamp(interaction.options.getString('position', true));
      if (!current || current.info.isStream || !current.info.isSeekable) return reply(interaction, 'This track cannot be seeked.');
      if (position === null || position > (current.info.duration ?? 0)) return reply(interaction, 'Give a position within the track, like `1:30`.');
      await player.seek(position);
      await interaction.reply(`⏩ Jumped to ${formatDuration(position)}.`);
      break;
    }
    case 'shuffle':
      if (player.queue.tracks.length < 2) return reply(interaction, 'Not enough tracks in the queue to shuffle.');
      await player.queue.shuffle();
      await interaction.reply('🔀 Queue shuffled.');
      break;
    case 'loop': {
      const mode = interaction.options.getString('mode', true) as RepeatMode;
      await player.setRepeatMode(mode);
      await interaction.reply(mode === 'off' ? '➡️ Looping off.' : `🔁 Looping the ${mode}.`);
      break;
    }
    case 'remove': {
      const position = interaction.options.getInteger('position', true);
      if (position > player.queue.tracks.length) return reply(interaction, `The queue only has ${player.queue.tracks.length} tracks.`);
      const removed = await player.queue.remove(position - 1);
      await interaction.reply(`🗑️ Removed **${removed?.removed[0]?.info.title ?? 'track'}**.`);
      break;
    }
    case 'clear':
      await player.queue.splice(0, player.queue.tracks.length);
      await interaction.reply('🧹 Queue cleared.');
      break;
  }
}

async function reply(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

async function play(interaction: ChatInputCommandInteraction<'cached'>, lavalink: LavalinkManager): Promise<void> {
  const member: GuildMember = interaction.member;
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) return reply(interaction, 'Join a voice channel first.');

  const existing = lavalink.getPlayer(interaction.guildId);
  if (existing?.voiceChannelId && existing.voiceChannelId !== voiceChannel.id) {
    return reply(interaction, `I'm already playing in <#${existing.voiceChannelId}>.`);
  }
  if (!lavalink.useable) return reply(interaction, 'The music server is not connected yet. Try again shortly.');

  await interaction.deferReply();
  const player = existing ?? lavalink.createPlayer({
    guildId: interaction.guildId,
    voiceChannelId: voiceChannel.id,
    textChannelId: interaction.channelId,
    selfDeaf: true,
    volume: 80
  });
  if (!player.connected) await player.connect();

  const query = interaction.options.getString('query', true);
  const source = interaction.options.getString('source') as SearchPlatform | null;
  const result = await search(player, query, interaction.user, source ?? undefined);
  if (!result) {
    await interaction.editReply('No playable tracks found.');
    if (!player.queue.current) await player.destroy('Nothing found');
    return;
  }

  if (result.loadType === 'playlist') {
    await player.queue.add(result.tracks);
    await interaction.editReply(`Queued **${result.tracks.length}** tracks from **${result.playlist?.name ?? 'playlist'}**.`);
  } else {
    const track = result.tracks[0]!;
    await player.queue.add(track);
    const position = player.queue.current ? player.queue.tracks.length : 0;
    await interaction.editReply(position > 0 ? `Queued at #${position}: ${trackLabel(track)}` : `Starting: ${trackLabel(track)}`);
  }

  if (!player.playing && !player.paused) await player.play({ paused: false });
}

async function showQueue(interaction: ChatInputCommandInteraction, player: Player | undefined): Promise<void> {
  const current = player?.queue.current;
  if (!player || !current) return reply(interaction, 'The queue is empty.');

  const tracks = player.queue.tracks;
  const pages = Math.max(1, Math.ceil(tracks.length / QUEUE_PAGE_SIZE));
  const page = Math.min(interaction.options.getInteger('page') ?? 1, pages);
  const start = (page - 1) * QUEUE_PAGE_SIZE;
  const lines = tracks.slice(start, start + QUEUE_PAGE_SIZE).map((track, i) => `\`${start + i + 1}.\` ${trackLabel(track)}`);
  const total = tracks.reduce((sum, track) => sum + (track.info.duration ?? 0), 0);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Queue')
    .setDescription(`**Now:** ${trackLabel(current)}\n\n${lines.join('\n') || '*Nothing queued after this track.*'}`)
    .setFooter({ text: `Page ${page}/${pages} · ${tracks.length} upcoming · ${formatDuration(total)} · loop: ${player.repeatMode}` });
  await interaction.reply({ embeds: [embed] });
}

async function nowPlaying(interaction: ChatInputCommandInteraction, player: Player | undefined): Promise<void> {
  const track = player?.queue.current;
  if (!player || !track) return reply(interaction, 'Nothing is playing.');

  const duration = track.info.duration ?? 0;
  const timing = track.info.isStream
    ? '🔴 Live'
    : `${progressBar(player.position, duration)} \`${formatDuration(player.position)} / ${formatDuration(duration)}\``;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: player.paused ? 'Paused' : 'Now playing' })
    .setDescription(`${trackLabel(track)}\n\n${timing}`)
    .setThumbnail(track.info.artworkUrl ?? null)
    .setFooter({ text: `Volume ${player.volume}% · loop: ${player.repeatMode} · ${player.queue.tracks.length} upcoming` });
  await interaction.reply({ embeds: [embed] });
}
