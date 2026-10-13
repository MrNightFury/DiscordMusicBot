import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import ytdl from "ytdl-core";

import { youtubeDl } from "youtube-dl-exec"
import ytdlExecDefault from "youtube-dl-exec"

// runtime-only exports of youtube-dl-exec (present in index.js, absent from
// the .d.ts): binary path and the dargs serializer used by .exec()
const ytdlRuntime = ytdlExecDefault as unknown as {
    constants?: { YOUTUBE_DL_PATH?: string };
    args?: (flags: Record<string, unknown>) => string[];
};
const YTDLP_BIN_FALLBACK = "node_modules/youtube-dl-exec/bin/yt-dlp";

function ytdlpBinaryPath(): string {
    return ytdlRuntime.constants?.YOUTUBE_DL_PATH || YTDLP_BIN_FALLBACK;
}

function youtubeDlArgs(flags: Record<string, unknown>): string[] {
    if (ytdlRuntime.args) {
        return ytdlRuntime.args(flags);
    }
    // Fallback: build CLI args manually the way dargs(useEquals:false) does
    // for our flat flag set.
    const out: string[] = [];
    for (const [key, value] of Object.entries(flags)) {
        if (value === undefined || value === null || value === false) continue;
        const kebab = key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
        if (value === true) {
            out.push(`--${kebab}`);
        } else {
            out.push(`--${kebab}=${String(value)}`);
        }
    }
    return out;
}

type YoutubeDlFlags = NonNullable<Parameters<typeof youtubeDl>[1]> & {
    extractorArgs?: string;
};

type YoutubeDlJsRuntime = NonNullable<YoutubeDlFlags["jsRuntimes"]>;

const DEFAULT_YOUTUBE_JS_RUNTIME: YoutubeDlJsRuntime = "node:/usr/local/bin/node";

function isYoutubeDlJsRuntime(value: string): value is YoutubeDlJsRuntime {
    return /^(node|bun|quickjs|deno)(:.+)?$/.test(value);
}

/**
 * Proxy-route fallback for yt-dlp. The container-wide yt-dlp.conf (bind-mounted
 * to /root/.config/yt-dlp/config) may set a proxy route; if downloads through
 * it start failing (flaky proxy, dead node), attempt 2 retries with the
 * INVERSE route: `--proxy ''` (direct) when the config had a proxy, or
 * YOUTUBE_FALLBACK_PROXY when the config is direct. A CLI flag always beats
 * the config file in yt-dlp. Without YOUTUBE_FALLBACK_PROXY set, a direct
 * config fails fast instead of guessing a proxy.
 */
function readConfiguredProxy(): string | null {
    const candidates = [
        "/root/.config/yt-dlp/config",
        path.join(process.env.HOME || "/root", ".config", "yt-dlp", "config"),
    ];
    for (const p of candidates) {
        try {
            if (!fs.existsSync(p)) continue;
            const m = fs.readFileSync(p, "utf8").match(/^\s*--proxy\s+(\S+)/m);
            return m ? m[1] : null;
        } catch {
            // unreadable: treat as not found, attempt 1 keeps config behavior
        }
    }
    return null;
}


export interface SoundFileInfo {
    path: string;
    name: string;
}

/**
 * A song to play.
 *
 * - "file": fully downloaded file on disk (classic /play, with cache).
 * - "stream": nothing on disk; spawnStream() lazily spawns yt-dlp with
 *   `-o -` so its stdout can be piped straight into the voice player.
 *   The factory is lazy on purpose: queue entries must not hold an open
 *   network download while waiting for their turn.
 */
export type SongSource =
    | { kind: "file"; path: string }
    | { kind: "stream"; url: string; id: string; spawnStream: () => ChildProcess };

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

    private resolveCommonOptions(): YoutubeDlFlags {
        const cookiesPath = process.env.YOUTUBE_COOKIES_PATH || path.join(this.basePath, "cookies.txt");
        const configuredJsRuntime = process.env.YOUTUBE_JS_RUNTIME;
        const jsRuntimes = configuredJsRuntime && isYoutubeDlJsRuntime(configuredJsRuntime)
            ? configuredJsRuntime
            : DEFAULT_YOUTUBE_JS_RUNTIME;

        if (configuredJsRuntime && !isYoutubeDlJsRuntime(configuredJsRuntime)) {
            console.warn(`Invalid YOUTUBE_JS_RUNTIME=${configuredJsRuntime}; using ${DEFAULT_YOUTUBE_JS_RUNTIME}`);
        }

        const flags: YoutubeDlFlags = {
            noPlaylist: true,
            retries: 3,
            socketTimeout: 30,
            jsRuntimes
        };

        if (process.env.YOUTUBE_EXTRACTOR_ARGS) {
            flags.extractorArgs = process.env.YOUTUBE_EXTRACTOR_ARGS;
        }

        if (fs.existsSync(cookiesPath)) {
            console.log(`Using YouTube cookies from ${cookiesPath}`);
            flags.cookies = cookiesPath;
        } else {
            console.warn(`YouTube cookies file not found at ${cookiesPath}; download may fail on bot checks`);
        }

        return flags;
    }

    /**
     * Run yt-dlp once with given flags, resolve with its exit code and tail of
     * stderr. Uses youtube-dl-exec's binary path so the version pinned in the
     * image (updated at build time) is the one we spawn.
     *
     * NOTE: proxy is NOT passed through dargs — youtube-dl-exec's args() does
     * `.filter(Boolean)` which silently drops the empty string, turning
     * `--proxy ''` into a bare `--proxy` (yt-dlp then errors "option requires
     * 1 argument"). We append the proxy as explicit argv tokens instead;
     * spawn() passes an empty-string argument through verbatim.
     */
    private runYtDlpOnce(url: string, flags: YoutubeDlFlags): Promise<{ code: number | null; stderrTail: string }> {
        return new Promise((resolve) => {
            const { proxy, ...flagsWithoutProxy } = flags;
            const args = [url].concat(youtubeDlArgs(flagsWithoutProxy as unknown as Record<string, unknown>));
            if (proxy !== undefined) {
                args.push("--proxy", proxy);
            }
            const proc = spawn(ytdlpBinaryPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
            let stderrTail = "";
            proc.stderr?.on("data", (chunk: Buffer) => {
                stderrTail = (stderrTail + chunk.toString()).slice(-2000);
            });
            proc.on("error", (err) => resolve({ code: -1, stderrTail: `spawn error: ${err.message}` }));
            proc.on("close", (code) => resolve({ code, stderrTail }));
        });
    }

    /**
     * Download with proxy-route fallback:
     *   attempt 1: whatever /root/.config/yt-dlp/config says (currently mihomo)
     *   attempt 2 (on non-zero exit): explicit inverse route — `--proxy ""`
     *              (direct) if the config had a proxy, else the mihomo proxy.
     */
    private async downloadWithFallback(url: string, downloadOptions: YoutubeDlFlags): Promise<void> {
        const configProxy = readConfiguredProxy();
        console.log(`[proxy-fallback] config proxy: ${configProxy ?? "(direct)"}`);

        let attempt1 = await this.runYtDlpOnce(url, downloadOptions);
        if (attempt1.code === 0) {
            return;
        }
        console.error(`[proxy-fallback] attempt 1 (config route) failed, exit=${attempt1.code}\n${attempt1.stderrTail.trim()}`);

        const fallbackFlags: YoutubeDlFlags = { ...downloadOptions };
        if (configProxy) {
            console.warn(`[proxy-fallback] attempt 2: overriding config proxy with --proxy '' (direct)`);
            fallbackFlags.proxy = "";
        } else {
            const fallbackProxy = process.env.YOUTUBE_FALLBACK_PROXY;
            if (!fallbackProxy) {
                throw new Error(`yt-dlp failed on the config route (direct), exit=${attempt1.code}, and YOUTUBE_FALLBACK_PROXY is not set`);
            }
            console.warn(`[proxy-fallback] attempt 2: forcing fallback proxy ${fallbackProxy}`);
            fallbackFlags.proxy = fallbackProxy;
        }
        const attempt2 = await this.runYtDlpOnce(url, fallbackFlags);
        if (attempt2.code === 0) {
            console.log(`[proxy-fallback] attempt 2 succeeded with inverse route`);
            return;
        }
        console.error(`[proxy-fallback] attempt 2 (${configProxy ? "direct" : "fallback proxy"}) failed, exit=${attempt2.code}\n${attempt2.stderrTail.trim()}`);
        throw new Error(`yt-dlp failed on both routes (config=${configProxy ?? "direct"}): attempt1=${attempt1.code}, attempt2=${attempt2.code}`);
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

        const downloadOptions: YoutubeDlFlags = {
            ...this.resolveCommonOptions(),
            output: path.join(this.basePath, id + ".mp3"),
            // Prefer audio-only (a few MB per song). Fall back to the lowest
            // quality combined stream when no audio-only exists (DRM videos,
            // some platforms) so we still extract audio without pulling full
            // HD video. Typical worst fallback: ~150 KB/s of 144p m4v.
            format: process.env.YOUTUBE_FORMAT || "bestaudio/worst",
            extractAudio: true,
            audioFormat: "mp3",
        };

        return this.downloadWithFallback(url, downloadOptions).then(() => {
            console.log("File downloaded");
            return id;
        }).catch(err => {
            console.error(err);
            throw err;
        })
    }

    /**
     * Lazy yt-dlp stdout stream for /stream. No disk I/O. When the config
     * proxy route fails at spawn/extraction time, falls back to the inverse
     * route for the NEXT spawn (the fallback decision is memoized per worker).
     */
    spawnSongStream(url: string): ChildProcess {
        // youtube-dl-exec's .exec() returns the tinyspawn child process;
        // sub.stdout is the yt-dlp media pipe (-o -). --no-progress keeps
        // progress lines out of the audio bytes; the proxy comes from
        // /root/.config/yt-dlp/config (attempt 1) exactly like /play.
        const flags: YoutubeDlFlags = {
            ...this.resolveCommonOptions(),
            output: "-",
            format: process.env.YOUTUBE_FORMAT || "bestaudio/best",
            noProgress: true,
        };
        const sub = youtubeDl.exec(url, flags);
        if (!sub.stdout) {
            throw new Error("youtube-dl-exec exec() returned no stdout pipe");
        }
        return sub as unknown as ChildProcess;
    }

    /**
     * Build a stream SongSource for a YouTube URL. Throws on non-YouTube URLs
     * (the id is used for the "Now playing" title lookup).
     */
    prepareStreamSong(url: string): SongSource {
        let id: string;
        try {
            id = ytdl.getURLVideoID(url);
        } catch {
            throw new Error(`Streaming supports YouTube URLs only, got: ${url}`);
        }

        console.log(`Stream: preparing lazy stdout stream for ${url}`);
        return { kind: "stream", url, id, spawnStream: () => this.spawnSongStream(url) };
    }
}
