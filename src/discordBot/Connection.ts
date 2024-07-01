import { AudioPlayer, VoiceConnection } from "@discordjs/voice";

export interface Connection {
    guildId: string;
    player: AudioPlayer;
    connection: VoiceConnection;
}