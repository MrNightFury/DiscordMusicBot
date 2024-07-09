import dotenv from "dotenv";

export interface Config {
    bot: BotConfig;
    server: ServerConfig;
    fileStoragePath: string;
}

export interface BotConfig {
    token: string;
    prefix: string;
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
            prefix: process.env.PREFIX || "/"
        },
        server: {
            host: "localhost",
            port: 80
        },
        fileStoragePath: process.env.STORAGE_PATH || "./storage"
    } as Config;
    return config;
}