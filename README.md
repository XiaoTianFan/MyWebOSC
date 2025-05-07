# MyWebOSC

This project provides a web-based interface to send OSC (Open Sound Control) messages, featuring device gyro and hand tracking gesture as controls, bridging the communication via a WebSocket server. It consists of two main components: a Node.js WebSocket-to-OSC bridge server and a React/TypeScript web application controller.

## Components

1.  **`osc-bridge-server`**:
    *   A Node.js server that listens for incoming WebSocket connections.
    *   It translates messages received via WebSockets into OSC messages and sends them to a configured OSC target (e.g., a Max/MSP patch, SuperCollider, etc.).
    *   It uses the `ws` library for WebSocket communication and `osc-js` for OSC messaging.
    *   It appears to be configured for secure WebSocket connections (WSS) using provided SSL certificates (`example.com+6*.pem`).

2.  **`web-osc-controller`**:
    *   A React/TypeScript web application built using Vite.
    *   Provides a user interface in the browser to construct and send OSC messages.
    *   Connects to the `osc-bridge-server` via a WebSocket connection.
    *   Uses the `osc-js` library to handle OSC message formatting before sending them through the WebSocket.

## Prerequisites

*   Node.js and npm (or yarn) installed.
*   An OSC-enabled application running to receive messages (e.g., Max/MSP, Processing, SuperCollider).

## Setup

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <repository-url>
    cd MyWebOSC
    ```

2.  **Install dependencies for the bridge server:**
    ```bash
    cd osc-bridge-server
    npm install
    cd ..
    ```

3.  **Install dependencies for the web controller:**
    ```bash
    cd web-osc-controller
    npm install
    cd ..
    ```

## Configuration

1.  **Bridge Server (`osc-bridge-server/bridge-server.js`):**
    *   The server can be configured via command-line arguments when launching `bridge-server.js`.
        *   `node bridge-server.js [BRIDGE_SERVER_PORT] [TARGET_OSC_PORT]`
        *   `[BRIDGE_SERVER_PORT]`: (Optional) The port the HTTPS/WebSocket server will listen on. Defaults to `8081`.
        *   `[TARGET_OSC_PORT]`: (Optional) The UDP port of the target OSC application. Defaults to `9000`.
        *   The `TARGET_OSC_HOST` defaults to `localhost` and is set within the script.
    *   Example: To run the server on port 8888 and send OSC messages to port 9999 on localhost:
        ```bash
        node bridge-server.js 8888 9999
        ```
    *   If no arguments are provided, it will use the default ports.
    *   SSL certificate paths (`example.com+6-key.pem`, `example.com+6.pem`) are defined inside `bridge-server.js` and should be placed in the `osc-bridge-server` directory. **Note:** The provided certificates are likely for testing/example purposes only and should be replaced for production use.

2.  **Web Controller (`web-osc-controller/src/App.tsx`):**
    *   Modify the `serverUrl` state variable to match the address and port of your running `osc-bridge-server`. Ensure the protocol (`ws://` or `wss://`) matches the server configuration.
    ```typescript
    // Example line in src/App.tsx
    const [serverUrl, setServerUrl] = useState<string>('wss://YOUR_BRIDGE_SERVER_IP:8081');
    ```

## Running the Application

1.  **Start the OSC Bridge Server:**
    *   Navigate to the server directory:
        ```bash
        cd osc-bridge-server
        ```
    *   Run the server script (see Configuration section for port options):
        ```bash
        # Example using default ports
        node bridge-server.js
        # Example using custom ports
        # node bridge-server.js 8888 9999
        ```
    *   Keep this terminal window open.

2.  **Running Multiple Bridge Server Instances (Optional):**
    *   If you need to forward OSC messages to different target applications or manage different sets of clients, you can run multiple instances of the bridge server.
    *   **Crucially, each instance must listen on a unique `BRIDGE_SERVER_PORT`.**
    *   Open a new terminal for each additional server instance.
    *   Example:
        *   Instance 1 (e.g., for Max/MSP on port 9000):
            ```bash
            # Terminal 1
            cd osc-bridge-server
            node bridge-server.js 8081 9000 
            ```
        *   Instance 2 (e.g., for Processing on port 9001):
            ```bash
            # Terminal 2
            cd osc-bridge-server
            node bridge-server.js 8082 9001
            ```
    *   Remember to configure the `serverUrl` in your `web-osc-controller` (`src/App.tsx`) to point to the correct WebSocket port (`wss://YOUR_BRIDGE_SERVER_IP:PORT`) for the instance you intend to connect to.

3.  **Start the Web Controller:**
    *   Open a *new* terminal window.
    *   Navigate to the web controller directory:
        ```bash
        cd web-osc-controller
        ```
    *   Start the Vite development server:
        ```bash
        npm run dev
        ```
    *   This will typically open the web application in your default browser (check the terminal output for the exact URL, often `https://localhost:5173` or similar).

4.  **Use the Web Interface:**
    *   **Important Step for Self-Signed Certificates:** Before attempting to connect from the web application, you may need to manually accept the self-signed SSL certificates in your browser:
        1.  Open a new browser tab and navigate to your **bridge server's HTTPS URL**. This is the address and `[BRIDGE_SERVER_PORT]` you started it with (e.g., `https://localhost:8081` or `https://YOUR_BRIDGE_SERVER_IP:8081`).
            *   Your browser will likely show a security warning (e.g., "Your connection is not private", "NET::ERR_CERT_AUTHORITY_INVALID").
            *   Click "Advanced" (or similar, depending on the browser) and choose to "Proceed to [address] (unsafe)". This tells the browser to trust this specific self-signed certificate for this session or permanently (depending on browser behavior).
        2.  If your Vite development server (for the `web-osc-controller`) is also running on HTTPS with a self-signed certificate (e.g., `https://localhost:5173`), repeat the process: open this URL in a new tab and accept its certificate as well.
        3.  This step is necessary because the web application (running on its own origin, e.g., `localhost:5173`) will try to make a secure WebSocket connection (`wss://`) to the bridge server. If the bridge server's certificate isn't trusted by the browser, that connection will fail.
    *   Now, open the web application URL (from the `npm run dev` output, e.g., `https://localhost:5173`) in your browser if it's not already open.
    *   Ensure the `WebSocket Server Url` in the web application's interface matches the address and port of the bridge server instance you want to connect to (e.g., `wss://localhost:8081` or `wss://YOUR_BRIDGE_SERVER_IP:8081`).
    *   Click the "Connect" button (or similar control) in the web interface.
    *   Use the interface to send OSC messages. These messages will be sent to the `osc-bridge-server` via WebSocket, which will then forward them as OSC messages to your target application.

## Key Technologies

*   Node.js
*   React
*   TypeScript
*   Vite
*   WebSockets (`ws` library)
*   OSC (`osc-js` library) 