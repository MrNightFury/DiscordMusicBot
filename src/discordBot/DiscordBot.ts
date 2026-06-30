import prism from "prism-media";
import AudioMixer from "audio-mixer";
import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Client, GatewayIntentBits, Interaction, StringSelectMenuInteraction, VoiceBasedChannel } from "discord.js";
import { AudioPlayer, StreamType, VoiceConnectionStatus, createAudioResource, entersState, joinVoiceChannel } from "@discordjs/voice";

import { Command } from "./Command.ts";
import { loadCommands } from "./Commands/index.ts";
import { Config } from "../Config.ts";
import { Connection } from "./Connection.ts";
import * as AP from "./AudioPlayer.ts";
import { PassThrough } from "node:stream";
import { VoiceAudioPlayer } from "./VoiceAudioPlayer.ts";
import { PlayTryResult } from "./VoiceAudioPlayer.ts";
import { FileWorker } from "../FileWorker.ts";

function buildLoopButtonRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("loop_toggle")
            .setEmoji("🔁")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("playback_stop")
            .setEmoji("⏹️")
            .setLabel("Stop")
            .setStyle(ButtonStyle.Danger)
    );
}


export class Bot {
    config: Config;
    client: Client;
    fileWorker: FileWorker;

    commands: Command[] = [];
    connections: Map<string, Connection> = new Map();

    private readonly ALONE_TIMEOUT_MS = 5 * 60 * 1000;

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

        await this.client.login(this.config.bot.token).catch((err) => {
            console.error("Failed to login to Discord:", err.message || err);
            throw err;
        });
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
            try {
                if (interaction.isChatInputCommand()) {
                    await this.handleSlashCommand(this.client, interaction);
                } else if (interaction.isButton()) {
                    await this.handleButtonClick(this.client, interaction);
                } else if (interaction.isStringSelectMenu()) {
                    await this.handleSelectMenu(this.client, interaction);
                } else if (interaction.isAutocomplete()) {
                    await this.handleAutocomplete(this.client, interaction);
                }
            } catch (err) {
                console.error("Unhandled interaction error:", err);
            }
        })

        this.client.on("voiceStateUpdate", (_, newState) => {
            this.updateAloneTimer(newState.guild.id);
        });
    }

    private countNonBotMembersInChannel(guildId: string): number {
        const connection = this.connections.get(guildId);
        if (!connection) {
            return 0;
        }

        const channelId = connection.connection.joinConfig.channelId;
        if (!channelId) {
            return 0;
        }

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) {
            return 0;
        }

        return guild.voiceStates.cache.filter((voiceState) => {
            return voiceState.channelId === channelId && !voiceState.member?.user.bot;
        }).size;
    }

    private clearAloneTimer(connection?: Connection) {
        if (!connection?.aloneDisconnectTimer) {
            return;
        }

        clearTimeout(connection.aloneDisconnectTimer);
        connection.aloneDisconnectTimer = undefined;
    }

    private updateAloneTimer(guildId: string) {
        const connection = this.connections.get(guildId);
        if (!connection) {
            return;
        }

        const nonBotMembers = this.countNonBotMembersInChannel(guildId);
        if (nonBotMembers > 0) {
            this.clearAloneTimer(connection);
            return;
        }

        if (connection.aloneDisconnectTimer) {
            return;
        }

        connection.aloneDisconnectTimer = setTimeout(() => {
            const activeConnection = this.connections.get(guildId);
            if (!activeConnection) {
                return;
            }

            const stillAlone = this.countNonBotMembersInChannel(guildId) === 0;
            if (!stillAlone) {
                this.clearAloneTimer(activeConnection);
                return;
            }

            clearTimeout(activeConnection.pipeMode?.timer);
            activeConnection.connection.destroy();
        }, this.ALONE_TIMEOUT_MS);
    }

    async handleSlashCommand(client: Client, interaction: ChatInputCommandInteraction) {
        console.log(`Recieved command "${interaction.commandName}" from user "${interaction.user.id}" in guild "${interaction.guildId}"`);

        if (!interaction.guildId) return;

        const slashCommand = this.commands.find(c => c.name === interaction.commandName);
        if (!slashCommand) {
            this.safeRespond(interaction, { content: "An error has occurred" });
            return;
        }

        try {
            await interaction.deferReply({ ephemeral: true });
        } catch (err: any) {
            if (err?.code === 10062 || err?.status === 404) {
                console.warn(`Interaction expired before defer (command: ${interaction.commandName})`);
            } else {
                console.error(`Failed to defer reply for "${interaction.commandName}":`, err);
            }
            return;
        }

        try {
            await slashCommand.run.bind(this)(client, interaction);
        } catch (err) {
            console.error(`Command "${interaction.commandName}" failed:`, err);
            this.safeRespond(interaction, { content: "Error while executing command" });
        }
    }

    private safeRespond(interaction: ChatInputCommandInteraction, options: { content: string }) {
        const action = interaction.deferred
            ? interaction.editReply(options)
            : interaction.reply({ ...options, ephemeral: true });
        action.catch((err: any) => {
            if (err?.code === 10062 || err?.status === 404) {
                console.warn(`Interaction expired (command: ${interaction.commandName})`);
            } else {
                console.error(`Failed to respond to "${interaction.commandName}":`, err);
            }
        });
    }

    async handleAutocomplete(client: Client, interaction: AutocompleteInteraction) {
        console.log(`Recieved autocomplete interaction "${interaction.commandName}" from user "${interaction.user.id}" in guild "${interaction.guildId}"`)
        if (!interaction.guildId) return;

        const slashCommand = this.commands.find(c => c.name === interaction.commandName);
        if (!slashCommand || !slashCommand.autocomplete) {
            interaction.respond([{ name: "Error", value: "Error" }]);
            return;
        }
        await slashCommand.autocomplete.bind(this)(client, interaction);
    }

    async handleButtonClick(client: Client, interaction: ButtonInteraction) {
        let id = interaction.customId;
        console.log("Button id:", id);

        if (id === "loop_toggle") {
            const connection = this.connections.get(interaction.guildId || "");
            if (!connection) {
                await interaction.reply({ content: "❌ Not connected to a voice channel.", ephemeral: true });
                return;
            }
            const newLoopState = connection.player.toggleLoop();
            await interaction.reply({
                content: newLoopState ? "🔁 Loop ON" : "➡️ Loop OFF",
                ephemeral: true,
            });
            return;
        }

        if (id === "playback_stop") {
            const stopped = this.player.stop(interaction.guildId || "");
            if (!stopped) {
                await interaction.reply({ content: "❌ Not connected to a voice channel.", ephemeral: true });
                return;
            }

            await interaction.reply({
                content: "⏹️ Playback stopped. Bot disconnected.",
                ephemeral: true,
            });
            return;
        }

        if (id) {
            this.player.playSound(interaction.guildId || "", id);
            await interaction.deferUpdate();
        }
    }

    async handleSelectMenu(client: Client, interaction: StringSelectMenuInteraction) {
        if (interaction.customId !== "youtube_search") return;

        const videoId = interaction.values[0];
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const guildId = interaction.guildId || "";

        const connection = this.connections.get(guildId);
        if (!connection) {
            await interaction.reply({ content: "Not connected to a voice channel. Use /join or /search first.", ephemeral: true });
            return;
        }

        await interaction.reply({ content: `⏬ Downloading...`, ephemeral: true });

        try {
            let file = await this.fileWorker.downloadFile(url);

            if (interaction.channel?.isSendable()) {
                connection.lastCommandChannel = interaction.channel;
            }

            let result = this.player.playSound(guildId, file, true);
            switch (result) {
                case PlayTryResult.Played:
                    await interaction.editReply({ content: "▶️ Now playing!" });
                    break;
                case PlayTryResult.Queued:
                    await interaction.editReply({ content: "📋 Added to queue!" });
                    break;
                case PlayTryResult.BlockedBySong:
                    await interaction.editReply({ content: "⚠️ Cannot play while a song is playing." });
                    break;
                default:
                    await interaction.editReply({ content: "❌ Failed to play track." });
                    break;
            }
        } catch (err) {
            console.error("Download/play failed:", err);
            await interaction.editReply({ content: "❌ Failed to download or play track." }).catch(() => {});
        }
    }

    async connectToVoiceChannel(channel: VoiceBasedChannel, interaction: ChatInputCommandInteraction) {
        let voiceConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator
        })

        voiceConnection.on("stateChange", (oldState, newState) => {
            console.log(`[VOICE] State: ${oldState.status} -> ${newState.status}`, newState.status === VoiceConnectionStatus.Connecting ? JSON.stringify(newState.networkingState) : "");
        });

        voiceConnection.on("error", (err) => {
            console.log("[VOICE] Connection error:", err.message, err.stack);
        });

        const networking = voiceConnection.state?.networking;
        if (networking) {
            networking.on("error", (err) => {
                console.log("[VOICE] Networking error:", err.message, err.stack);
            });
        }

        console.log("[VOICE] Initial state:", voiceConnection.state.status);

        try {
            console.log("[VOICE] Waiting for Ready state (30s timeout)...");
            await entersState(voiceConnection, VoiceConnectionStatus.Ready, 30_000);
            console.log("[VOICE] Connected successfully!");
        } catch (text) {
            console.log("[VOICE] Error joining voice channel:", text);
            console.log("[VOICE] Final state:", voiceConnection.state.status);
            if (voiceConnection.state.networkingState) {
                console.log("[VOICE] Networking state:", JSON.stringify(voiceConnection.state.networkingState));
            }
            await interaction.followUp({
                ephemeral: true,
                content: "Error joining channel!"
            });
            voiceConnection.destroy();
            return;
        }

        await interaction.followUp({
            ephemeral: true,
            content: `Joined channel ${channel.name}`
        });

        let conn = {
            guildId: channel.guildId,
            connection: voiceConnection,
        } as Connection;
        conn.player = new VoiceAudioPlayer(conn, voiceConnection);
        conn.player.onSongStart = (songTitle: string) => {
            conn.lastCommandChannel?.send({
                content: `Now playing:\n> ${songTitle}`,
                components: [buildLoopButtonRow()],
            });
        };
        this.connections.set(channel.guildId, conn);
        this.updateAloneTimer(channel.guildId);

        voiceConnection.on("stateChange", (oldState, newState) => {
            console.log(`Voice connection state changed: ${oldState.status} -> ${newState.status}`);
            if (newState.status == VoiceConnectionStatus.Destroyed || newState.status == VoiceConnectionStatus.Disconnected) {
                this.clearAloneTimer(this.connections.get(channel.guildId));
                clearTimeout(this.connections.get(channel.guildId)?.pipeMode?.timer);
                this.connections.delete(channel.guildId);
            }
        })
    }

    /**
     * Mixed connection
     * @deprecated
     */
    async _connectToVoiceChannel(channel: VoiceBasedChannel, interaction: ChatInputCommandInteraction) {
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

        let conn = {
            guildId: channel.guildId,
            connection: connection
        } as Connection;
        conn.player = new VoiceAudioPlayer(conn, connection);
        this.connections.set(channel.guildId, conn);
        this.updateAloneTimer(channel.guildId);


        connection.on("stateChange", (oldState, newState) => {
            console.log(`Voice connection state changed: ${oldState.status} -> ${newState.status}`);
            if (newState.status == VoiceConnectionStatus.Destroyed || newState.status == VoiceConnectionStatus.Disconnected) {
                this.clearAloneTimer(this.connections.get(channel.guildId));
                clearTimeout(this.connections.get(channel.guildId)?.pipeMode?.timer);
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
