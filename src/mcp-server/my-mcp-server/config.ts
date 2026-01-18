import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the outputs directory inside this MCP server project
// Goes up from dist/ to project root, then into outputs/
export const OUTPUTS_PATH = path.resolve(__dirname, "../outputs");
