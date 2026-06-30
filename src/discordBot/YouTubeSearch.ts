import { youtubeDl } from "youtube-dl-exec";


export interface YouTubeSearchResult {
    id: string;
    title: string;
    duration: number;
    channel: string;
    thumbnail: string;
    url: string;
}

export async function searchYouTube(query: string, maxResults: number = 5): Promise<YouTubeSearchResult[]> {
    const raw: any = await youtubeDl(`ytsearch${maxResults}:${query}`, {
        dumpSingleJson: true,
        flatPlaylist: true,
        noWarnings: true,
        quiet: true,
    } as any);

    const result = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (!result || !Array.isArray(result.entries)) {
        return [];
    }

    return result.entries
        .filter((entry: any) => entry && entry.id)
        .map((entry: any) => ({
            id: entry.id,
            title: entry.title || "Unknown",
            duration: entry.duration || 0,
            channel: entry.channel || entry.uploader || "Unknown",
            thumbnail: entry.thumbnails?.[0]?.url || "",
            url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
        }));
}

export function formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
