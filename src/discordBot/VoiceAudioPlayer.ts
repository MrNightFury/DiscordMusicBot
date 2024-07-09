import { AudioPlayer, AudioPlayerStatus, VoiceConnection, createAudioPlayer, createAudioResource } from "@discordjs/voice";
import fs from "fs";


export enum PlayTryResult {
    Played, Queued, BlockedBySong, Error
}

export class VoiceAudioPlayer {
    player: AudioPlayer;
    connection: VoiceConnection;

    isPlayingSong: boolean = false;
    songsQueue: string[] = [];

    onEndCallback?: () => void;

    get isPlaying() {
        return this.player.state.status == AudioPlayerStatus.Playing;
    }

    constructor(connection: VoiceConnection) {
        this.connection = connection;
        this.player = createAudioPlayer();
        this.connection.subscribe(this.player);

        this.player.on("stateChange", (oldState, newState) => {
            if (newState.status == AudioPlayerStatus.Idle) {
                this.onSoundEndCallback();
            }
        });
    }

    playSound(soundFile: string): PlayTryResult {
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
        this.isPlayingSong = true;
        let resource = createAudioResource(fs.createReadStream(musicFile));
        this.player.play(resource);
        return PlayTryResult.Played;
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
            this.isPlayingSong = false;
        } else {
            this.playSong(this.songsQueue.shift() as string);
        }
    }
}