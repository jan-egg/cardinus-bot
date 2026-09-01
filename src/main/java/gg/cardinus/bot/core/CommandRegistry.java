package gg.cardinus.bot.core;

import java.util.HashMap;
import java.util.Map;
import net.dv8tion.jda.api.JDA;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Registry for slash commands.
 * Manages registration and lookup of slash commands.
 */
public class CommandRegistry {
    private static final Logger logger = LoggerFactory.getLogger(CommandRegistry.class);
    private final Map<String, SlashCommand> commands = new HashMap<>();
    
    /**
     * Registers a slash command.
     * 
     * @param command The slash command to register
     */
    public void register(SlashCommand command) {
        commands.put(command.getName(), command);
        logger.debug("Registered slash command: {}", command.getName());
    }
    
    /**
     * Gets a registered slash command by name.
     * 
     * @param name The command name
     * @return The SlashCommand, or null if not found
     */
    public SlashCommand get(String name) {
        return commands.get(name);
    }
    
    /**
     * Registers all commands with a JDA instance.
     * Uses guild commands for fast testing.
     * 
     * TODO: Switch to global commands for production deployment
     * Global commands take up to 1 hour to register across Discord
     * 
     * @param jda The JDA instance
     * @param guildId The guild ID for command registration (or null for global)
     */
    public void registerWithJDA(JDA jda, String guildId) {
        var commandData = commands.values()
            .stream()
            .map(SlashCommand::getCommandData)
            .toList();
        
        if (guildId != null) {
            jda.getGuildById(guildId)
                .updateCommands()
                .addCommands(commandData)
                .queue(
                    success -> logger.info("Registered {} slash commands in guild", success.size()),
                    error -> logger.error("Failed to register slash commands", error)
                );
        } else {
            jda.updateCommands()
                .addCommands(commandData)
                .queue(
                    success -> logger.info("Registered {} global slash commands", success.size()),
                    error -> logger.error("Failed to register global slash commands", error)
                );
        }
    }
    
    /**
     * Gets the number of registered commands.
     * 
     * @return The command count
     */
    public int size() {
        return commands.size();
    }
}
