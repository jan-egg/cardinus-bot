import { InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import type { LavalinkManager } from 'lavalink-client';
import { dndCommands, handleDndCommand, isDndCommand } from './dnd/commands.js';
import { handleMusicCommand, isMusicCommand, musicCommands } from './music/commands.js';

export const commandDefinitions = [
  { name: 'ping', description: 'Check whether the bot is responding.' },
  ...[...musicCommands, ...dndCommands].map((command) => command.setContexts(InteractionContextType.Guild).toJSON())
];

export async function handleCommand(interaction: ChatInputCommandInteraction, lavalink: LavalinkManager): Promise<void> {
  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
    return;
  }
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (isMusicCommand(interaction.commandName)) await handleMusicCommand(interaction, lavalink);
  else if (isDndCommand(interaction.commandName)) await handleDndCommand(interaction);
}
