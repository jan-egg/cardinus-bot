// gg/cardinus/bot/music/TrackScheduler.java
package gg.cardinus.bot.music;

import com.sedmelluq.discord.lavaplayer.player.AudioPlayer;
import com.sedmelluq.discord.lavaplayer.player.event.AudioEventAdapter;
import com.sedmelluq.discord.lavaplayer.track.AudioTrack;
import com.sedmelluq.discord.lavaplayer.track.AudioTrackEndReason;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

public class TrackScheduler extends AudioEventAdapter {
    private final AudioPlayer player;
    private final BlockingQueue<AudioTrack> queue = new LinkedBlockingQueue<>();

    public TrackScheduler(AudioPlayer player) {
        this.player = player;
    }

    public void queue(AudioTrack track) {
        // startTrack(..., true) = "noInterrupt": returns false if something's already playing
        if (!player.startTrack(track, true)) {
            queue.offer(track);
        }
    }

    public boolean nextTrack() {
        AudioTrack next = queue.poll();
        player.startTrack(next, false); // null just stops playback
        return next != null;
    }

    public BlockingQueue<AudioTrack> getQueue() {
        return queue;
    }

    @Override
    public void onTrackEnd(AudioPlayer player, AudioTrack track, AudioTrackEndReason endReason) {
        if (endReason.mayStartNext) {
            nextTrack();
        }
    }
}