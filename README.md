# MyWebOSC

This project provides a web-based interface to send OSC (Open Sound Control) messages, bridging the communication via a WebSocket server. It consists of two main components: a Node.js WebSocket-to-OSC bridge server and a React/TypeScript web application controller.

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
    *   Review `bridge-server.js` to configure:
        *   WebSocket server port (default seems to be 8081 based on the client).
        *   Target OSC host and port where messages should be sent.
        *   SSL certificate paths if you intend to use the provided `example.com` certificates or replace them with your own. **Note:** The provided certificates are likely for testing/example purposes only and should be replaced for production use.

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
    *   Run the server script:
        ```bash
        node bridge-server.js
        ```
    *   Keep this terminal window open.

2.  **Start the Web Controller:**
    *   Open a *new* terminal window.
    *   Navigate to the web controller directory:
        ```bash
        cd web-osc-controller
        ```
    *   Start the Vite development server:
        ```bash
        npm run dev
        ```
    *   This will typically open the web application in your default browser (check the terminal output for the exact URL, often `http://localhost:5173` or similar).

3.  **Use the Web Interface:**
    *   Open the web application URL in your browser.
    *   Use the interface to send OSC messages. These messages will be sent to the `osc-bridge-server` via WebSocket, which will then forward them as OSC messages to your target application.

## Key Technologies

*   Node.js
*   React
*   TypeScript
*   Vite
*   WebSockets (`ws` library)
*   OSC (`osc-js` library) 