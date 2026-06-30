import { AudioPlayer, AudioPlayerStatus, VoiceConnection, createAudioPlayer, createAudioResource } from "@discordjs/voice";
import { } from "discord.js";
import fs from "node:fs";
import ytdl from "ytdl-core";
import { Connection } from "./Connection.ts";


export enum PlayTryResult {
    Played, Queued, BlockedBySong, Error
}

export class VoiceAudioPlayer {
    connection: Connection;
    player: AudioPlayer;
    voiceConnection: VoiceConnection;

    isPlayingSong: boolean = false;
    songsQueue: string[] = [];

    loopEnabled: boolean = false;
    currentSongPath: string = "";
    private wasSkipped: boolean = false;
    onSongStart?: (songTitle: string) => void;

    onEndCallback?: () => void;

    get isPlaying() {
        return this.player.state.status == AudioPlayerStatus.Playing;
    }

    constructor(connection: Connection, voiceConnection: VoiceConnection) {
        this.connection = connection;
        this.voiceConnection = voiceConnection;
        this.player = createAudioPlayer();
        this.voiceConnection.subscribe(this.player);

        this.player.on("stateChange", (oldState, newState) => {
            if (newState.status == AudioPlayerStatus.Idle) {
                this.onSoundEndCallback();
            }
        });
        this.player.on("error", (err: unknown) => {
            const e = err as { message?: string; stack?: string };
            console.error(`[PLAYER ERROR ${this.connection.guildId}]`, e?.message, e?.stack);
        });
    }

    playSound(soundFile: string): PlayTryResult {
        console.log("Playing sound " + soundFile);
        if (this.isPlayingSong) {
            return PlayTryResult.BlockedBySong;
        }
        let resource = createAudioResource(soundFile);
        this.player.play(resource);
        return PlayTryResult.Played;
    }

    playSong(musicFile: string): PlayTryResult {
        if (this.isPlaying) {
            this.songsQueue.push(musicFile);
            if (!this.isPlayingSong) {
                this.isPlayingSong = true;
            }
            return PlayTryResult.Queued;
        }

        this.currentSongPath = musicFile;

        let id = musicFile.split(/[\\/]/).pop()?.split(".")[0] || "";
        // console.log(id, ytdl.validateID(id), this.connection.lastCommandChannel);
        if (ytdl.validateID(id)) {
            ytdl.getBasicInfo(id).then(info => {
                if (!this.isPlayingSong || this.currentSongPath !== musicFile) {
                    return;
                }

                if (this.onSongStart) {
                    this.onSongStart(info.videoDetails.title);
                } else if (this.connection.lastCommandChannel) {
                    this.connection.lastCommandChannel?.send({
                        content: `Now playing:\n> ${info.videoDetails.title}`,
                    });
                }
            });
        }
        
        this.isPlayingSong = true;
        let resource = createAudioResource(fs.createReadStream(musicFile), { inlineVolume: true });
        resource.volume?.setVolume(.15);
        this.player.play(resource);
        return PlayTryResult.Played;
    }

    skipSong() {
        if (!this.isPlayingSong) {
            return false;
        }
        this.wasSkipped = true;
        this.player.stop();
        return true
    }

    toggleLoop(): boolean {
        this.loopEnabled = !this.loopEnabled;
        return this.loopEnabled;
    }

    stop() {
        this.songsQueue = [];
        this.loopEnabled = false;
        this.currentSongPath = "";
        this.wasSkipped = false;
        this.isPlayingSong = false;
        this.player.stop();
    }

    private onSoundEndCallback() {
        if (this.onEndCallback) {
            this.onEndCallback();
            this.onEndCallback = undefined;
        }

        if (!this.isPlayingSong) {
            return;
        }

        if (this.songsQueue.length == 0) {
            if (this.loopEnabled && !this.wasSkipped && this.currentSongPath) {
                // Loop: replay current song
                this.wasSkipped = false;
                this.playSong(this.currentSongPath);
            } else {
                // Stop: either loop is off, or user explicitly skipped
                this.wasSkipped = false;
                this.isPlayingSong = false;
            }
        } else {
            this.wasSkipped = false;
            this.playSong(this.songsQueue.shift() as string);
        }
    }
}
