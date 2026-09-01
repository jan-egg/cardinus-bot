// gg/cardinus/bot/music/PlayerManager.java
package gg.cardinus.bot.music;

import com.sedmelluq.discord.lavaplayer.player.AudioLoadResultHandler;
import com.sedmelluq.discord.lavaplayer.player.AudioPlayerManager;
import com.sedmelluq.discord.lavaplayer.player.DefaultAudioPlayerManager;
import com.sedmelluq.discord.lavaplayer.source.AudioSourceManagers;
import com.sedmelluq.discord.lavaplayer.tools.FriendlyException;
import com.sedmelluq.discord.lavaplayer.track.AudioPlaylist;
import com.sedmelluq.discord.lavaplayer.track.AudioTrack;
import dev.lavalink.youtube.YoutubeAudioSourceManager;
import dev.lavalink.youtube.clients.AndroidVrWithThumbnail;
import dev.lavalink.youtube.clients.MWebWithThumbnail;
import dev.lavalink.youtube.clients.MusicWithThumbnail;
import dev.lavalink.youtube.clients.Tv;
import dev.lavalink.youtube.clients.TvHtml5SimplyWithThumbnail;
import dev.lavalink.youtube.clients.WebWithThumbnail;
import dev.lavalink.youtube.clients.skeleton.Client;
import io.github.cdimascio.dotenv.Dotenv;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class PlayerManager {
    private static PlayerManager INSTANCE;

    private final AudioPlayerManager audioPlayerManager;
    private final Map<Long, GuildMusicManager> musicManagers = new ConcurrentHashMap<>();

    public PlayerManager() {
        this.audioPlayerManager = new DefaultAudioPlayerManager();

        // Register youtube-source MANUALLY. Do NOT call registerRemoteSources() —
        // that would pull in LavaPlayer's dead built-in YouTube source.
        YoutubeAudioSourceManager youtube = new YoutubeAudioSourceManager(true, new Client[] {
            new MusicWithThumbnail(),
            new AndroidVrWithThumbnail(),
            new MWebWithThumbnail(),
            new WebWithThumbnail(),
            new Tv(),
            new TvHtml5SimplyWithThumbnail()
        });
        String refreshToken = Dotenv.configure().ignoreIfMissing().load()
            .get("YOUTUBE_OAUTH_REFRESH_TOKEN");
        youtube.useOauth2(refreshToken, refreshToken != null && !refreshToken.isBlank());

        audioPlayerManager.registerSourceManager(youtube);
        AudioSourceManagers.registerLocalSource(audioPlayerManager); // optional: local files
    }

    public GuildMusicManager getGuildMusicManager(Guild guild) {
        return musicManagers.computeIfAbsent(
                guild.getIdLong(),
                id -> new GuildMusicManager(audioPlayerManager));
    }

    public void loadAndPlay(SlashCommandInteractionEvent event, String query) {
        GuildMusicManager musicManager = getGuildMusicManager(event.getGuild());

        audioPlayerManager.loadItem(query, new AudioLoadResultHandler() {
            @Override
            public void trackLoaded(AudioTrack track) {
                musicManager.scheduler.queue(track);
                event.getHook().editOriginal("Queued: **" + track.getInfo().title + "**").queue();
            }

            @Override
            public void playlistLoaded(AudioPlaylist playlist) {
                if (playlist.isSearchResult()) {
                    AudioTrack first = playlist.getTracks().get(0);
                    musicManager.scheduler.queue(first);
                    event.getHook().editOriginal("Queued: **" + first.getInfo().title + "**").queue();
                } else {
                    playlist.getTracks().forEach(musicManager.scheduler::queue);
                    event.getHook().editOriginal("Queued **" + playlist.getTracks().size()
                            + "** tracks from *" + playlist.getName() + "*").queue();
                }
            }

            @Override
            public void noMatches() {
                event.getHook().editOriginal("Nothing found for: `" + query + "`").queue();
            }

            @Override
            public void loadFailed(FriendlyException e) {
                event.getHook().editOriginal("Couldn't play that: " + e.getMessage()).queue();
            }
        });
    }

    public static PlayerManager get() {
        if (INSTANCE == null) {
            INSTANCE = new PlayerManager();
        }
        return INSTANCE;
    }
}