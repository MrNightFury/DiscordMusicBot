import { Command } from "../Command.js";


export const Ping: Command = {
    name: "hello",
    description: "Say hello",
    async run(client, interaction) {
        // this.play(Array.from(this.connections.values())[0].player);
        await interaction.followUp({
            ephemeral: true,
            content: "Hello world!"
        })
    },
}