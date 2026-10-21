FROM ghcr.io/lavalink-devs/lavalink:4

USER root
ADD https://github.com/lavalink-devs/youtube-source/releases/download/1.18.2/youtube-plugin-1.18.2.jar /opt/Lavalink/plugins/youtube-plugin.jar
ADD https://github.com/topi314/LavaSrc/releases/download/4.8.3/lavasrc-plugin-4.8.3.jar /opt/Lavalink/plugins/lavasrc-plugin.jar
RUN chmod 644 /opt/Lavalink/plugins/*.jar
USER lavalink
