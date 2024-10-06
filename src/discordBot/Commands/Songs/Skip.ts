import { ApplicationCommandOptionType } from "discord.js";

import { Command } from "../../Command.js";
import { PlayTryResult } from "../../VoiceAudioPlayer.js";


export const Skip: Command = {
    name: "skip",
    description: "Skip current song",
    async run(client, interaction) {
        let result = this.player.skipSong(interaction.guildId || "");
        if (result) {
            await interaction.followUp({
                ephemeral: true,
                content: "Skipped!"
            })
        } else {
            await interaction.followUp({
            ephemeral: true,
            content: "Error"
        })
        }
    },
}