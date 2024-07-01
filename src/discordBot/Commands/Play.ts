import { createAudioResource } from "@discordjs/voice";
import { Checker } from "../Checker.js";
import { Command } from "../Command.js";
import { ApplicationCommandOptionType, Guild } from "discord.js";


export const Play: Command = {
    name: "play",
    description: "Play audio",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "sound",
            description: "Play specified sound",
            required: true
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

        if (this.player.playSound(interaction.guildId || "", soundName)) {
            interaction.followUp({ content: 'Sound played!', ephemeral: true });
        } else {
            interaction.followUp("Something went wrong...");
        }
        // let resourse = createAudioResource("./sound.wav");
        // connection.player.play(resourse);
        // interaction.followUp({ content: 'Sound played!', ephemeral: true })
    }
}