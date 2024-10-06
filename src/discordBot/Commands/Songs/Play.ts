import { ApplicationCommandOptionType } from "discord.js";

import { Command } from "../../Command.js";
import { PlayTryResult } from "../../VoiceAudioPlayer.js";


export const Play: Command = {
    name: "play",
    description: "Play video from youtube link",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "url",
            description: "Youtube video link",
            required: true
        }
    ],
    async run(client, interaction) {
        let file = await this.fileWorker.downloadFile(interaction.options.get("url")?.value as string);
        await interaction.followUp({
            ephemeral: true,
            content: "Downloaded!"
        })
        let result = this.player.playSound(interaction.guildId || "", file, true);
        switch (result) {
            case PlayTryResult.Played: 
                interaction.editReply({content: "Playing!"});
                return;
            case PlayTryResult.Queued: 
                interaction.editReply({content: "Queued!"});
                return;
        }
    },
}