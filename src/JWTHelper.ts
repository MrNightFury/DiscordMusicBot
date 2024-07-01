import { Guild } from "discord.js";
import jwt from "jsonwebtoken";

export interface Token {
    guild: string;
    user: string;
}

export class JWTHelper {
    private static secretKey: jwt.Secret = "asd";

    public static setSecretKey(secretKey: string) {
        this.secretKey = secretKey;
    }

    public static generateToken(guildId: string, userId: string) {
        return jwt.sign({guild: guildId, user: userId} as Token, this.secretKey, {});
    }

    public static verify(token: string): false | Token {
        let decoded;
        try {
            decoded = jwt.verify(token, this.secretKey);
        } catch (err) {
            console.log(err);
            return false;
        }
        if (!decoded) {
            return false;
        } else {
            if (typeof decoded == "string") {
                console.log("Error: " + decoded)
                return false;
            }
            return {
                guild: decoded.guild,
                user: decoded.user
            };
        }
    }
}