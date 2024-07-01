import { Command } from "../Command.js";
import { JWTHelper } from "../../JWTHelper.js"

export const GetToken: Command = {
    name: "get_token",
    description: "Get token for use in soundpad desktop app",
    async run(client, interaction) {
        let guildId = interaction.guildId;
        if (!guildId) {
            await interaction.followUp({
                ephemeral: true,
                content: "Only works in guild"
            });
            return;
        }
        await interaction.followUp({
            ephemeral: true,
            content: JWTHelper.generateToken(guildId, interaction.user.id)
        })
    },
}