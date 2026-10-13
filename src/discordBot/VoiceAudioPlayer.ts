import { AudioPlayer, AudioPlayerStatus, VoiceConnection, createAudioPlayer, createAudioResource } from "@discordjs/voice";
import { } from "discord.js";
import fs from "node:fs";
import type { Readable } from "node:stream";
import type { ChildProcess } from "node:child_process";
import ytdl from "ytdl-core";
import { Connection } from "./Connection.ts";
import type { SongSource } from "../FileWorker.ts";


export enum PlayTryResult {
    Played, Queued, BlockedBySong, Error
}

function toSongSource(item: string | SongSource): SongSource {
    return typeof item === "string" ? { kind: "file", path: item } : item;
}

export class VoiceAudioPlayer {
    connection: Connection;
    player: AudioPlayer;
    voiceConnection: VoiceConnection;

    isPlayingSong: boolean = false;
    songsQueue: (string | SongSource)[] = [];

    loopEnabled: boolean = false;
    currentSong: SongSource | null = null;
    private wasSkipped: boolean = false;
    onSongStart?: (songTitle: string) => void;

    onEndCallback?: () => void;

    /** yt-dlp child of the currently playing /stream song. */
    private currentStreamProc: ChildProcess | null = null;

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

    /** Back-compat: accept legacy "temp/<id>" ids and absolute file paths. */
    private legacyPathToSource(musicFile: string): SongSource {
        // Absolute/relative filesystem path (as produced by AudioPlayer.playSound)
        if (musicFile.includes("/") || musicFile.includes("\\")) {
            return { kind: "file", path: musicFile };
        }
        // Legacy "temp/<id>" (no extension) coming straight from downloadFile()
        return { kind: "file", path: musicFile + ".mp3" };
    }

    playSong(musicFile: string | SongSource): PlayTryResult {
        const song = typeof musicFile === "string" ? this.legacyPathToSource(musicFile) : musicFile;

        if (this.isPlaying) {
            this.songsQueue.push(song);
            if (!this.isPlayingSong) {
                this.isPlayingSong = true;
            }
            return PlayTryResult.Queued;
        }

        this.currentSong = song;
        this.announceSong(song);

        this.isPlayingSong = true;
        if (song.kind === "file") {
            const resource = createAudioResource(fs.createReadStream(song.path), { inlineVolume: true });
            resource.volume?.setVolume(.15);
            this.player.play(resource);
        } else {
            try {
                const resource = this.createStreamResource(song);
                this.player.play(resource);
            } catch (err) {
                console.error(`[STREAM ${this.connection.guildId}] failed to start stream:`, err);
                this.isPlayingSong = false;
                this.currentSong = null;
                return PlayTryResult.Error;
            }
        }
        return PlayTryResult.Played;
    }

    /**
     * /stream mode: pipe yt-dlp stdout (webm/opus or m4a) into the resource.
     * createAudioResource infers the stream type from the leading bytes
     * (EBML/webm -> WebM opus demux path; anything else -> Arbitrary, i.e.
     * FFmpeg -> s16le transcode), so whatever container yt-dlp emits on
     * stdout needs no manual demuxing here.
     */
    private createStreamResource(song: Extract<SongSource, { kind: "stream" }>) {
        const sub = song.spawnStream();
        this.currentStreamProc = sub;

        const stdout = sub.stdout as Readable;
        stdout.on("error", (err: Error) => {
            console.error(`[STREAM ${this.connection.guildId}] yt-dlp stdout error:`, err.message);
        });
        sub.on("exit", (code, signal) => {
            if (this.currentStreamProc === sub) {
                this.currentStreamProc = null;
            }
            if (code !== 0 && code !== null && this.isPlayingSong) {
                // 0 expected at natural EOF; null means killed by us (skip/stop).
                console.warn(`[STREAM ${this.connection.guildId}] yt-dlp exited code=${code} signal=${signal}`);
            }
        });

        console.log(`[STREAM ${this.connection.guildId}] piping yt-dlp stdout for ${song.id}`);
        const resource = createAudioResource(stdout, { inlineVolume: true });
        resource.volume?.setVolume(.15);
        return resource;
    }

    private announceSong(song: SongSource) {
        const id = song.kind === "stream" ? song.id : (song.path.split(/[\\/]/).pop()?.split(".")[0] || "");
        if (ytdl.validateID(id)) {
            ytdl.getBasicInfo(id).then(info => {
                if (!this.isPlayingSong || this.currentSong !== song) {
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
        this.currentSong = null;
        this.wasSkipped = false;
        this.isPlayingSong = false;
        this.player.stop();
    }

    /** Kill the yt-dlp child of the current stream song (skip/stop/advance). */
    private killCurrentStream() {
        const proc = this.currentStreamProc;
        this.currentStreamProc = null;
        if (proc && proc.exitCode === null) {
            try {
                proc.kill("SIGTERM");
            } catch (err) {
                console.warn("[STREAM] failed to kill yt-dlp:", err);
            }
        }
    }

    private onSoundEndCallback() {
        this.killCurrentStream();

        if (this.onEndCallback) {
            this.onEndCallback();
            this.onEndCallback = undefined;
        }

        if (!this.isPlayingSong) {
            return;
        }

        if (this.songsQueue.length == 0) {
            if (this.loopEnabled && !this.wasSkipped && this.currentSong) {
                // Loop: replay current song
                this.wasSkipped = false;
                this.playSong(this.currentSong);
            } else {
                // Stop: either loop is off, or user explicitly skipped
                this.wasSkipped = false;
                this.isPlayingSong = false;
            }
        } else {
            this.wasSkipped = false;
            this.playSong(toSongSource(this.songsQueue.shift() as string | SongSource));
        }
    }
}
