const https = require('https');
const fs = require('fs');
const WebSocket = require('ws'); // Re-add ws library
const OSC = require('osc-js');

// --- Configuration ---
const BRIDGE_SERVER_PORT = 8081;
const TARGET_OSC_HOST = 'localhost';
const TARGET_OSC_PORT = 9000;

// --- HTTPS Certificate Paths ---
const HTTPS_OPTIONS = {
  key: fs.readFileSync('./example.com+6-key.pem'), // Make sure these paths are correct
  cert: fs.readFileSync('./example.com+6.pem')
};
// --- End Configuration ---

console.log("Starting OSC Bridge Server (Manual WS + UDP Forwarding)...");

// Create HTTPS server
const server = https.createServer(HTTPS_OPTIONS, (req, res) => {
  res.writeHead(200);
  res.end('OSC Bridge Server (Manual Forwarding) is running. Connect via WebSocket.');
});

// Remove the WebSocket upgrade listener, ws library handles this internally when passed the server
/*
server.on('upgrade', (request, socket, head) => {
    console.log('!!! HTTPS Server received WebSocket upgrade request from:', request.socket.remoteAddress);
});
*/

// Configure OSC for UDP Sending ONLY (we handle unpack manually)
const oscUdpSender = new OSC({
    plugin: new OSC.DatagramPlugin({
        send: {
            host: TARGET_OSC_HOST,
            port: TARGET_OSC_PORT
        }
    })
});


// --- Manually Create WebSocket Server --- 
const wss = new WebSocket.Server({ server: server }); // Attach ws to our HTTPS server

console.log(`Manual WebSocket server attached to HTTPS on port ${BRIDGE_SERVER_PORT}`);

// --- WebSocket Server Event Listeners --- 
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`WebSocket client connected from: ${clientIp}`);

    // Handle messages from this specific client
    ws.on('message', (message) => {
        if (message instanceof Buffer) {
            const dataView = new DataView(
                message.buffer.slice(
                    message.byteOffset,
                    message.byteOffset + message.byteLength
                )
            );
            
            try {
                // 1. Unpack the received data
                const unpackedMessage = new OSC.Message();
                unpackedMessage.unpack(dataView); 

                // Optional log of what was received
                // console.log(`Unpacked from WebSocket [${clientIp}]:`, JSON.stringify(unpackedMessage));

                // 2. Extract address and arguments
                const address = unpackedMessage.address;
                const args = unpackedMessage.args;

                // 3. Create a NEW message object with extracted data (Workaround)
                const messageToSend = new OSC.Message(address, ...args);

                // 4. Send the NEW message object via UDP
                oscUdpSender.send(messageToSend);
                
            } catch (error) {
                // Log errors during unpack or processing
                console.error(`*** Error processing OSC message from [${clientIp}]:`, error);
                // Correctly log the raw buffer causing the error
                console.error('>>> Raw Buffer causing error:', message);
            }
        } else {
            console.log(`Received non-binary message from [${clientIp}]:`, message);
        }
    });

    // Handle disconnection for this client
    ws.on('close', (code, reason) => {
        console.log(`WebSocket client disconnected from [${clientIp}]. Code: ${code}, Reason: ${reason}`);
    });

    // Handle errors for this client
    ws.on('error', (error) => {
        console.error(`WebSocket client error from [${clientIp}]:`, error);
    });
});

wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});

wss.on('close', () => {
    console.log('WebSocket Server closed.');
});


// --- UDP Sender Listeners --- 
oscUdpSender.on('open', () => {
    console.log(`DatagramPlugin (UDP Sender) is ready to send to ${TARGET_OSC_HOST}:${TARGET_OSC_PORT}.`);
});
oscUdpSender.on('error', (err) => {
    console.error("DatagramPlugin (UDP Sender) Error:", err);
});
oscUdpSender.on('close', () => {
    console.log('DatagramPlugin (UDP Sender) closed.');
});


// Start the HTTPS server
server.listen(BRIDGE_SERVER_PORT, () => {
    console.log(`HTTPS server is listening on ${BRIDGE_SERVER_PORT}. Opening UDP sender...`);
    // Only need to open the UDP sender plugin now
    // oscWsServer.open(); // Removed
    oscUdpSender.open(); // Opens the underlying UDP socket needed for sending
});

// Handle HTTPS server errors
server.on('error', (error) => {
    console.error("HTTPS Server error:", error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Error: Port ${BRIDGE_SERVER_PORT} for WebSocket server is already in use.`);
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    
    // Close the UDP sender first
    oscUdpSender.close(); 
    
    // Close the WebSocket server
    wss.close(() => {
        console.log('Manual WebSocket server closed.');
        // Once WSS is closed, close the HTTPS server
        server.close(() => {
            console.log('HTTPS server closed.');
            process.exit(0);
        });
    });

    // Set a timeout in case closing hangs
    setTimeout(() => {
        console.warn("Shutdown timeout, forcing exit.");
        process.exit(1);
    }, 5000);
});
