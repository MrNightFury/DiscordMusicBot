import { Command } from "../Command.js";


export const Ping: Command = {
    name: "ping",
    description: "Replies with pong!",
    async run(client, interaction) {
        await interaction.followUp({
            ephemeral: true,
            content: "Pong!"
        })
    },
}