import { AudioResource, VoiceConnection } from "@discordjs/voice";
import { SendableChannels, TextBasedChannel } from "discord.js";
import { VoiceAudioPlayer } from "./VoiceAudioPlayer.ts";


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
    aloneDisconnectTimer?: NodeJS.Timeout;
    lastCommandChannel?: SendableChannels;
}
