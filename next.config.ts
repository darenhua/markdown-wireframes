import "src/env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    typedRoutes: true,
    reactCompiler: true,
    transpilePackages: ["shiki", "@json-render/core", "@json-render/react"],
    devIndicators: {
        appIsrStatus: false,
        buildActivity: false,
        buildActivityPosition: "bottom-right",
    },
};

export default nextConfig;
