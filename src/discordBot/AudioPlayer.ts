import prism from "prism-media";
import mp3 from "mp3-duration";
import { createReadStream, readFileSync } from "fs";
import { Readable } from "stream";
import AudioMixer from "audio-mixer";
import NanoTimer from "nanotimer";

import { Bot } from "./DiscordBot";
import { Connection } from "./Connection.js";
import { PlayTryResult } from "./VoiceAudioPlayer.js";


export class AudioPlayer {
    bot: Bot;
    constructor(bot: Bot) {
        this.bot = bot;
    }

    mixRate = 10;
    sizePerBuffer = 48000 * 16 * 2 / 8 / this.mixRate;

    /**
     * @deprecated
     */
    _createAudioStream(soundFilePath: string) {
        const audioStream = createReadStream(soundFilePath);
        const transcoder = new prism.FFmpeg({
            args: [
                '-i', '-',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2'
            ],
        });
        const opusEncoder = new prism.opus.Encoder({
            rate: 48000,
            channels: 2,
            frameSize: 960
        });

        audioStream.pipe(transcoder as any).pipe(opusEncoder);
      
        return opusEncoder;
    }

    /**
     * @deprecated
     */
    async _startSoundPlay(connection: Connection, soundFilePath: string, callback?: () => void): Promise<boolean> {
//         console.log(`Trying to play ${soundFilePath}
// Player status ${connection.player.state.status}`);

        let buffer = readFileSync(soundFilePath);
        let time = await mp3(buffer);

        let audioStream = new Readable();
        audioStream.push(buffer);
        audioStream.push(null);

        console.log(`Duration ${time} s`)

        const transcoder = new prism.FFmpeg({
            args: [
                '-i', '-',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2'
            ],
        });

        var input = new AudioMixer.Input({
            channels: 2,
            sampleRate: 48000,
            volume: 100,
            bitDepth: 16,
            clearInterval: 250
        })
        
        // connection.mixer.addInput(input);

        audioStream.on('data', (chunk) => {
            transcoder.write(chunk);
        });

        let buff = transcoder.read(this.sizePerBuffer * 10) || Buffer.alloc(0);
        input.write(buff);
        
        
        let dataDoser = new NanoTimer();
        dataDoser.setInterval(() => {
            buff = transcoder.read(this.sizePerBuffer) || Buffer.alloc(0);
            input.write(buff);
            console.log(buff.length)
        }, "", 1000 / this.mixRate + 'm');

        // if (connection.player.state.status != AudioPlayerStatus.Playing) {
        //     console.log("Play!");
        //     let resource = createAudioResource(connection.mixer as any
        //         , {inputType: StreamType.Raw}
        //     );
        //     connection.player.play(resource);
        // }

        setTimeout(() => {
            dataDoser.clearInterval();
            console.log("Callback")
            // connection.mixer.removeInput(input);
            transcoder.emit("end");
            input.emit("end");
            if (callback) {
                callback();
            }
        }, time * 1000)

        return true;
    }

    /**
     * Mixed play sound
     */
    async _playSound(guildId: string, sound: string): Promise<boolean> {
        let connection = this.bot.connections.get(guildId || "");
        if (!connection) {
            return false;
        }
        await this._startSoundPlay(connection, `./storage/${sound}.mp3`, () => {
            console.log(`Sound ${sound} played`);
        })
        return true;
    }


    playSound(guildId: string, sound: string, isSong?: boolean): PlayTryResult {
        let connection = this.bot.connections.get(guildId || "");
        if (!connection) {
            return PlayTryResult.Error;
        }

        // let resource = createAudioResource(`./storage/${sound}.mp3`);
        // console.log(`./storage/${sound}.mp3`);
        let path = this.bot.fileWorker.getFilePath(sound);
        if (isSong) {
            return connection.player.playSong(path);
        } else {
            return connection.player.playSound(path);
        }
    }

    skipSong(guildId: string) {
        let connection = this.bot.connections.get(guildId || "");
        if (!connection) {
            return false;
        }

        return connection.player.skipSong();
    }

    playSoundSampler(guildId: string, sound: string): boolean{
        let connection = this.bot.connections.get(guildId || "");
        if (!connection) {
            return false;
        }

        return true;
    }

    
}