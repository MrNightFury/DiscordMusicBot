import { CommandInteraction, VoiceBasedChannel } from "discord.js";


export class Checker {
    static async GetChannelFromInteraction(interaction: CommandInteraction): Promise<VoiceBasedChannel | false> {
        if (!interaction.guildId) {
            await interaction.followUp({ content: 'Command only allowed in guild!', ephemeral: true });
            return false;
        }
        let member = interaction.guild?.members.cache.get(interaction.user.id);

        if (!member) {
            await interaction.followUp({ content: 'User not found!', ephemeral: true });
            return false;
        }

        let channel = member.voice.channel;
        if (!channel) {
            await interaction.followUp({ content: 'User is not in channel!', ephemeral: true });
            return false;
        }

        return channel;
    }
}