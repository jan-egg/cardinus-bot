# Cardinus Bot

A multipurpose Discord bot built in Java using the JDA library.

## Features

- Slash command support
- Extensible command architecture
- Environment-based configuration
- Structured logging
- Planned music playback features

## Prerequisites

- Java 17 or higher
- Gradle 7.x or higher (bundled)

## Installation

### 1. Create your Discord bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to the "Bot" section and create a bot user
4. Copy the bot token and save it
5. Under "Privileged Gateway Intents", enable the required intents

### 2. Configure the application

Copy the environment template and add your bot token:

```bash
cp .env.example .env
```

Edit `.env`:
```
BOT_TOKEN=your_token_here
```

Alternatively, you can:
- Set the `BOT_TOKEN` environment variable
- Use `config.properties` (see `src/main/resources/config.example.properties`)

## Building

```bash
./gradlew build
```

## Running

```bash
./gradlew run
```

The bot will register slash commands and connect to Discord.

## Project Structure

```
src/main/java/gg/cardinus/bot/
├── core/        Core bot logic, command interface, and registry
├── commands/    Command implementations
├── config/      Configuration and environment loading
└── music/       Music features (future)
```

## Development

### Adding a Command

Create a new class implementing `SlashCommand`:

```java
public class MyCommand implements SlashCommand {
    @Override
    public String getName() {
        return "mycommand";
    }
    
    @Override
    public String getDescription() {
        return "My command description";
    }
    
    @Override
    public SlashCommandData getCommandData() {
        return Commands.slash(getName(), getDescription());
    }
    
    @Override
    public void execute(SlashCommandInteractionEvent event) {
        event.reply("Response").queue();
    }
}
```

Register it in `Cardinus.registerCommands()`:

```java
commandRegistry.register(new MyCommand());
```

### Command Registration

Commands are registered as guild commands for faster testing. For production, set `GUILD_ID = null` in `Cardinus.java` to register globally (note: global commands take ~1 hour to propagate).

## Architecture

- **SlashCommand Interface** - Defines the contract for all commands
- **CommandRegistry** - Central command registration and lookup
- **Config** - Loads configuration from `.env`, environment variables, or `config.properties`
- **Cardinus** - Main entry point and event listener

## Dependencies

- JDA 5.x - Discord API wrapper
- Logback & SLF4J - Logging
- dotenv-java - Environment variable loading

## License

MIT