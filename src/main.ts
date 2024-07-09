import { Bot } from "./discordBot/DiscordBot.js";
import { loadConfig } from "./Config.js";
import { Application } from "./controlApp/Application.js";
import { FileWorker } from "./FileWorker.js";

let config = loadConfig();
console.log("Loaded config: ", config);

let fileWorker = new FileWorker(config.fileStoragePath);

console.log("Creating bot...");
let bot = new Bot(fileWorker, config);
console.log("Setting up bot...");
await bot.init();

console.log("Creating server...");
let app = new Application(bot, fileWorker, config);
console.log("Setting up server...");
app.start();