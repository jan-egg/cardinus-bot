package gg.cardinus.bot.core;

import gg.cardinus.bot.commands.PingCommand;
import gg.cardinus.bot.config.Config;
import net.dv8tion.jda.api.JDABuilder;
import net.dv8tion.jda.api.entities.Activity;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import net.dv8tion.jda.api.requests.GatewayIntent;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Main bot class for Cardinus Discord Bot.
 * Initializes JDA and registers event listeners.
 */
public class Cardinus extends ListenerAdapter {
    private static final Logger logger = LoggerFactory.getLogger(Cardinus.class);
    private static final String GUILD_ID = null; // TODO: Set to your test guild ID for faster command registration
    
    private final CommandRegistry commandRegistry;
    
    public Cardinus() {
        this.commandRegistry = new CommandRegistry();
        registerCommands();
    }
    
    /**
     * Registers all slash commands.
     */
    private void registerCommands() {
        commandRegistry.register(new PingCommand());
        // Add more commands here as the bot grows
    }
    
    /**
     * Handles slash command interactions.
     * 
     * @param event The slash command event
     */
    @Override
    public void onSlashCommandInteraction(@NotNull SlashCommandInteractionEvent event) {
        String commandName = event.getName();
        SlashCommand command = commandRegistry.get(commandName);
        
        if (command != null) {
            try {
                command.execute(event);
                logger.debug("Executed command: {}", commandName);
            } catch (Exception e) {
                logger.error("Error executing command: {}", commandName, e);
                event.reply("An error occurred executing this command.").setEphemeral(true).queue();
            }
        } else {
            logger.warn("Unknown command: {}", commandName);
            event.reply("Unknown command.").setEphemeral(true).queue();
        }
    }
    
    /**
     * Starts the bot.
     * 
     * @throws InterruptedException if the bot is interrupted
     */
    public void start() throws InterruptedException {
        Config config = new Config();
        
        var jda = JDABuilder.createDefault(config.getBotToken())
            .enableIntents(GatewayIntent.DIRECT_MESSAGE_REACTIONS)
            .setActivity(Activity.playing("slash commands"))
            .addEventListeners(this)
            .build();
        
        jda.awaitReady();
        logger.info("Bot is ready!");
        
        // Register slash commands with JDA
        // TODO: Set GUILD_ID to your test server for faster command registration
        // For production, set to null to register globally
        commandRegistry.registerWithJDA(jda, GUILD_ID);
    }
    
    /**
     * Entry point for the bot.
     */
    public static void main(String[] args) {
        try {
            logger.info("Starting Cardinus Bot...");
            Cardinus bot = new Cardinus();
            bot.start();
        } catch (InterruptedException e) {
            logger.error("Bot was interrupted", e);
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            logger.error("Failed to start bot", e);
            System.exit(1);
        }
    }
}
