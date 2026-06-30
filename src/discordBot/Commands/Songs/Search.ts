import {
    ApplicationCommandOptionType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
} from "discord.js";

import { Command } from "../../Command.ts";
import { Checker } from "../../Checker.ts";
import { searchYouTube, formatDuration } from "../../YouTubeSearch.ts";


export const Search: Command = {
    name: "search",
    description: "Search YouTube and play a track",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "query",
            description: "What to search for",
            required: true,
        }
    ],
    async run(client, interaction) {
        const query = interaction.options.get("query")?.value as string;
        if (!query) {
            await interaction.editReply({ content: "Please provide a search query." });
            return;
        }

        let connection = this.connections.get(interaction.guildId || "");
        if (!connection) {
            let channel = await Checker.GetChannelFromInteraction(interaction);
            if (!channel) {
                return;
            }
            await this.connectToVoiceChannel(channel, interaction);
            connection = this.connections.get(interaction.guildId || "");
            if (!connection) {
                await interaction.editReply({ content: "Failed to join voice channel." });
                return;
            }
        }

        if (interaction.channel?.isSendable()) {
            connection.lastCommandChannel = interaction.channel;
        }

        await interaction.editReply({ content: `🔍 Searching for "${query}"...` });

        let results;
        try {
            results = await searchYouTube(query, 5);
        } catch (err) {
            console.error("YouTube search failed:", err);
            await interaction.editReply({ content: "Search failed. Please try again." });
            return;
        }

        if (results.length === 0) {
            await interaction.editReply({ content: "No results found." });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`🔍 Search results for "${query}"`)
            .setColor(0x5865F2)
            .setDescription(
                results.map((r, i) =>
                    `**${i + 1}.** [${r.title}](${r.url})\n` +
                    `   ${r.channel} • ${formatDuration(r.duration)}`
                ).join("\n\n")
            )
            .setFooter({ text: "Select a track from the menu below" });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("youtube_search")
            .setPlaceholder("Choose a track...")
            .addOptions(
                results.map(r => ({
                    label: r.title.length > 100 ? r.title.substring(0, 97) + "..." : r.title,
                    description: `${r.channel} • ${formatDuration(r.duration)}`.substring(0, 100),
                    value: r.id,
                }))
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(selectMenu);

        await interaction.editReply({
            embeds: [embed],
            components: [row],
        });
    },
};
