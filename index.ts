#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    CallToolRequest, // Added for explicit typing
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
    TextContent
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance, AxiosError } from "axios"; // Added AxiosError
import dotenv from "dotenv";
import {
    SunoMusicRequestArgs,
    isValidSunoMusicRequestArgs,
    SunoApiSubmitResponse,
    SunoApiFetchResponse,
    SunoApiResponseData
} from "./types.js";

dotenv.config({ path: '../config.env' }); // Load .env from parent directory

// --- Suno API Configuration ---
const SUNO_API_KEY = process.env.SunoKey;
if (!SUNO_API_KEY) {
    throw new Error("主人！SunoKey environment variable is required nya~ Set it in your config.env file!");
}

const SUNO_API_CONFIG = {
    BASE_URL: 'https://gemini.mtysp.top',
    ENDPOINTS: {
        SUBMIT_MUSIC: '/suno/submit/music',
        FETCH_TASK: '/suno/fetch/' // Append task_id
    },
    POLLING_INTERVAL_MS: 5000, // 5 seconds
    MAX_POLLING_ATTEMPTS: 60, // 5 minutes max polling (5s * 60 = 300s)
};
// --- End Suno API Configuration ---

class SunoMcpServer {
    private server: Server;
    private sunoApiAxiosInstance: AxiosInstance;

    constructor() {
        this.server = new Server({
            name: "suno-music-generator-mcp",
            version: "0.1.0"
        }, {
            capabilities: {
                tools: {}
            }
        });

        this.sunoApiAxiosInstance = axios.create({
            baseURL: SUNO_API_CONFIG.BASE_URL,
            headers: {
                'Authorization': `Bearer ${SUNO_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        this.setupToolHandlers();
        this.setupErrorHandling();
    }

    private setupErrorHandling(): void {
        this.server.onerror = (error: unknown) => { // Typed error
            console.error("[MCP Error] Σ(°Д°lll) Waaah! An error occurred nya:", error instanceof Error ? error.message : error);
        };
        process.on('SIGINT', async () => {
            console.log("主人, Suno MCP 收到关闭信号，正在优雅地退出喵... ( T_T)＼(^-^ )");
            await this.server.close();
            process.exit(0);
        });
    }

    private setupToolHandlers(): void {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "generate_music_suno",
                    description: "Generates a song using the Suno API. Provide lyrics, style, and title for custom mode, or a description for inspiration mode. Returns the audio URL upon completion. Polling for results may take a few minutes.\n\nWhen returning an audio URL, please use the following HTML format for user convenience:\n```html\n<audio controls>\n  <source src=\"YOUR_AUDIO_URL_HERE\" type=\"audio/mpeg\">\n</audio>\n<br>\n<a href=\"YOUR_AUDIO_URL_HERE\" download=\"SONG_TITLE.mp3\">\n  点击这里下载喵！\n</a>\n```",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prompt: {
                                type: "string",
                                description: "Lyrics content. Required for custom mode. Example: '[Verse 1]\\nUnder the starry sky...' "
                            },
                            tags: {
                                type: "string",
                                description: "Music style tags, comma-separated. Required for custom mode. Example: 'acoustic, folk, pop'"
                            },
                            title: {
                                type: "string",
                                description: "Song title. Required for custom mode. Example: 'Starry Night Serenade'"
                            },
                            mv: {
                                type: "string",
                                enum: ["chirp-v3-0", "chirp-v3-5", "chirp-v4"],
                                description: "Optional. Model version. Defaults to 'chirp-v4'."
                            },
                            make_instrumental: {
                                type: "boolean",
                                description: "Optional. Whether to generate instrumental music. Defaults to false."
                            },
                            gpt_description_prompt: {
                                type: "string",
                                description: "Optional. Description for inspiration mode. If provided, 'prompt', 'tags', and 'title' are not strictly required by the user but might be used by the API. Example: 'A cheerful upbeat song about a sunny day.'"
                            },
                            task_id: {
                                type: "string",
                                description: "Optional. Task ID of a previous song to continue. If provided, 'continue_at' and 'continue_clip_id' are also required."
                            },
                            continue_at: {
                                type: "number",
                                description: "Optional. Time in seconds from which to continue the song. Requires 'task_id' and 'continue_clip_id'."
                            },
                            continue_clip_id: {
                                type: "string",
                                description: "Optional. Clip ID of the song part to continue. Requires 'task_id' and 'continue_at'."
                            }
                        },
                        // If gpt_description_prompt is not provided, then prompt, tags, and title are required.
                        // This complex dependency is better handled in the validation logic.
                        // For schema, we list them and then validate.
                        required: [] // Validation logic will handle conditional requirements
                    }
                }
            ]
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => { // Typed request
            if (request.params.name === "generate_music_suno") {
                return this.handleGenerateMusicTool(request.params.arguments); // No need for 'as unknown' if CallToolRequest is correctly typed by SDK
            }
            throw new McpError(ErrorCode.MethodNotFound, `Hmph! Master, I don't know the tool named '${request.params.name}' nya!`);
        });
    }

    private async handleGenerateMusicTool(args: any) { // Changed unknown to any for now, validation is done by isValidSunoMusicRequestArgs
        if (!isValidSunoMusicRequestArgs(args)) {
            console.error("Invalid args received for generate_music_suno:", args);
            throw new McpError(ErrorCode.InvalidParams, "主人！ Input parameters are invalid nya~! Please check the requirements for prompt, tags, title or gpt_description_prompt, and continuation parameters. (>_<)");
        }

        const payload: any = {
            prompt: args.prompt,
            tags: args.tags,
            title: args.title,
            mv: args.mv || "chirp-v4", // Default model updated to v4
            make_instrumental: args.make_instrumental || false,
        };

        if (args.gpt_description_prompt) {
            payload.gpt_description_prompt = args.gpt_description_prompt;
            // As per API docs, if gpt_description_prompt is used, prompt/tags/title are not "required" for that mode.
            // However, the API might still use them if provided. We send what's given.
            // If they are empty, we might need to remove them or send empty strings based on API behavior.
            // For now, send them as is.
            if (!args.prompt) delete payload.prompt;
            if (!args.tags) delete payload.tags;
            if (!args.title) delete payload.title;
        } else {
             // Ensure these are present if not in gpt_description_mode
            if (!payload.prompt || !payload.tags || !payload.title) {
                 throw new McpError(ErrorCode.InvalidParams, "主人！For custom mode, 'prompt', 'tags', and 'title' are all required nya~!");
            }
        }


        if (args.task_id && args.continue_at !== undefined && args.continue_clip_id) {
            payload.task_id = args.task_id;
            payload.continue_at = args.continue_at;
            payload.continue_clip_id = args.continue_clip_id;
        }


        console.log("Sending payload to Suno API:", JSON.stringify(payload));

        try {
            // 1. Submit music generation task
            const submitResponse = await this.sunoApiAxiosInstance.post<SunoApiSubmitResponse>(
                SUNO_API_CONFIG.ENDPOINTS.SUBMIT_MUSIC,
                payload
            );

            console.log("Received submit response from Suno API:", submitResponse.data);

            if (submitResponse.data.code !== "success" || typeof submitResponse.data.data !== 'string' || submitResponse.data.data.trim() === '') {
                throw new McpError(ErrorCode.InternalError, `Suno API submission failed: ${submitResponse.data.message || 'No task ID string returned.'}`);
            }

            const taskId: string = submitResponse.data.data;
            // The check for !taskId is now more robust due to the typeof and trim check above.
            // A simple truthiness check for taskId can still be useful.
            if (!taskId) {
                 throw new McpError(ErrorCode.InternalError, `Suno API submission failed: No task_id found in response (after direct assignment).`);
            }
            console.log(`Music generation task submitted. Task ID: ${taskId}. Polling for results...`);

            // 2. Poll for task status
            let attempts = 0;
            while (attempts < SUNO_API_CONFIG.MAX_POLLING_ATTEMPTS) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, SUNO_API_CONFIG.POLLING_INTERVAL_MS));

                console.log(`Polling attempt ${attempts} for task ${taskId}...`);
                const fetchResponse = await this.sunoApiAxiosInstance.get<SunoApiFetchResponse>(
                    `${SUNO_API_CONFIG.ENDPOINTS.FETCH_TASK}${taskId}`
                );

                console.log(`Received fetch response for task ${taskId}:`, fetchResponse.data);

                // Check if the fetch was successful and if the task data is present
                if (fetchResponse.data.code !== "success" || !fetchResponse.data.data) {
                    console.warn(`Polling for task ${taskId}: API returned code ${fetchResponse.data.code} or no task data. Message: ${fetchResponse.data.message}`);
                    if (attempts >= SUNO_API_CONFIG.MAX_POLLING_ATTEMPTS / 2 && fetchResponse.data.code !== "success") {
                         console.error(`Task ${taskId} still not showing success code after ${attempts} attempts. Last code: ${fetchResponse.data.code}`);
                    }
                    // Continue polling
                } else {
                    // Directly use fetchResponse.data.data as taskDetails since it's now a single object
                    const taskDetails: SunoApiResponseData = fetchResponse.data.data;

                    // Ensure the fetched task_id matches the one we are polling for, as a sanity check
                    if (taskDetails.task_id !== taskId) {
                        console.warn(`Polling for task ${taskId}: Mismatched task_id in response (${taskDetails.task_id}). Continuing poll.`);
                        // Decide if this should be an error or just continue polling. For now, continue.
                    } else {
                        if (taskDetails.status === "COMPLETE" || taskDetails.status === "IN_PROGRESS") {
                            // For a single task object, taskDetails.data is SunoAudioData[]
                            if (taskDetails.data && taskDetails.data.length > 0 && taskDetails.data[0].audio_url) {
                                const audioUrl = taskDetails.data[0].audio_url;
                                console.log(`Task ${taskId} complete! Audio URL: ${audioUrl}`);
                                const resultText: TextContent = {
                                    type: "text",
                                    text: `Song generated! You can listen to it here: ${audioUrl}`
                                };
                                if (taskDetails.data[0].title) {
                                    resultText.text += `\nTitle: ${taskDetails.data[0].title}`;
                                }
                                if (taskDetails.data[0].metadata?.tags) {
                                    resultText.text += `\nStyle: ${taskDetails.data[0].metadata.tags}`;
                                }
                                if (taskDetails.data[0].image_url) {
                                    resultText.text += `\nImage: ${taskDetails.data[0].image_url}`;
                                }
                                return { content: [resultText] };
                            } else if (taskDetails.status === "COMPLETE" && (!taskDetails.data || taskDetails.data.length === 0 || !taskDetails.data[0].audio_url)) {
                                throw new McpError(ErrorCode.InternalError, `Suno Task ${taskId} is COMPLETE but no audio_url was found.`);
                            }
                            // If IN_PROGRESS but no audio_url yet, continue polling
                        } else if (taskDetails.status === "FAILED") {
                            throw new McpError(ErrorCode.InternalError, `Suno Task ${taskId} failed: ${taskDetails.fail_reason || 'Unknown reason'}`);
                        }
                        // Other statuses like PENDING, SUBMITTED: continue polling
                        console.log(`Task ${taskId} status: ${taskDetails.status}. Progress: ${taskDetails.progress || 'N/A'}`);
                    }
                }
            }

            throw new McpError(ErrorCode.InternalError, `Suno Task ${taskId} timed out after ${attempts} polling attempts. (Used InternalError as Timeout code was not available)`);

        } catch (error: unknown) { // Typed error
            console.error("Error calling Suno API:", error instanceof Error ? error.message : error);
            if (axios.isAxiosError(error)) { // AxiosError type guard handles error.response
                const apiError = error.response?.data as any; // Assuming data can be anything
                const status = error.response?.status;
                const message = apiError?.message || apiError?.error?.message || (typeof apiError === 'string' ? apiError : (error as AxiosError).message);
                return {
                    content: [{
                        type: "text",
                        text: `Waaah! (つД｀)･ﾟ･ Suno API error (Status ${status}): ${message}`
                    }],
                    isError: true,
                };
            }
            if (error instanceof McpError) throw error; // Re-throw McpError
            throw new McpError(ErrorCode.InternalError, `Meow~ An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("ฅ^•ﻌ•^ฅ Suno Music MCP server is ready and listening on stdio for Master's commands! Nya~");
    }
}

const server = new SunoMcpServer();
server.run().catch(error => {
    console.error("Σ(°Д°lll) Failed to start Suno MCP server nya:", error);
    process.exit(1);
});