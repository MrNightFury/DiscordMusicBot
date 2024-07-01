import { Command, isCommand } from "../Command.js";
import { fileURLToPath } from "url";
import path from "path";
import * as fs from "fs";

// export const commands: Command[] = []

export async function loadCommands(dirname?: string) {
    const filename = fileURLToPath(import.meta.url);
    if (!dirname) {
        dirname = path.dirname(filename);
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
            commands = commands.concat(commands, await loadCommands(fullPath));
        } else {
            // Dynamic import terribleness
            let module = await import("./" + file);
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