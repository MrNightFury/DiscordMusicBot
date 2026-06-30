import { AutocompleteInteraction, ChatInputApplicationCommandData, ChatInputCommandInteraction, Client } from "discord.js";

import { Bot } from "./DiscordBot.ts";


export interface Command extends ChatInputApplicationCommandData {
    run: (this: Bot, client: Client, interaction: ChatInputCommandInteraction) => Promise<void> | void;
    autocomplete?: (this: Bot, client: Client, interaction: AutocompleteInteraction) => Promise<void> | void;
}

/**
 * Please dont do that in your projects. Thats pizdec.
 * @param object object to check if it has necessary `Command` interface fields
 * @returns 
 */
export function isCommand(object: any) {
    return "name" in object && typeof object.name == "string"
        && "description" in object && typeof object.description == "string"
        && "run" in object && typeof object.run == "function";
}
