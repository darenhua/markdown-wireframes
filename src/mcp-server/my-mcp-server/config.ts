import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Relative path from this MCP server to the outputs directory
export const OUTPUTS_PATH = path.resolve(__dirname, "../../../outputs");
