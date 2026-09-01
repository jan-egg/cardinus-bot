package gg.cardinus.bot.core;

import net.dv8tion.jda.api.interactions.commands.build.SlashCommandData;

/**
 * Interface for slash commands in Cardinus Bot.
 * All slash commands must implement this interface.
 */
public interface SlashCommand {
    /**
     * Gets the name of this slash command.
     * 
     * @return The command name (e.g., "ping")
     */
    String getName();
    
    /**
     * Gets the description of this slash command.
     * 
     * @return The command description
     */
    String getDescription();
    
    /**
     * Gets the slash command data for registration with Discord.
     * 
     * @return The SlashCommandData
     */
    SlashCommandData getCommandData();
    
    /**
     * Executes the slash command.
     * 
     * @param event The interaction event
     */
    void execute(net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent event);
}
