// gg/cardinus/bot/commands/PlayCommand.java
package gg.cardinus.bot.commands;

import gg.cardinus.bot.core.SlashCommand;
import gg.cardinus.bot.music.GuildMusicManager;
import gg.cardinus.bot.music.PlayerManager;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.GuildVoiceState;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.channel.middleman.AudioChannel;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.OptionType;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.interactions.commands.build.SlashCommandData;
import net.dv8tion.jda.api.managers.AudioManager;

public class PlayCommand implements SlashCommand {

    @Override
    public String getName() {
        return "play";
    }

    @Override
    public String getDescription() {
        return "Play a track from YouTube (URL or search terms)";
    }

    @Override
    public SlashCommandData getCommandData() {
        return Commands.slash(getName(), getDescription())
                .addOption(OptionType.STRING, "query", "A YouTube URL or search terms", true);
    }

    @Override
    public void execute(SlashCommandInteractionEvent event) {
        Guild guild = event.getGuild();
        if (guild == null) {
            event.reply("This command only works in a server.").setEphemeral(true).queue();
            return;
        }

        Member member = event.getMember();
        GuildVoiceState memberState = member.getVoiceState();
        if (memberState == null || !memberState.inAudioChannel()) {
            event.reply("You need to be in a voice channel first.").setEphemeral(true).queue();
            return;
        }

        String input = event.getOption("query").getAsString();
        String query = input.startsWith("http://") || input.startsWith("https://")
            ? input
            : "ytsearch:" + input; // bare words → YouTube search

        event.deferReply().queue(hook -> {
            hook.editOriginal("Searching...").queue();

            AudioChannel channel = memberState.getChannel();
            AudioManager audioManager = guild.getAudioManager();
            GuildMusicManager musicManager = PlayerManager.get().getGuildMusicManager(guild);
            audioManager.setSendingHandler(musicManager.sendHandler);
            audioManager.openAudioConnection(channel);

            PlayerManager.get().loadAndPlay(event, query);
        });
    }
}