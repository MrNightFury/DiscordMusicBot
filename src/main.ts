import { Bot } from "./discordBot/DiscordBot.js";
import { loadConfig } from "./Config.js";
import { Application } from "./controlApp/Application.js";

let config = loadConfig();

console.log("Creating bot...");
let bot = new Bot(config);
console.log("Setting up bot...");
await bot.init();

console.log("Creating server...");
let app = new Application(config, bot);
console.log("Setting up server...");
app.start();