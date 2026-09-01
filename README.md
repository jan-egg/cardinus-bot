# Cardinus Bot

A multipurpose Discord bot written in Java with JDA and Gradle.

## Project Structure

```
src/main/java/gg/cardinus/bot/
├── core/        - Bot bootstrap (Cardinus), SlashCommand interface, CommandRegistry
├── commands/    - Command implementations (e.g., PingCommand)
├── config/      - Configuration management (Config class)
└── music/       - Placeholder for future music features
```

## Requirements

- **Java**: 17 or higher
- **Gradle**: 7.x or higher (included via Gradle Wrapper)

## Setup

### 1. Configure Bot Token

**Recommended: Using .env file**

Copy the example environment file:
```bash
cp .env.example .env
```

Then edit `.env` and add your Discord bot token:
```
BOT_TOKEN=YOUR_TOKEN_HERE
```

**Alternative: Using config.properties**

Copy the example configuration file:
```bash
cp src/main/resources/config.example.properties config.properties
```

Then edit `config.properties` and add your Discord bot token:
```properties
bot.token=YOUR_TOKEN_HERE
```

**Alternative: Using environment variable**

Set the `BOT_TOKEN` environment variable:
```bash
# Linux/macOS
export BOT_TOKEN=your_token_here

# Windows (PowerShell)
$env:BOT_TOKEN="your_token_here"

# Windows (CMD)
set BOT_TOKEN=your_token_here
```

### 2. Get Your Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot user
4. Copy the bot token (keep it secret!)
5. Enable "Message Content Intent" under Privileged Gateway Intents

## Build

```bash
# Build the project
./gradlew build

# On Windows
gradlew.bat build
```

## Run

```bash
# Run using Gradle
./gradlew run

# On Windows
gradlew.bat run
```

The bot will start and register slash commands. By default, commands are registered as guild commands for faster testing.

## Adding Commands

To add a new slash command:

1. Create a new class in `src/main/java/gg/cardinus/bot/commands/`
2. Implement the `SlashCommand` interface
3. Register it in `Cardinus.registerCommands()`:

```java
commandRegistry.register(new YourCommand());
```

Example:
```java
public class HelloCommand implements SlashCommand {
    @Override
    public String getName() {
        return "hello";
    }
    
    @Override
    public String getDescription() {
        return "Say hello";
    }
    
    @Override
    public SlashCommandData getCommandData() {
        return Commands.slash(getName(), getDescription());
    }
    
    @Override
    public void execute(SlashCommandInteractionEvent event) {
        event.reply("Hello, " + event.getUser().getAsTag() + "!").queue();
    }
}
```

## Production Deployment

**TODO**: For production, switch slash command registration from guild to global:
- In `Cardinus.java`, set `GUILD_ID = null`
- Global commands take up to 1 hour to propagate across Discord

## Dependencies

- **JDA** 5.x - Java Discord API library
- **SLF4J & Logback** - Logging framework
- **Guava** - Utility library

## License

MIT