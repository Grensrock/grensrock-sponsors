import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The CLI writes a Deno edge-runtime entrypoint here when the local stack
    // starts. It is generated, gitignored, and not ours — but it is TypeScript
    // in the project root, so without this `npm run lint` gains 180-odd errors
    // the moment anyone runs `npm run db:start`.
    "supabase/.temp/**",
    // Worktrees created for background tasks live inside the repo, so linting
    // the root would otherwise lint every checkout of it twice over.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
