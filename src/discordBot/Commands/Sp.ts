import { createAudioResource } from "@discordjs/voice";
import { Checker } from "../Checker.js";
import { Command } from "../Command.js";
import { ActionRow, ActionRowData, ApplicationCommandOptionType, ButtonComponent, ButtonStyle, Component, ComponentType, Guild } from "discord.js";


export const sp: Command = {
    name: "sp",
    
    description: "Play soundpad sound",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "sound",
            description: "Specified sound",
            required: false
        }
    ],

    async run(client, interaction) {
        let connection = this.connections.get(interaction.guildId || "");
        if (!connection) {
            let channel = await Checker.GetChannelFromInteraction(interaction);
            if (!channel) {
                return;
            }

            await this.connectToVoiceChannel(channel, interaction);
        }

        let soundName = interaction.options.get("sound")?.value as string;

        if (soundName) {
            if (await this.player.playSound(interaction.guildId || "", soundName)) {
                interaction.followUp({ content: 'Sound played!', ephemeral: true });
            } else {
                interaction.followUp("Something went wrong...");
            }
        } else {
            let buttons = this.fileWorker.getFilesList().map(item => {return {
                type: ComponentType.Button,
                customId: item.path,
                label: item.name,
                style: ButtonStyle.Secondary
            } as ButtonComponent});

            let rows: ButtonComponent[][] = [[]];
            while (buttons.length != 0) {
                if (rows[rows.length - 1].length >= 5) {
                    rows.push([])
                }
                rows[rows.length - 1].push(buttons.shift() as any);
            }
            console.log(rows);

            interaction.followUp({
                content: "MrNightFury's Soundpad",
                components: rows.map(item => {
                    return {
                        type: ComponentType.ActionRow,
                        components: item
                    }
                })
            })
        }

        
        // let resourse = createAudioResource("./sound.wav");
        // connection.player.play(resourse);
        // interaction.followUp({ content: 'Sound played!', ephemeral: true })
    }
}