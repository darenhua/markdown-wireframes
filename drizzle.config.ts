import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
    path: "./src/.env",
});

// For migrations, default to LOCAL_DATABASE_URL
// Use PROD_DATABASE_URL only if explicitly running against prod
const dbUrl =
    process.env.DRIZZLE_DB_ENV === "prod"
        ? process.env.PROD_DATABASE_URL
        : process.env.LOCAL_DATABASE_URL;

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./src/db/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: dbUrl || "",
    },
});
