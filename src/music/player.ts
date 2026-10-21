import { EmbedBuilder, type Client, type SendableChannels } from 'discord.js';
import type { LavalinkManager, Player, SearchPlatform, Track, UnresolvedTrack } from 'lavalink-client';
import { trackLabel } from './format.js';

/** Search sources tried in order when a plain query (not a URL) finds nothing. */
const SEARCH_FALLBACKS: SearchPlatform[] = ['ytsearch', 'scsearch'];

/** How long the bot stays in a voice channel with no listeners. */
const EMPTY_CHANNEL_TIMEOUT_MS = 60_000;

export async function search(
  player: Player,
  query: string,
  requester: unknown,
  preferred?: SearchPlatform
): Promise<Awaited<ReturnType<Player['search']>> | undefined> {
  if (/^https?:\/\//.test(query)) {
    const result = await player.search({ query }, requester);
    return result.tracks.length ? result : undefined;
  }

  const sources = preferred ? [preferred, ...SEARCH_FALLBACKS.filter((s) => s !== preferred)] : SEARCH_FALLBACKS;
  for (const source of sources) {
    try {
      const result = await player.search({ query, source }, requester);
      if (result.tracks.length) return result;
    } catch (error) {
      console.warn(`Search on ${source} failed:`, (error as Error).message);
    }
  }
  return undefined;
}

async function textChannel(client: Client, player: Player): Promise<SendableChannels | undefined> {
  if (!player.textChannelId) return undefined;
  const channel = await client.channels.fetch(player.textChannelId).catch(() => null);
  return channel?.isSendable() ? channel : undefined;
}

/**
 * When a track fails to load (usually YouTube blocking playback), look for the same song on
 * SoundCloud and queue it next, so one broken video does not silently drop the song.
 */
async function queueFallback(client: Client, player: Player, track: Track | UnresolvedTrack): Promise<void> {
  const channel = await textChannel(client, player);
  if (track.info.sourceName === 'soundcloud') {
    await channel?.send(`Couldn't play **${track.info.title}**, skipping it.`);
    return;
  }

  const query = `${track.info.author} ${track.info.title}`;
  const result = await player.search({ query, source: 'scsearch' }, track.requester).catch(() => undefined);
  const fallback = result?.tracks[0];
  if (!fallback) {
    await channel?.send(`Couldn't play **${track.info.title}** and found no alternative, skipping it.`);
    return;
  }

  await player.queue.add(fallback, 0);
  if (!player.playing) await player.play({ paused: false });
  await channel?.send(`Couldn't play **${track.info.title}** from ${track.info.sourceName}; trying SoundCloud instead.`);
}

export function registerPlayerEvents(client: Client, lavalink: LavalinkManager): void {
  lavalink.on('trackStart', async (player, track) => {
    if (!track) return;
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: 'Now playing' })
      .setDescription(trackLabel(track))
      .setThumbnail(track.info.artworkUrl ?? null);
    await (await textChannel(client, player))?.send({ embeds: [embed] }).catch(() => undefined);
  });

  lavalink.on('trackError', (player, track, payload) => {
    console.warn(`Track failed in guild ${player.guildId}:`, payload.exception?.message);
    if (track) void queueFallback(client, player, track).catch((error) => console.error('Fallback failed:', error));
  });

  lavalink.on('trackStuck', (player, track) => {
    console.warn(`Track stuck in guild ${player.guildId}: ${track?.info.title}`);
  });

  lavalink.on('queueEnd', async (player) => {
    await (await textChannel(client, player))?.send('Queue finished.').catch(() => undefined);
  });

  // Leave when everyone else has left the voice channel.
  const leaveTimers = new Map<string, NodeJS.Timeout>();
  client.on('voiceStateUpdate', (oldState, newState) => {
    const guildId = newState.guild.id;
    const player = lavalink.getPlayer(guildId);
    if (!player?.voiceChannelId) return;
    if (oldState.channelId !== player.voiceChannelId && newState.channelId !== player.voiceChannelId) return;

    const channel = newState.guild.channels.cache.get(player.voiceChannelId);
    const listeners = channel?.isVoiceBased() ? channel.members.filter((member) => !member.user.bot).size : 0;
    const pending = leaveTimers.get(guildId);
    if (listeners > 0) {
      if (pending) clearTimeout(pending);
      leaveTimers.delete(guildId);
    } else if (!pending) {
      leaveTimers.set(guildId, setTimeout(() => {
        leaveTimers.delete(guildId);
        void lavalink.getPlayer(guildId)?.destroy('Voice channel empty');
      }, EMPTY_CHANNEL_TIMEOUT_MS));
    }
  });
}
