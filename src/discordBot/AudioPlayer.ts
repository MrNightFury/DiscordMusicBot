import { createAudioResource } from "@discordjs/voice";
import { Bot } from "./DiscordBot";

export class AudioPlayer {
    bot: Bot;
    constructor(bot: Bot) {
        this.bot = bot;
    }

    playSound(guildId: string, sound: string): boolean {
        let connection = this.bot.connections.get(guildId || "");
        if (!connection) {
            return false;
        }

        console.log("Playing sound " + `${sound}.mp3`);
        let resourse = createAudioResource(`./storage/${sound}.mp3`);
        // resourse.volume?.setVolume(1);
        connection.player.play(resourse);
        return true;
    }
}