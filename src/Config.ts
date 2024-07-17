import dotenv from "dotenv";


export interface Config {
    bot: BotConfig;
    server: ServerConfig;
    fileStoragePath: string;
}

export interface BotConfig {
    token: string;
    prefix: string;
    pipeModeMaxTimeMinutes: number;
}

export interface ServerConfig {
    host: string;
    port: number;
}

export function loadConfig() {
    dotenv.config();
    let config = {
        bot: {
            token: process.env.TOKEN || "",
            prefix: process.env.PREFIX || "/",
            pipeModeMaxTimeMinutes: process.env.PIPE_MODE_MAX_TIME || 10
        },
        server: {
            host: "localhost",
            port: 80
        },
        fileStoragePath: process.env.STORAGE_PATH || "./storage"
    } as Config;
    return config;
}