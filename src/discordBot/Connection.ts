import { AudioResource, VoiceConnection } from "@discordjs/voice";

import { VoiceAudioPlayer } from "./VoiceAudioPlayer";


export interface PipeMode {
    sound: string,
    timer: NodeJS.Timeout
}

export interface Connection {
    guildId: string;
    player: VoiceAudioPlayer;
    connection: VoiceConnection;
    resource?: AudioResource;
    pipeMode?: PipeMode;
}