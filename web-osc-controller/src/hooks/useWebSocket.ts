import { useState, useRef, useCallback, useEffect } from 'react';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketOptions {
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void; // Allow handling messages if needed later
  reconnectInterval?: number; // Optional: Auto-reconnect interval in ms
  reconnectAttempts?: number; // Optional: Max reconnect attempts
}

interface UseWebSocketReturn {
  status: WebSocketStatus;
  connect: (url: string) => void;
  disconnect: () => void;
  sendMessage: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
}

export function useWebSocket(options?: UseWebSocketOptions): UseWebSocketReturn {
  const { 
    onOpen, 
    onClose, 
    onError, 
    onMessage,
    reconnectInterval = 5000, // Default 5 seconds
    reconnectAttempts = 5      // Default 5 attempts
  } = options || {};

  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttemptCount = useRef<number>(0);
  const reconnectTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const explicitlyClosed = useRef<boolean>(false);

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }
  };

  const handleOpen = useCallback((event: Event) => {
    console.log('WebSocket connected');
    setStatus('connected');
    reconnectAttemptCount.current = 0; // Reset reconnect attempts on successful connection
    clearReconnectTimeout();
    explicitlyClosed.current = false;
    if (onOpen) {
      onOpen(event);
    }
  }, [onOpen]);

  const handleClose = useCallback((event: CloseEvent) => {
    ws.current = null; // Clear the ref
    // Don't auto-reconnect if explicitly closed or if it was a clean close (code 1000)
    if (explicitlyClosed.current || event.code === 1000) {
        console.log('WebSocket disconnected cleanly or explicitly.');
        setStatus('disconnected');
        clearReconnectTimeout();
    } else {
        // Attempt to reconnect on unclean close
        console.warn(`WebSocket closed unexpectedly (code: ${event.code}). Attempting reconnect...`);
        setStatus('connecting'); // Show as connecting during reconnect attempts
        if (reconnectAttemptCount.current < reconnectAttempts) {
            reconnectAttemptCount.current++;
            console.log(`Reconnect attempt ${reconnectAttemptCount.current}/${reconnectAttempts}`);
            reconnectTimeoutId.current = setTimeout(() => {
                if (ws.current?.url) { // Check if url exists before reconnecting
                   connect(ws.current.url); 
                }
            }, reconnectInterval);
        } else {
            console.error(`WebSocket reconnect failed after ${reconnectAttempts} attempts.`);
            setStatus('error'); // Or 'disconnected' after max attempts
        }
    }

    if (onClose) {
      onClose(event);
    }
  }, [onClose, reconnectAttempts, reconnectInterval]); // connect dependency added implicitly below

  const handleError = useCallback((event: Event) => {
    console.error('WebSocket error:', event);
    setStatus('error');
    // Consider attempting reconnect on error as well, similar to handleClose
    // ws.current?.close(); // Optionally close explicitly on error before reconnect attempt
    if (onError) {
      onError(event);
    }
  }, [onError]);

  const handleMessage = useCallback((event: MessageEvent) => {
    // console.log('WebSocket message received:', event.data);
    if (onMessage) {
      onMessage(event);
    }
  }, [onMessage]);

  const connect = useCallback((url: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected.');
      return;
    }
    if (status === 'connecting') {
       console.log('WebSocket connection attempt already in progress.');
       return;
    }

    clearReconnectTimeout(); // Clear any pending reconnect timeouts
    console.log(`Connecting WebSocket to ${url}...`);
    setStatus('connecting');
    explicitlyClosed.current = false;

    try {
      ws.current = new WebSocket(url);
      ws.current.binaryType = 'arraybuffer'; // Important for OSC binary data

      ws.current.onopen = handleOpen;
      ws.current.onclose = handleClose;
      ws.current.onerror = handleError;
      ws.current.onmessage = handleMessage;
    } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setStatus('error');
        // Optionally trigger reconnect logic here too
    }

  }, [handleOpen, handleClose, handleError, handleMessage, status]); // status needed to prevent reconnect loop if already connecting


  const disconnect = useCallback(() => {
    if (ws.current) {
      console.log('Disconnecting WebSocket...');
      explicitlyClosed.current = true;
      clearReconnectTimeout(); // Prevent reconnect attempts after explicit disconnect
      ws.current.close(1000, 'User disconnected'); // Use code 1000 for clean closure
      // Status will be updated to 'disconnected' via the handleClose callback
    } else {
        console.log('WebSocket already disconnected.');
        // Ensure status is consistent if disconnect is called when already disconnected
        if (status !== 'disconnected') {
             setStatus('disconnected');
        }
    }
  }, [status]); // status needed to update state if called while already disconnected

  const sendMessage = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(data);
    } else {
      console.warn('WebSocket not connected. Cannot send message.');
    }
  }, []);

  // Effect for initial setup and cleanup
  useEffect(() => {
    // This effect primarily handles cleanup when the component unmounts
    // or if dependencies controlling the connection lifecycle change (which they don't here).
    // Connection is initiated manually via the connect function.
    return () => {
        clearReconnectTimeout();
        if (ws.current) {
            console.log('Cleaning up WebSocket connection on component unmount...');
            explicitlyClosed.current = true; // Prevent reconnect on unmount cleanup
            ws.current.close(1000, 'Component unmounting');
        }
    };
  }, []); // Empty dependency array means this runs once on mount for cleanup setup

  return { status, connect, disconnect, sendMessage };
} 