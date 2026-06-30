import fs from "node:fs";
import path from "node:path";
import ytdl from "ytdl-core";

import { youtubeDl } from "youtube-dl-exec"

type YoutubeDlFlags = NonNullable<Parameters<typeof youtubeDl>[1]> & {
    extractorArgs?: string;
};

type YoutubeDlJsRuntime = NonNullable<YoutubeDlFlags["jsRuntimes"]>;

const DEFAULT_YOUTUBE_JS_RUNTIME: YoutubeDlJsRuntime = "node:/usr/local/bin/node";

function isYoutubeDlJsRuntime(value: string): value is YoutubeDlJsRuntime {
    return /^(node|bun|quickjs|deno)(:.+)?$/.test(value);
}


export interface SoundFileInfo {
    path: string;
    name: string;
}

export class FileWorker {
    basePath: string;
    sounds: Map<string, SoundFileInfo>;

    constructor(basePath: string) {
        this.basePath = basePath;

        const filePath = path.join(this.basePath, "soundsList.json");
        if (fs.existsSync(filePath)) {
            let file = fs.readFileSync(filePath, "utf8");
            this.sounds = new Map((JSON.parse(file) as SoundFileInfo[]).map(item => {
                return [item.path, item]
            }));
        } else {
            this.sounds = new Map();
        }

        this.save();
    }

    addFileInfo(info: SoundFileInfo) {
        this.sounds.set(info.path, info);
    }

    save() {
        fs.writeFileSync(path.join(this.basePath, "soundsList.json"), JSON.stringify(Array.from(this.sounds.entries()).map(item => {
            return item[1];
        }), null, 4));
    }

    getFilesList() {
        return Array.from(this.sounds.entries()).map(item => {
            return item[1];
        })
    }

    getFilePath(name: string) {
        return path.join(this.basePath, name + ".mp3");
    }

    async downloadFile(url: string) {
        console.log(`Downloading file ${url}`);

        let id = "temp/" + ytdl.getURLVideoID(url);

        const tempDir = path.join(this.basePath, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        if (fs.existsSync(path.join(this.basePath, id + ".mp3"))) {
            console.log("Skipping download using cache")
            return id;
        }

        const cookiesPath = process.env.YOUTUBE_COOKIES_PATH || path.join(this.basePath, "cookies.txt");
        const configuredJsRuntime = process.env.YOUTUBE_JS_RUNTIME;
        const jsRuntimes = configuredJsRuntime && isYoutubeDlJsRuntime(configuredJsRuntime)
            ? configuredJsRuntime
            : DEFAULT_YOUTUBE_JS_RUNTIME;

        if (configuredJsRuntime && !isYoutubeDlJsRuntime(configuredJsRuntime)) {
            console.warn(`Invalid YOUTUBE_JS_RUNTIME=${configuredJsRuntime}; using ${DEFAULT_YOUTUBE_JS_RUNTIME}`);
        }

        const downloadOptions: YoutubeDlFlags = {
            output: path.join(this.basePath, id + ".mp3"),
            // Prefer audio-only (a few MB per song). Fall back to the lowest
            // quality combined stream when no audio-only exists (DRM videos,
            // some platforms) so we still extract audio without pulling full
            // HD video. Typical worst fallback: ~150 KB/s of 144p m4v.
            format: process.env.YOUTUBE_FORMAT || "bestaudio/worst",
            extractAudio: true,
            audioFormat: "mp3",
            noPlaylist: true,
            retries: 3,
            socketTimeout: 30,
            jsRuntimes,
            extractorArgs: process.env.YOUTUBE_EXTRACTOR_ARGS || "youtube:player_client=web,tv"
        };

        if (fs.existsSync(cookiesPath)) {
            console.log(`Using YouTube cookies from ${cookiesPath}`);
            downloadOptions.cookies = cookiesPath;
        } else {
            console.warn(`YouTube cookies file not found at ${cookiesPath}; download may fail on bot checks`);
        }

        return youtubeDl(url, downloadOptions).then(() => {
            console.log("File downloaded");
            return id;
        }).catch(err => {
            console.error(err);
            throw err;
        })
    }
}