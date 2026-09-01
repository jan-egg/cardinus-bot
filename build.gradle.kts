plugins {
    id("java")
    id("application")
    // Fat-jar for deployment — see note below.
    // id("com.gradleup.shadow") version "x.y.z"   // ⚠ VERIFY current version
}

group = "gg.cardinus"
version = "1.0.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

repositories {
    mavenCentral()
    maven("https://maven.lavalink.dev/releases") // youtube-source lives here
}

dependencies {
    // Discord — 6.x is required for working voice (DAVE protocol, see below)
    implementation("net.dv8tion:JDA:6.5.0")             // ⚠ VERIFY latest 6.x

    // Audio
    implementation("dev.arbjerg:lavaplayer:2.2.6")      // ⚠ VERIFY latest 2.2.x
    implementation("dev.lavalink.youtube:v2:1.13.0")    // ⚠ VERIFY latest

    // Logging (yours — fine as-is)
    implementation("org.slf4j:slf4j-api:2.0.9")
    implementation("ch.qos.logback:logback-classic:1.4.11")

    // Configuration (yours — fine as-is)
    implementation("com.google.guava:guava:32.1.3-jre")
    implementation("io.github.cdimascio:dotenv-java:3.0.0")
}

application {
    mainClass.set("gg.cardinus.bot.core.Cardinus")
}