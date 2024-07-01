import { Command } from "../Command.js";

export const Ping: Command = {
    name: "hello",
    description: "Say hello",
    async run(client, interaction) {
        await interaction.followUp({
            ephemeral: true,
            content: "Hello world!"
        })
    },
}