import { Command } from "./Command.js";
import { loadCommands } from "./Commands/index.js";
import { Config } from "../Config.js";
import { Client, CommandInteraction, GatewayIntentBits, Interaction, VoiceBasedChannel } from "discord.js";
import { Connection } from "./Connection.js";
import { VoiceConnectionStatus, createAudioPlayer, entersState, joinVoiceChannel } from "@discordjs/voice";
import { AudioPlayer } from "./AudioPlayer.js";

export class Bot {
    config: Config;
    client: Client;

    commands: Command[] = [];
    connections: Map<string, Connection> = new Map();

    player = new AudioPlayer(this);

    constructor(config: Config) {
        this.config = config;

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages
            ]
            // intents: 8
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
            // console.log(interaction);
            if (interaction.isCommand()) {
                await this.handleSlashCommand(this.client, interaction);
            }
        })
    }

    async handleSlashCommand(client: Client, interaction: CommandInteraction) {
        console.log(`Recieved command "${interaction.commandName}" from user "${interaction.user.id}"`);
        console.log("Guild: " + interaction.guildId);

        if (!interaction.guildId) return;

        const slashCommand = this.commands.find(c => c.name === interaction.commandName);
        if (!slashCommand) {
            interaction.followUp({ content: "An error has occurred" });
            return;
        }

        await interaction.deferReply();
        slashCommand.run.bind(this)(client, interaction);
    }

    async connectToVoiceChannel(channel: VoiceBasedChannel, interaction: CommandInteraction) {
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
        
        let player = createAudioPlayer();
        connection.subscribe(player);

        this.connections.set(channel.guildId, {
            guildId: channel.guildId,
            player: player,
            connection: connection
        });

        connection.on("stateChange", (oldState, newState) => {
            console.log(`Voice connection state changed: ${oldState.status} -> ${newState.status}`);
            if (newState.status == VoiceConnectionStatus.Destroyed || newState.status == VoiceConnectionStatus.Disconnected) {
                this.connections.delete(channel.guildId);
            }
        })
    }
}