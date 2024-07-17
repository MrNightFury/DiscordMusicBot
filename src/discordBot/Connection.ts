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
    // mixer?: PassThrough;
    resource?: AudioResource;
    // mixer: Mixer;
    pipeMode?: PipeMode;
    // pipeModeSound?: string;
}