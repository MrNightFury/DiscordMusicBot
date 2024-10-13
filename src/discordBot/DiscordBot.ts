import prism from "prism-media";
import AudioMixer from "audio-mixer";
import { AutocompleteInteraction, ButtonInteraction, Client, CommandInteraction, GatewayIntentBits, Interaction, VoiceBasedChannel } from "discord.js";
import { AudioPlayer, StreamType, VoiceConnectionStatus, createAudioResource, entersState, joinVoiceChannel } from "@discordjs/voice";

import { Command } from "./Command.js";
import { loadCommands } from "./Commands/index.js";
import { Config } from "../Config.js";
import { Connection } from "./Connection.js";
import * as AP from "./AudioPlayer.js";
import { PassThrough } from "node:stream";
import { VoiceAudioPlayer } from "./VoiceAudioPlayer.js";
import { FileWorker } from "../FileWorker.js";


export class Bot {
    config: Config;
    client: Client;
    fileWorker: FileWorker;

    commands: Command[] = [];
    connections: Map<string, Connection> = new Map();

    player = new AP.AudioPlayer(this);

    constructor(fileWorker: FileWorker, config: Config) {
        this.config = config;
        this.fileWorker = fileWorker;

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages
            ]
        });
    }

    async init() {
        this.client.on("ready", () => {
            console.log("Bot online");
            this.setupListeners();
        });

        this.client.login(this.config.bot.token);
    }

    async setupListeners() {
        if (!this.client.application) {
            console.error("client.application is null")
            return;
        }
        this.commands = await loadCommands();
        console.log("Loaded commands: " + this.commands.map(item => item.name).join(", "));
        this.client.application.commands.set(this.commands);

        this.client.on("interactionCreate", async (interaction: Interaction) => {
            if (interaction.isCommand()) {
                await this.handleSlashCommand(this.client, interaction);
            } else if (interaction.isButton()) {
                this.handleButtonClick(this.client, interaction);
            } else if (interaction.isAutocomplete()) {
                this.handleAutocomplete(this.client, interaction);
            }
        })
    }

    async handleSlashCommand(client: Client, interaction: CommandInteraction) {
        console.log(`Recieved command "${interaction.commandName}" from user "${interaction.user.id}" in guild "${interaction.guildId}"`);

        if (!interaction.guildId) return;

        const slashCommand = this.commands.find(c => c.name === interaction.commandName);
        if (!slashCommand) {
            interaction.followUp({ content: "An error has occurred" });
            return;
        }

        await interaction.deferReply();
        slashCommand.run.bind(this)(client, interaction);
    }

    async handleAutocomplete(client: Client, interaction: AutocompleteInteraction) {
        console.log(`Recieved autocomplete interaction "${interaction.commandName}" from user "${interaction.user.id}" in guild "${interaction.guildId}"`)
        if (!interaction.guildId) return;

        const slashCommand = this.commands.find(c => c.name === interaction.commandName);
        if (!slashCommand || !slashCommand.autocomplete) {
            interaction.respond([{ name: "Error", value: "Error" }]);
            return;
        }
        slashCommand.autocomplete.bind(this)(client, interaction);
    }

    async handleButtonClick(client: Client, interaction: ButtonInteraction) {
        let id = interaction.customId;
        console.log("Button id:", id);
        if (id) {
            this.player.playSound(interaction.guildId || "", id);
            interaction.deferUpdate();
        }
    }

    async connectToVoiceChannel(channel: VoiceBasedChannel, interaction: CommandInteraction) {
        let connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator
        })
        await entersState(connection, VoiceConnectionStatus.Ready, 3e3)
        .catch(() => {
            interaction.followUp({
                ephemeral: true,
                content: "Error joining channel!"
            })
        })
        .then(() => {
            if (!channel) return;
            interaction.followUp({
                ephemeral: true,
                content: `Joined channel ${channel?.name}`
            })
        })

        this.connections.set(channel.guildId, {
            guildId: channel.guildId,
            player: new VoiceAudioPlayer(connection),
            connection: connection,
        });

        connection.on("stateChange", (oldState, newState) => {
            console.log(`Voice connection state changed: ${oldState.status} -> ${newState.status}`);
            if (newState.status == VoiceConnectionStatus.Destroyed || newState.status == VoiceConnectionStatus.Disconnected) {
                clearTimeout(this.connections.get(channel.guildId)?.pipeMode?.timer);
                this.connections.delete(channel.guildId);
            }
        })
    }

    /**
     * Mixed connection
     * @deprecated
     */
    async _connectToVoiceChannel(channel: VoiceBasedChannel, interaction: CommandInteraction) {
        let connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator
        })
        await entersState(connection, VoiceConnectionStatus.Ready, 30).catch(() => {
            interaction.followUp({
                ephemeral: true,
                content: "Error joining channel!"
            })
        }).then(() => {
            if (!channel) return;
            interaction.followUp({
                ephemeral: true,
                content: `Joined channel ${channel?.name}`
            })
        })

        var mixer = new AudioMixer.Mixer({
            channels: 2,
            sampleRate: 48000,
            bitDepth: 16
        });

        this.connections.set(channel.guildId, {
            guildId: channel.guildId,
            player: new VoiceAudioPlayer(connection),
            connection: connection
        });


        connection.on("stateChange", (oldState, newState) => {
            console.log(`Voice connection state changed: ${oldState.status} -> ${newState.status}`);
            if (newState.status == VoiceConnectionStatus.Destroyed || newState.status == VoiceConnectionStatus.Disconnected) {
                this.connections.delete(channel.guildId);
            }
        })
    }

    /**
     * @deprecated
     */
    _play (player: AudioPlayer) {
        var mixer = new AudioMixer.Mixer({
            channels: 2,
            sampleRate: 48000,
            
        });
        
        const opusEncoder = new prism.opus.Encoder({
            rate: 48000,
            channels: 2,
            frameSize: 960
        });
        

        let mixed = new PassThrough();
        mixer.on("end", () => {
            console.log("end");
        })

        let resource = createAudioResource(mixer as any
            , {inputType: StreamType.Raw}
        );
        player.play(resource);
    }
}