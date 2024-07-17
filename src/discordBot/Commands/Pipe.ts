import { ApplicationCommandOptionType } from "discord.js";

import { Command } from "../Command.js";
import { PipeMode } from "../Connection.js";


export const Ping: Command = {
    name: "pipe",
    description: "Toggle pipe mode",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "sound",
            description: "Sound to play",
            required: false,
            autocomplete: true
        }, {
            type: ApplicationCommandOptionType.Number,
            name: "time",
            description: "Max interval in mins",
            required: false
        }
    ],
    async run(client, interaction) {
        let connection = this.connections.get(interaction.guildId || "");
        if (!connection) {
            await interaction.followUp({
                ephemeral: true,
                content: "Error"
            })
            return;
        }
        let sound = interaction.options.get("sound")?.value as string;
        if (sound && this.fileWorker.getFilesList().findIndex(item => item.name == sound) == -1) {
            await interaction.followUp({
                ephemeral: true,
                content: "Error"
            })
            return;
        }

        if (sound) {
            if (connection.pipeMode) {
                clearTimeout(connection.pipeMode.timer);
            }

            let option = interaction.options.get("time");
            let time = option && +option > 0 ? +option : 5;

            connection.pipeMode = {
                sound: sound,
                timer: setTimeout(() => {}, 1)
            }
            createRandomTimeout(connection.pipeMode, () => {
                if (connection) {
                    this.player.playSound(connection.guildId, sound)
                }
            }, time);
            await interaction.followUp({
                ephemeral: true,
                content: "Started pipe mode"
            })
        } else {
            if (connection.pipeMode) {
                clearTimeout(connection.pipeMode.timer);
            }
            await interaction.followUp({
                ephemeral: true,
                content: "Stopping"
            })
        }
    },

    async autocomplete(client, interaction) {
        let focusedValue = interaction.options.getFocused();
        let choices = this.fileWorker.getFilesList()
            .map(item => item.name)
            .filter(name => name.toLowerCase().startsWith(focusedValue))
            .map(name => ({ name: name, value: name}));

        await interaction.respond(choices);
    },
}

function getRandom(time: number) {
    return Math.random() * 1000 * 60 * Math.random() * time;
}

function createRandomTimeout(pipe: PipeMode, callback: () => void, time: number) {
    let timeout = getRandom(time);
    console.log(`Random timeout for ${timeout} ms`);
    pipe.timer = setTimeout(() => {
        callback();
        createRandomTimeout(pipe, callback, time);
    }, timeout);
}