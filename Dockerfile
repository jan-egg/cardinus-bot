FROM gradle:8.10-jdk17 AS build

WORKDIR /app

COPY gradlew gradlew.bat settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle ./gradle
RUN chmod +x gradlew

COPY src ./src
RUN ./gradlew installDist --no-daemon

FROM eclipse-temurin:17-jre

WORKDIR /app

RUN useradd --system --uid 10001 --create-home cardinus
COPY --from=build /app/build/install/cardinus-bot ./
RUN chown -R cardinus:cardinus /app

USER cardinus

ENTRYPOINT ["/app/bin/cardinus-bot"]