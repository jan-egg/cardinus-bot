package gg.cardinus.bot.core;

import gg.cardinus.bot.commands.PingCommand;
import gg.cardinus.bot.commands.PlayCommand;
import gg.cardinus.bot.config.Config;
import moe.kyokobot.libdave.NativeDaveFactory;
import moe.kyokobot.libdave.jda.LDJDADaveSessionFactory;
import net.dv8tion.jda.api.JDABuilder;
import net.dv8tion.jda.api.audio.AudioModuleConfig;
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
        commandRegistry.register(new PlayCommand());
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
            .enableIntents(GatewayIntent.GUILD_VOICE_STATES) // needed to see who's in a voice channel
            .setAudioModuleConfig(new AudioModuleConfig()
                .withDaveSessionFactory(new LDJDADaveSessionFactory(new NativeDaveFactory())))
            .setActivity(Activity.playing("music in Cardinus"))
            .addEventListeners(this)
            .build();

        jda.awaitReady();
        logger.info("Bot is ready!");

        // Register slash commands with JDA.
        // GUILD_ID set = instant registration in that server; null = global (slow).
        commandRegistry.registerWithJDA(jda, config.getGuildId());
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