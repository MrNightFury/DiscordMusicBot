import fs from "fs";
import path from "path";
import ytdl from "ytdl-core";

export interface SoundFileInfo {
    path: string;
    name: string;
}

export class FileWorker {
    basePath: string;
    sounds: Map<string, SoundFileInfo>;

    constructor(basePath: string) {
        this.basePath = basePath;

        let file = fs.readFileSync(path.join(this.basePath, "soundsList.json"), "utf8");
        this.sounds = new Map((JSON.parse(file) as SoundFileInfo[]).map(item => {
            return [item.path, item]
        }));

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

    downloadFile(url: string) {
        let id = "temp/" + ytdl.getURLVideoID(url) + '-' + Date.now();
        const videoReadableStream = ytdl(url, { filter: "audioonly" });
        const fileWriteStream = fs.createWriteStream(path.join(this.basePath, id + ".mp3"));
        videoReadableStream.pipe(fileWriteStream);

        return new Promise<string>((resolve, reject) => {
            fileWriteStream.on("finish", () => {
                resolve(id);
            });
            fileWriteStream.on("error", (err) => {
                reject(err);
            });
        })
    }
}