import fs from "fs";
import path from "path";
import ytdl from "ytdl-core";

import { youtubeDl } from "youtube-dl-exec"


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

    async downloadFile(url: string) {
        console.log(`Downloading file ${url}`);

        let id = "temp/" + ytdl.getURLVideoID(url);

        if (fs.existsSync(path.join(this.basePath, id + ".mp3"))) {
            console.log("Skipping download using cache")
            return id;
        }

        return new Promise<string>((resolve, reject) => {
            youtubeDl(url, {
                output: path.join(this.basePath, id + ".mp3"),
                extractAudio: true,
                audioFormat: "mp3"
            }).catch(err => {
                console.error(err);
                reject(err);
            }).then(data => {
                if (data && typeof data == "string" && data.indexOf("Deleting original file") != -1) {
                    console.log("File downloaded")
                    resolve(id);
                }
            })
        })
    }
}