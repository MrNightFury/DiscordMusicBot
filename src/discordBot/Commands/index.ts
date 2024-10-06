import path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

import { Command, isCommand } from "../Command.js";


export async function loadCommands(currentDir?: string) {
    const filename = fileURLToPath(import.meta.url);

    let dirname = path.dirname(filename)
    if (currentDir) {
        dirname = path.join(dirname, currentDir);
    }

    let commands: Command[] = [];

    let files = fs.readdirSync(dirname);
    for (let file of files) {
        const fullPath = path.join(dirname, file);
        if (fullPath == filename) {
            continue;
        }

        // Handle recursive directories
        if (fs.lstatSync(fullPath).isDirectory()) {
            // let c = 
            // console.log("concatting " + commands.map(item => item.name) + " and " + c.map(item => item.name))
            commands = commands.concat(await loadCommands(file));
        } else {
            let modulePath = (currentDir ? currentDir + "/" : "") + file;
            console.log("Imporing " + modulePath)
            // Dynamic import terribleness
            let module = await import("./" + modulePath);
            const propertyNames = Object.getOwnPropertyNames(module);
            for (const propertyName of propertyNames) {
                const propertyDescriptor = Object.getOwnPropertyDescriptor(module, propertyName);
                if (isCommand(propertyDescriptor?.value)) {
                    commands.push(propertyDescriptor?.value);
                } else {
                    console.log(`Incorrect export property "${propertyDescriptor}" in file "${file}"`)
                }
            }
        }
    }
    return commands;
};