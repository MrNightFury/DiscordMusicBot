import fs from "fs";
import path from "path";

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
}