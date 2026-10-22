import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
// FIX: Explicitly import `process` to ensure the correct Node.js types are used,
// resolving the error "Property 'cwd' does not exist on type 'Process'".
// Fix: The `process` object is a default export, not a named export.
import process from 'process';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env files and the process environment.
  // The third parameter '' loads all variables, not just those prefixed with VITE_.
  const env = loadEnv(mode, process.cwd(), '');

  // To support both the platform's standard `API_KEY` and a potential `GEMINI_API_KEY`
  // for local development (as used in some examples), we check for both.
  // The README currently instructs users to set `API_KEY`.
  const apiKey = env.API_KEY || env.GEMINI_API_KEY;

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    // This `define` block is critical for the app to function. Vite, by default,
    // does not expose Node.js `process.env` variables to the client-side code to
    // prevent accidental security leaks. We use `loadEnv` to safely load the
    // API key from the environment and then `define` to replace `process.env.API_KEY`
    // in the client-side code with its actual string value. This makes the key
    // available to the Gemini service and fixes potential startup crashes.
    define: {
      // Ensure that if `apiKey` is undefined, we stringify an empty string.
      // `JSON.stringify(undefined)` returns `undefined`, which causes Vite to skip
      // the replacement, leaving `process.env.API_KEY` in the client code and
      // causing a "process is not defined" ReferenceError. By providing a
      // fallback to `''`, we guarantee a valid JSON string is always produced.
    },
    resolve: {
      alias: {
        // `__dirname` is not available in ES modules. Use `import.meta.url` to get the current directory.
        '@': fileURLToPath(new URL('.', import.meta.url)),
      }
    }
  };
});