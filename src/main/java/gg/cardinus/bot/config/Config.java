package gg.cardinus.bot.config;

import io.github.cdimascio.dotenv.Dotenv;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Configuration loader for Cardinus Bot.
 * Loads bot token from .env file, environment variable BOT_TOKEN, or config.properties file.
 */
public class Config {
    private static final Logger logger = LoggerFactory.getLogger(Config.class);
    private static final String BOT_TOKEN_ENV = "BOT_TOKEN";
    private static final String ENV_FILE = ".env";
    private static final String CONFIG_FILE = "config.properties";
    
    private final String botToken;
    
    public Config() {
        this.botToken = loadBotToken();
    }
    
    /**
     * Loads the bot token from .env file, environment variable, or config.properties file.
     * 
     * @return The bot token
     * @throws IllegalStateException if token cannot be found
     */
    private String loadBotToken() {
        // Try .env file first
        Path envPath = Paths.get(ENV_FILE);
        if (Files.exists(envPath)) {
            try {
                Dotenv dotenv = Dotenv.load();
                String token = dotenv.get(BOT_TOKEN_ENV);
                if (token != null && !token.isBlank()) {
                    logger.info("Loaded bot token from {}", ENV_FILE);
                    return token;
                }
            } catch (Exception e) {
                logger.warn("Failed to read {}: {}", ENV_FILE, e.getMessage());
            }
        }
        
        // Try environment variable
        String envToken = System.getenv(BOT_TOKEN_ENV);
        if (envToken != null && !envToken.isBlank()) {
            logger.info("Loaded bot token from environment variable {}", BOT_TOKEN_ENV);
            return envToken;
        }
        
        // Try config.properties file
        Path configPath = Paths.get(CONFIG_FILE);
        if (Files.exists(configPath)) {
            Properties props = new Properties();
            try (FileInputStream fis = new FileInputStream(configPath.toFile())) {
                props.load(fis);
                String token = props.getProperty("bot.token", "").trim();
                if (!token.isBlank()) {
                    logger.info("Loaded bot token from {}", CONFIG_FILE);
                    return token;
                }
            } catch (IOException e) {
                logger.warn("Failed to read {}: {}", CONFIG_FILE, e.getMessage());
            }
        }
        
        // Suggest .env file
        logger.info("Note: {} not found. Copy .env.example to {} and add your bot token", 
                   ENV_FILE, ENV_FILE);
        
        throw new IllegalStateException(
            "Bot token not found. Create .env file with BOT_TOKEN, set BOT_TOKEN environment variable, or create config.properties file."
        );
    }
    
    public String getBotToken() {
        return botToken;
    }
}
