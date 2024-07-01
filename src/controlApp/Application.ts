import cors from "cors";
import bodyParser from "body-parser";
import Express from "express";
import fileUpload from "express-fileupload";

import { Bot } from "../discordBot/DiscordBot.js";
import { HTTPStatus } from "./HTTPStatus.js";
import { Config } from "../Config.js";
import { FileWorker } from "./FileWorker.js";
import { JWTHelper } from "../JWTHelper.js";

export class Application {
    config: Config;
    
    bot: Bot;
    expressApp: Express.Application;

    fileWorker: FileWorker;

    listener: any;

    constructor(config: Config, bot: Bot) {
        this.config = config;
        this.bot = bot;
        this.expressApp = Express();

        this.fileWorker = new FileWorker(this.config.fileStoragePath);

        this.setupHandlers();
    }

    start() {
        this.listener = this.expressApp.listen(this.config.server.port, this.config.server.host, () => {
            console.log(`App listening at port ${this.config.server.port}`);
        });
    }

    setupHandlers() {
        let app = this.expressApp;
        app.use(bodyParser.json());
        app.use(cors({
            origin: "*"
        }));
        app.use(fileUpload({
            createParentPath: true
        }));

        app.get("/sounds", (req, res) => {
            console.log("asd")
            res.status(HTTPStatus.SUCCESS).json(this.fileWorker.getFilesList());
        })

        app.post("/sound", (req, res) => {
            console.log(req.body);
            let guildId = req.body.guildId;
            let sound = req.body.sound;
            let tokenString = req.header("Authorization");
            if (!guildId || !sound || !tokenString) {
                res.status(HTTPStatus.BAD_REQUEST).json({message: `\`${sound ? (tokenString ? "guildId" : "token") : "sound" }\` field is required`});
                return;
            }

            let token = JWTHelper.verify(tokenString);
            if (!token || token.guild != guildId) {
                res.status(HTTPStatus.UNAUTHORIZED).json({message: "Incorrect token"});
                return;
            }

            if (this.bot.player.playSound(guildId, sound)) {
                res.status(HTTPStatus.SUCCESS).json({message: "Success"});
            } else {
                res.status(HTTPStatus.IM_A_TEAPOT).json({message: "Something went wrong. Try to guess what exactly!"});
            }
        })

        app.post("/sounds/add", (req, res) => {
            if (!req.files || !req.files.sound) {
                res.status(HTTPStatus.BAD_REQUEST).json({message: "`sound` file is not uploaded"});
                return;
            }
            if (Array.isArray(req.files.sound)) {
                res.status(HTTPStatus.BAD_REQUEST).json({message: "`sound` must be a single file"});
                return;
            }
            
            let fileName = req.files.sound.name.split('.');
            if (fileName[fileName.length - 1] != "wav") {
                res.status(HTTPStatus.BAD_REQUEST).json({message: "Sound must have .mp3 extension"});
                return;
            }

            req.files.sound.mv(this.config.fileStoragePath + "/" + req.body.name + ".mp3").then(() => {
                res.status(HTTPStatus.SUCCESS).json({message: "Sound uploaded"});
                return;
            })
        })

        app.get("/sounds", (req, res) => {
            
        })
    }
}