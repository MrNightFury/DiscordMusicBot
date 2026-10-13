import { ApplicationCommandOptionType } from "discord.js";

import { Command } from "../../Command.ts";
import { PlayTryResult } from "../../VoiceAudioPlayer.ts";
import { Checker } from "../../Checker.ts";


export const Stream: Command = {
    name: "stream",
    description: "Stream audio from a youtube link without downloading to disk",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "url",
            description: "Youtube video link",
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
            connection = this.connections.get(interaction.guildId || "")!;
        }

        const url = interaction.options.get("url")?.value as string;

        if (interaction.channel?.isSendable()) {
            connection.lastCommandChannel = interaction.channel;
        }

        // No download happens here: the yt-dlp child is spawned lazily when
        // the song reaches the front of the voice queue (see VoiceAudioPlayer).
        try {
            let result = await this.player.playStreamByUrl(interaction.guildId || "", url);
            console.log("Stream result: ", result);
            switch (result) {
                case PlayTryResult.Played:
                    await interaction.followUp({
                        ephemeral: true,
                        content: "Streaming!"
                    });
                    return;
                case PlayTryResult.Queued:
                    await interaction.followUp({
                        ephemeral: true,
                        content: "Queued (stream)!"
                    });
                    return;
                case PlayTryResult.Error:
                    await interaction.followUp({
                        ephemeral: true,
                        content: "Failed to start stream."
                    });
                    return;
            }
        } catch (err) {
            console.error("Stream failed:", err);
            await interaction.followUp({
                ephemeral: true,
                content: `Failed to stream: ${err instanceof Error ? err.message : "unknown error"}`
            });
        }
    },
}
