import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs'; // Use 'node:' prefix for built-in modules
import path from 'node:path'; // Use 'node:' prefix
import { fileURLToPath } from 'node:url'; // Import necessary function

// Get the directory name in an ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- EDIT THESE LINES ---
// Define paths relative to the config file's directory
// MAKE SURE THESE FILENAMES ARE CORRECT FOR YOUR PROJECT
const certPath = path.resolve(__dirname, './example.com+6.pem'); // Replace with your actual cert filename
const keyPath = path.resolve(__dirname, './example.com+6-key.pem'); // Replace with your actual key filename
// --- END EDIT ---


const httpsConfig = (fs.existsSync(keyPath) && fs.existsSync(certPath))
  ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
  : undefined;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    https: httpsConfig,
    // Optional: Configure host if needed for mobile testing
    // host: '0.0.0.0', // Makes server accessible on your local network
  },
});