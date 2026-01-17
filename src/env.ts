import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
    server: {
        DATABASE_URL: z.string().min(1),
        CORS_ORIGIN: z.string().url().optional(),
        OPENAI_API_KEY: z.string().min(1).optional(),
        GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    },
    client: {
        // public env vars go here with NEXT_PUBLIC_ prefix
    },
    runtimeEnv: {
        DATABASE_URL: process.env.LOCAL_DATABASE_URL,
        CORS_ORIGIN: process.env.CORS_ORIGIN,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    },
});
