package gg.cardinus.bot.commands;

import gg.cardinus.bot.core.SlashCommand;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.interactions.commands.build.SlashCommandData;

/**
 * Example ping command that responds with "Pong!".
 */
public class PingCommand implements SlashCommand {
    
    @Override
    public String getName() {
        return "ping";
    }
    
    @Override
    public String getDescription() {
        return "Ping the bot";
    }
    
    @Override
    public SlashCommandData getCommandData() {
        return Commands.slash(getName(), getDescription());
    }
    
    @Override
    public void execute(SlashCommandInteractionEvent event) {
        event.reply("Pong!").queue();
    }
}
