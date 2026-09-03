FROM ghcr.io/lavalink-devs/lavalink:4

USER root
ADD https://github.com/lavalink-devs/youtube-source/releases/download/1.18.2/youtube-plugin-1.18.2.jar /opt/Lavalink/plugins/youtube-plugin.jar
RUN chmod 644 /opt/Lavalink/plugins/youtube-plugin.jar
USER lavalink