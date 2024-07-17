import { Command } from "../Command.js";
import { Checker } from "../Checker.js";


export const Ping: Command = {
    name: "join",
    description: "Join voice channel",
    async run(client, interaction) {
        let channel = await Checker.GetChannelFromInteraction(interaction);
        if (!channel) {
            return;
        }

        // let member = interaction.guild?.members.cache.get(interaction.user.id);
        // let member = interaction.user
        // let channel = member.voice.channel;

        this.connectToVoiceChannel(channel, interaction);

        // let connection = joinVoiceChannel({
        //     channelId: channel.id,
        //     guildId: channel.guild.id,
        //     adapterCreator: channel.guild.voiceAdapterCreator
        // })
        // await entersState(connection, VoiceConnectionStatus.Ready, 30e3).catch(() => {
        //     interaction.followUp({
        //         ephemeral: true,
        //         content: "Error joining channel!"
        //     })
        // }).then(() => {
        //     if (!channel) return;
        //     interaction.followUp({
        //         ephemeral: true,
        //         content: `Joined channel ${channel?.name}`
        //     })
        // })
        
        // let player = createAudioPlayer();
        // connection.subscribe(player);

        // this.connections.set(channel.guildId, {
        //     guildId: channel.guildId,
        //     player: player,
        //     connection: connection
        // });

        // let resourse = createAudioResource("./sound.wav");
        // player.play(resourse);
        // player.on(AudioPlayerStatus.Idle, () => {
        //     connection.destroy();
        // })
    },
}