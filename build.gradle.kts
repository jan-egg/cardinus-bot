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
    maven("https://maven.lavalink.dev/snapshots") // Java 17-compatible libdave-jvm
}

dependencies {
    // Discord — 6.x is required for working voice (DAVE protocol, see below)
    implementation("net.dv8tion:JDA:6.5.0")             // ⚠ VERIFY latest 6.x

    // Audio
    implementation("dev.arbjerg:lavaplayer:2.2.6")      // ⚠ VERIFY latest 2.2.x
    implementation("dev.lavalink.youtube:v2:1.18.2")
    implementation("moe.kyokobot.libdave:adapter-jda:ce725965e")
    implementation("moe.kyokobot.libdave:impl-jni:ce725965e")
    runtimeOnly("moe.kyokobot.libdave:natives-win-x86-64:ce725965e")
    runtimeOnly("moe.kyokobot.libdave:natives-linux-x86-64:ce725965e")

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