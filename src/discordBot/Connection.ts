import { AudioPlayer, AudioResource, VoiceConnection } from "@discordjs/voice";
import { Mixer } from "audio-mixer";
import { PassThrough } from "stream";

export interface Connection {
    guildId: string;
    player: AudioPlayer;
    connection: VoiceConnection;
    // mixer?: PassThrough;
    resource?: AudioResource;
    mixer: Mixer;
}