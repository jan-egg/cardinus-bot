import { escapeMarkdown } from 'discord.js';
import type { Track, UnresolvedTrack } from 'lavalink-client';

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Parses "90", "1:30" or "1:02:03" into milliseconds. */
export function parseTimestamp(input: string): number | null {
  const parts = input.trim().split(':');
  if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  return parts.reduce((total, part) => total * 60 + Number(part), 0) * 1000;
}

export function trackLabel(track: Track | UnresolvedTrack): string {
  const title = escapeMarkdown(track.info.title ?? 'Unknown title');
  const linked = track.info.uri ? `[${title}](${track.info.uri})` : `**${title}**`;
  const length = track.info.isStream ? 'live' : formatDuration(track.info.duration ?? 0);
  return `${linked} · ${escapeMarkdown(track.info.author ?? 'Unknown')} · \`${length}\``;
}

export function progressBar(position: number, duration: number, width = 16): string {
  const filled = duration > 0 ? Math.min(width, Math.round((position / duration) * width)) : 0;
  return `${'▬'.repeat(filled)}🔘${'▬'.repeat(width - filled)}`;
}
