// types.ts

/**
 * Interface for Suno music generation arguments
 */
export interface SunoMusicRequestArgs {
    /**
     * Lyrics content. Required for custom mode.
     * @example "[Verse 1]\nUnder the starry sky, with a guitar in hand, I sing an old song from my homeland"
     */
    prompt: string;

    /**
     * Music style tags, comma-separated. Required for custom mode.
     * @example "acoustic, folk, spanish"
     */
    tags: string;

    /**
     * Song title. Required for custom mode.
     * @example "Homeland Song"
     */
    title: string;

    /**
     * Model version. Optional.
     * @enum ["chirp-v3-0", "chirp-v3-5", "chirp-v4"]
     * @default "chirp-v4"
     */
    mv?: "chirp-v3-0" | "chirp-v3-5" | "chirp-v4";

    /**
     * Whether to generate instrumental music. Optional.
     * @default false
     */
    make_instrumental?: boolean;

    /**
     * Optional. Description for inspiration mode.
     * @example "A sad song about a rainy day"
     */
    gpt_description_prompt?: string;

     /**
     * Optional. Task ID to continue from.
     */
    task_id?: string;

    /**
     * Optional. Time in seconds to continue from.
     */
    continue_at?: number;

    /**
     * Optional. Clip ID to continue from.
     */
    continue_clip_id?: string;
}

/**
 * Interface for Suno API audio data
 */
export interface SunoAudioData {
    id: string;
    title: string;
    status: string; // e.g., "streaming", "complete"
    metadata: {
        tags?: string;
        prompt?: string;
        duration?: number | null;
        error_type?: string | null;
        error_message?: string | null;
        audio_prompt_id?: string | null;
        gpt_description_prompt?: string;
    };
    audio_url: string; // This is the key field we need
    image_url?: string;
    video_url?: string;
    model_name?: string;
    image_large_url?: string;
    major_model_version?: string;
}

/**
 * Interface for Suno API response data object
 */
export interface SunoApiResponseData {
    task_id: string;
    notify_hook?: string;
    action: "MUSIC" | "LYRICS";
    status: "IN_PROGRESS" | "COMPLETE" | "PENDING" | "SUBMITTED" | "FAILED"; // Added more statuses
    fail_reason?: string | null;
    submit_time: number;
    start_time?: number;
    finish_time?: number;
    progress?: string;
    data: SunoAudioData[];
}

/**
 * Interface for Suno API submit music response
 */
export interface SunoApiSubmitResponse {
    code: string; // "success" or error code
    message?: string;
    data: string; // This is the task_id string for the submit response
}

/**
 * Interface for Suno API fetch task status response
 */
export interface SunoApiFetchResponse {
    code: string; // "success" or error code
    message?: string;
    data: SunoApiResponseData; // For fetching a single task, this is the task data object itself
}


/**
 * Validates arguments for the generate_music tool
 * @param {any} args - The arguments to validate
 * @returns {boolean} - Whether the arguments are valid
 */
export function isValidSunoMusicRequestArgs(args: any): args is SunoMusicRequestArgs {
    if (!args || typeof args !== 'object') return false;

    // Custom mode: prompt, tags, title are required
    if (!args.gpt_description_prompt) {
        if (typeof args.prompt !== 'string' || args.prompt.trim() === '') return false;
        if (typeof args.tags !== 'string' || args.tags.trim() === '') return false;
        if (typeof args.title !== 'string' || args.title.trim() === '') return false;
    } else { // Inspiration mode: gpt_description_prompt is required
        if (typeof args.gpt_description_prompt !== 'string' || args.gpt_description_prompt.trim() === '') return false;
        // In inspiration mode, prompt, tags, title might be optional or not used by the API directly
    }


    if (args.mv !== undefined && !["chirp-v3-0", "chirp-v3-5", "chirp-v4"].includes(args.mv)) return false;
    if (args.make_instrumental !== undefined && typeof args.make_instrumental !== 'boolean') return false;

    // Validate continuation parameters if present
    const hasTaskId = args.task_id !== undefined && typeof args.task_id === 'string' && args.task_id.trim() !== '';
    const hasContinueAt = args.continue_at !== undefined && typeof args.continue_at === 'number' && args.continue_at >= 0;
    const hasContinueClipId = args.continue_clip_id !== undefined && typeof args.continue_clip_id === 'string' && args.continue_clip_id.trim() !== '';

    if (hasTaskId || hasContinueAt || hasContinueClipId) {
        // If any continuation param is present, all three must be present
        if (!(hasTaskId && hasContinueAt && hasContinueClipId)) {
            return false;
        }
    }

    return true;
}