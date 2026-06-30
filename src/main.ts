import { bootstrap } from "global-agent";
import { ProxyAgent, setGlobalDispatcher } from "undici";

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection (suppressed):", reason);
});

const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
if (proxyUrl) {
    process.env.GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE = "";
    bootstrap();
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log("Proxy enabled:", proxyUrl);
}

import { Bot } from "./discordBot/DiscordBot.ts";
import { loadConfig } from "./Config.ts";
import { Application } from "./controlApp/Application.ts";
import { FileWorker } from "./FileWorker.ts";


let config = loadConfig();
console.log("Loaded config", {
    server: config.server,
    fileStoragePath: config.fileStoragePath,
    prefix: config.bot.prefix,
    pipeModeMaxTimeMinutes: config.bot.pipeModeMaxTimeMinutes
});

let fileWorker = new FileWorker(config.fileStoragePath);

console.log("Creating bot...");
let bot = new Bot(fileWorker, config);
console.log("Setting up bot...");
await bot.init();

console.log("Creating server...");
let app = new Application(bot, fileWorker, config);
console.log("Setting up server...");
app.start();