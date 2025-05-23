import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import OSC from 'osc-js'; // Reverted to standard import
// import * as OSC from 'osc-js'; // Removed incorrect import
// import reactLogo from './assets/react.svg' // Removed default logo
// import viteLogo from '/vite.svg' // Removed default logo
import './App.css'
import { useWebSocket, WebSocketStatus } from './hooks/useWebSocket'
import { ControlSettingsDialog } from './components/ControlSettingsDialog'; // Import the dialog
import { SliderControl } from './components/SliderControl'; // Import Slider
import { ButtonControl } from './components/ButtonControl'; // Import Button
import { ToggleControl } from './components/ToggleControl'; // Import Toggle
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'; // Import dnd components
import { throttle } from './utils/throttle'; // Import throttle utility
import HandTrackingController, { HandTrackingOscAddresses } from './components/HandTrackingController'; // Added Hand Tracking

// Define types for better type safety (optional but recommended with TypeScript)
interface ControlConfig {
  id: string;
  type: 'slider' | 'button' | 'toggle'; // Add more types as needed
  label: string;
  address: string;
  options?: any; // Specific options based on type (e.g., min, max for slider)
  appearance?: any; // Specific appearance options (e.g., color)
}

interface SensorConfig {
  orientation: string;
  acceleration: string;
  // Add more sensor types if needed
}

// Type for storing rounded sensor data for display
interface OrientationData {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}
interface AccelerationData {
  x: number | null;
  y: number | null;
  z: number | null;
}

// type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error'; // Moved to hook

// Constants
const SENSOR_THROTTLE_INTERVAL = 50; // ms (e.g., 10 updates per second)

function App() {
  // Core state variables
  const [controls, setControls] = useState<ControlConfig[]>([]);
  const [sensorConfig, setSensorConfig] = useState<SensorConfig>({
    orientation: '/phone/orientation',
    acceleration: '/phone/acceleration'
  });
  const [isSendingSensors, setIsSendingSensors] = useState<boolean>(false);
  const [webSocketStatus, setWebSocketStatus] = useState<WebSocketStatus>('disconnected'); // Local state reflects hook status
  const [serverUrl, setServerUrl] = useState<string>('wss://10.228.253.140:8081'); // Default WebSocket bridge URL
  const [sensorPermissionStatus, setSensorPermissionStatus] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown');

  // State for displaying sensor data
  const [orientationData, setOrientationData] = useState<OrientationData>({ alpha: null, beta: null, gamma: null });
  const [accelerationData, setAccelerationData] = useState<AccelerationData>({ x: null, y: null, z: null });

  // State for control settings dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [controlBeingEdited, setControlBeingEdited] = useState<ControlConfig | null>(null);

  // --- Hand Tracking State ---
  const [isHandTrackingActive, setIsHandTrackingActive] = useState<boolean>(false);
  const [handTrackingStatus, setHandTrackingStatus] = useState<string>("Idle");
  const [handTrackingOscConfig, setHandTrackingOscConfig] = useState<HandTrackingOscAddresses>({
    position: '/hand/position',
    velocity: '/hand/velocity',
    acceleration: '/hand/acceleration',
    gesture: '/hand/gesture',
    landmarks: '/hand/landmarks' // Optional: to send all landmarks
  });
  const [sendRawLandmarks, setSendRawLandmarks] = useState<boolean>(false);
  const [handThrottleInterval, setHandThrottleInterval] = useState<number>(100);

  // --- P5.js Sketch Config State (removed) ---
  // const [showP5Video, setShowP5Video] = useState<boolean>(false); 

  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Instantiate the WebSocket hook
  const { 
    status: wsStatus, 
    connect: wsConnect, 
    disconnect: wsDisconnect, 
    sendMessage: wsSendMessage 
  } = useWebSocket();

  // Keep local status synchronized with the hook's status
  useEffect(() => {
    setWebSocketStatus(wsStatus);
  }, [wsStatus]);

  // OSC Sending function using osc-js and the hook
  const sendOsc = useCallback((address: string, args: any[]) => {
      if (webSocketStatus !== 'connected') {
          // console.warn("WebSocket not connected. Cannot send OSC message."); // Warning logged in hook
          return;
      }
      try {
        const oscMessage = new OSC.Message(address, ...args);
        const binaryMsg = oscMessage.pack(); // Pack message into Uint8Array
        
        // We need to send this binary data via the WebSocket.
        // The hook's sendMessage expects ArrayBufferLike.
        // A Uint8Array's buffer is an ArrayBuffer, which fits.
        wsSendMessage(binaryMsg.buffer); 
        
        // console.log(`Sending OSC: ${address}`, args); // Optional: Log successful send
      } catch (error) {
          console.error("Failed to create or pack OSC message:", error);
      }
  }, [webSocketStatus, wsSendMessage]);

  // --- Memoize Config for HandTrackingController ---
  const handTrackingConfig = useMemo(() => ({
    throttleInterval: handThrottleInterval,
    sendRawLandmarks: sendRawLandmarks,
    // showP5Video: showP5Video, // Removed
    // p5CanvasWidth: p5CanvasWidth, 
    // p5CanvasHeight: p5CanvasHeight
  }), [handThrottleInterval, sendRawLandmarks]); // Removed showP5Video dependency

  // --- Sensor Logic --- 

  // Memoize the throttled handler functions using useCallback and useMemo
  // to ensure they are stable across re-renders unless dependencies change.

  const throttledOrientationHandler = useMemo(() => 
      throttle((alpha: number, beta: number, gamma: number) => {
          setOrientationData({ alpha, beta, gamma });
          sendOsc(sensorConfig.orientation, [alpha, beta, gamma]);
      }, SENSOR_THROTTLE_INTERVAL)
  , [sendOsc, sensorConfig.orientation]); // Dependencies for the inner function

  const throttledMotionHandler = useMemo(() => 
      throttle((x: number, y: number, z: number) => {
          setAccelerationData({ x, y, z });
          sendOsc(sensorConfig.acceleration, [x, y, z]);
      }, SENSOR_THROTTLE_INTERVAL)
  , [sendOsc, sensorConfig.acceleration]); // Dependencies for the inner function

  // Raw event handlers just extract data and call throttled versions
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const alpha = event.alpha !== null ? Math.round(event.alpha) : null;
    const beta = event.beta !== null ? Math.round(event.beta) : null;
    const gamma = event.gamma !== null ? Math.round(event.gamma) : null;
    // Only call throttled handler if data is valid
    if (alpha !== null && beta !== null && gamma !== null) {
        throttledOrientationHandler(alpha, beta, gamma);
    }
  }, [throttledOrientationHandler]);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
      if (event.accelerationIncludingGravity && 
          event.accelerationIncludingGravity.x !== null &&
          event.accelerationIncludingGravity.y !== null && 
          event.accelerationIncludingGravity.z !== null) { 
         
         const x = Math.round(event.accelerationIncludingGravity.x * 10) / 10;
         const y = Math.round(event.accelerationIncludingGravity.y * 10) / 10;
         const z = Math.round(event.accelerationIncludingGravity.z * 10) / 10;
         // Call throttled handler
         throttledMotionHandler(x, y, z);
      } else {
         // Optional: If motion stops sending valid data, maybe send one last message or clear display?
         // setAccelerationData({ x: null, y: null, z: null }); // Consider if needed 
      }
  }, [throttledMotionHandler]);

  // Effect to add/remove raw listeners (no change needed here)
  useEffect(() => {
    if (isSendingSensors) {
      console.log("Adding sensor listeners");
      window.addEventListener('deviceorientation', handleOrientation);
      window.addEventListener('devicemotion', handleMotion);
    } else {
      console.log("Removing sensor listeners");
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('devicemotion', handleMotion);
      setOrientationData({ alpha: null, beta: null, gamma: null });
      setAccelerationData({ x: null, y: null, z: null });
    }
    return () => {
      console.log("Cleaning up sensor listeners");
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isSendingSensors, handleOrientation, handleMotion]);

  // Check for permission API on component mount (or when relevant state changes)
  useEffect(() => {
    // Check if the permission API exists (primarily for iOS Safari 13+)
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function' || 
        typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            // Assume we need to prompt if the API exists but we haven't explicitly granted
            // (This is a simplification; real-world might check Permissions API if available)
            if (sensorPermissionStatus === 'unknown') {
                 setSensorPermissionStatus('prompt');
            }
    } else {
      // If the API doesn't exist, assume permissions are granted (non-iOS browsers usually)
      setSensorPermissionStatus('granted');
    }
  }, [sensorPermissionStatus]);


  // Updated handler for the toggle button
  const handleToggleSensorSending = async () => {
    if (isSendingSensors) {
      // If currently sending, just stop
      setIsSendingSensors(false);
    } else {
      // If not sending, try to start (requesting permission if needed)
      let orientationGranted = false;
      let motionGranted = false;

      // --- Request Orientation Permission (iOS 13+) ---
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          console.log("Requesting Orientation Permission...");
          const permissionState = await (DeviceOrientationEvent as any).requestPermission();
          if (permissionState === 'granted') {
            orientationGranted = true;
            setSensorPermissionStatus('granted'); // Update overall status if needed
            console.log("Orientation Permission Granted");
          } else {
            console.warn("Orientation Permission Denied");
            setSensorPermissionStatus('denied');
            alert('Device Orientation permission was denied. Please grant it in your browser settings if you want to use this feature.');
          }
        } catch (error) { // Catches potential errors during the request itself
          console.error("Error requesting orientation permission:", error);
          alert(`Error requesting orientation permission: ${error}`);
           setSensorPermissionStatus('denied'); // Assume denied on error
        }
      } else {
        // Assume granted if API doesn't exist
        orientationGranted = true;
        if(sensorPermissionStatus !== 'granted') setSensorPermissionStatus('granted');
      }

      // --- Request Motion Permission (iOS 13+) --- 
      // Only proceed if orientation was potentially granted (or not needed)
      if (orientationGranted) { 
          if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            try {
              console.log("Requesting Motion Permission...");
              const permissionState = await (DeviceMotionEvent as any).requestPermission();
              if (permissionState === 'granted') {
                motionGranted = true;
                setSensorPermissionStatus('granted'); // Update overall status
                console.log("Motion Permission Granted");
              } else {
                console.warn("Motion Permission Denied");
                setSensorPermissionStatus('denied');
                alert('Device Motion permission was denied. Please grant it in your browser settings if you want to use this feature.');
              }
            } catch (error) {
              console.error("Error requesting motion permission:", error);
              alert(`Error requesting motion permission: ${error}`);
              setSensorPermissionStatus('denied'); // Assume denied on error
            }
          } else {
             // Assume granted if API doesn't exist
             motionGranted = true;
             if(sensorPermissionStatus !== 'granted') setSensorPermissionStatus('granted');
          }
      }

      // --- Start Sending if All Permissions Granted ---
      if (orientationGranted && motionGranted) {
        setIsSendingSensors(true); 
      } else {
          // If permissions were required but not granted, ensure we stay in the off state
          setIsSendingSensors(false);
      }
    }
  };

  // --- End Sensor Logic ---

  // Keep the definitions for control handlers HERE
  const handleAddControl = (newControl: ControlConfig) => {
    setControls(prev => [...prev, newControl]);
  };
  const handleRemoveControl = (controlId: string) => {
    setControls(prev => prev.filter(control => control.id !== controlId));
  };
  const handleUpdateControl = (updatedControl: ControlConfig) => {
    setControls(prev => prev.map(control => control.id === updatedControl.id ? updatedControl : control));
  };

  // Dialog open/close handlers
  const openAddDialog = () => {
      setControlBeingEdited(null); // Ensure we are adding, not editing
      setIsDialogOpen(true);
  };

  const openEditDialog = (control: ControlConfig) => {
      setControlBeingEdited(control);
      setIsDialogOpen(true);
  };

  const closeDialog = () => {
      setIsDialogOpen(false);
      setControlBeingEdited(null); // Clear editing state when closing
  };

  // Save handler passed to the dialog
  const handleSaveControl = (savedControl: ControlConfig) => {
      if (controlBeingEdited) {
          handleUpdateControl(savedControl);
      } else {
          handleAddControl(savedControl);
      }
      // Dialog calls its own onClose, which eventually calls closeDialog here if passed correctly
  };

  // Keep the definitions for WebSocket connection logic HERE
  const connectWebSocket = () => {
    wsConnect(serverUrl);
  };
  const disconnectWebSocket = () => {
    wsDisconnect();
  };

  // --- Drag and Drop Handler ---
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // If dropped outside the list or in the same position
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return;
    }

    // Find the dragged control
    const draggedControl = controls.find(c => c.id === draggableId);
    if (!draggedControl) return; // Should not happen

    // Create a new ordered array
    const newControls = Array.from(controls);
    newControls.splice(source.index, 1); // Remove item from original position
    newControls.splice(destination.index, 0, draggedControl); // Insert item at new position

    setControls(newControls);
  };

  // --- Import/Export Logic ---

  const handleExportLayout = () => {
    const layoutToExport = {
      controls,
      sensorConfig,
      handTrackingOscConfig,
      sendRawLandmarks,
      handThrottleInterval,
      // showP5Video // Removed from export
    };
    const jsonString = JSON.stringify(layoutToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'osc-controller-layout.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const handleImportButtonClick = () => {
    // Trigger the hidden file input
    fileInputRef.current?.click();
  };

  const handleImportLayout = (event: React.ChangeEvent<HTMLInputElement>) => { // Renamed for clarity
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          if (typeof text === 'string') {
            const importedLayout = JSON.parse(text);
            if (importedLayout.controls) { // Add more validation as needed
              setControls(importedLayout.controls);
            }
            if (importedLayout.sensorConfig) {
              setSensorConfig(importedLayout.sensorConfig);
            }
            // Import hand tracking config if present
            if (importedLayout.handTrackingOscConfig) {
              setHandTrackingOscConfig(importedLayout.handTrackingOscConfig);
            }
            if (typeof importedLayout.sendRawLandmarks === 'boolean') {
              setSendRawLandmarks(importedLayout.sendRawLandmarks);
            }
            if (typeof importedLayout.handThrottleInterval === 'number') {
              setHandThrottleInterval(importedLayout.handThrottleInterval);
            }
            // Removed import of showP5Video
            // if (typeof importedLayout.showP5Video === 'boolean') {
            //   setShowP5Video(importedLayout.showP5Video);
            // }

            alert('Layout imported successfully!');
          }
        } catch (error) {
          console.error('Failed to import layout:', error);
          alert('Failed to import layout. Make sure it is a valid JSON file.');
        }
      };
      reader.readAsText(file);
    }
    // Reset file input to allow importing the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Helper to update hand tracking OSC addresses
  const handleHandOscConfigChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setHandTrackingOscConfig(prev => ({ ...prev, [name]: value }));
  };

  // --- End Import/Export Logic ---

  // Helper function to render the correct control component
  const renderControl = (control: ControlConfig) => {
      switch (control.type) {
          case 'slider':
              return (
                  <SliderControl 
                      key={control.id} 
                      control={control} 
                      sendOsc={sendOsc}
                      onEdit={openEditDialog}
                      onRemove={handleRemoveControl}
                  />
              );
          case 'button':
              return (
                  <ButtonControl 
                      key={control.id}
                      control={control}
                      sendOsc={sendOsc}
                      onEdit={openEditDialog}
                      onRemove={handleRemoveControl}
                  />
              );
          case 'toggle':
              return (
                  <ToggleControl 
                      key={control.id}
                      control={control}
                      sendOsc={sendOsc}
                      onEdit={openEditDialog}
                      onRemove={handleRemoveControl}
                  />
              );
          default:
              console.warn(`Unsupported control type: ${control.type}`);
              return (
                  <div key={control.id} className="control-placeholder" style={{borderColor: 'red'}}>
                     Unsupported control type: {control.type}
                     <button onClick={() => openEditDialog(control)} style={{marginLeft: '10px', fontSize: '0.8em'}}>Edit</button>
                     <button onClick={() => handleRemoveControl(control.id)} style={{marginLeft: '5px', fontSize: '0.8em'}}>Remove</button>
                 </div>
              ); 
      }
  };

  return (
    <div className="app-container">
      {/* Header/Status Area */}
      <header className="app-header">
        <h1>Web OSC Controller</h1>
        <div className="status-section">
          <span>WebSocket: {webSocketStatus}</span>
          {webSocketStatus !== 'connected' && <button onClick={connectWebSocket} disabled={webSocketStatus === 'connecting'}>Connect</button>}
          {webSocketStatus === 'connected' && <button onClick={disconnectWebSocket}>Disconnect</button>}
          {/* Add Server URL input later */}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Sensor Panel - Updated */} 
        <section className="panel sensor-panel">
          <h2>Sensors</h2>
          {sensorPermissionStatus === 'denied' && (
              <p style={{color: 'red'}}>Sensor permissions denied. Please check browser settings.</p>
          )}
          {/* Show toggle button only if permissions are granted or needed */} 
          {(sensorPermissionStatus === 'granted' || sensorPermissionStatus === 'prompt') && (
              <button 
                  onClick={handleToggleSensorSending} 
                   // Simplified disabled condition: only disable if sending AND websocket isn't connected.
                   // Permission state is handled by the conditional rendering above.
                  disabled={isSendingSensors && webSocketStatus !== 'connected'} 
              >
                  {isSendingSensors ? 'Stop Sending Sensors' : 
                   (sensorPermissionStatus === 'prompt' ? 'Enable & Start Sending Sensors' : 'Start Sending Sensors')}
              </button>
          )}
          {isSendingSensors && webSocketStatus !== 'connected' && (
               <p style={{color: 'orange'}}>Warning: WebSocket not connected. Sensor data is not being sent.</p>
          )}
          
          <p>Status: {isSendingSensors ? 'Sending' : 'Off'} {sensorPermissionStatus !== 'granted' && `(Permissions: ${sensorPermissionStatus})`}</p>
          
           {/* Sensor configuration display */} 
           {/* <div>Orientation Address: {sensorConfig.orientation}</div>
           <div>Acceleration Address: {sensorConfig.acceleration}</div> */} 

           {/* Sensor data display */}
           <div className="sensor-data-display">
               <h4>Orientation (alpha, beta, gamma):</h4>
               <p>{orientationData.alpha ?? '-'}, {orientationData.beta ?? '-'}, {orientationData.gamma ?? '-'}</p>
               <h4>Acceleration (x, y, z):</h4>
               <p>{accelerationData.x ?? '-'}, {accelerationData.y ?? '-'}, {accelerationData.z ?? '-'}</p>
           </div>
        </section>

        {/* Control Panel - Wrapped with DragDropContext */} 
        <DragDropContext onDragEnd={handleDragEnd}>
            <section className="panel control-panel" style={{ display: 'flex', flexDirection: 'column' }}> {/* Ensure panel uses flex column */} 
              <h2>Controls</h2>
              {/* Droppable area for controls */} 
              <Droppable droppableId="controlsDroppable">
                  {(provided) => (
                      <div 
                          {...provided.droppableProps} 
                          ref={provided.innerRef} 
                          style={{ flexGrow: 1, minHeight: '100px' }} // Allow dropping even when empty
                      >
                          {controls.length === 0 && <p>No controls added yet. Drag controls here!</p>}
                          
                          {/* Map controls to Draggable components */} 
                          {controls.map((control, index) => (
                              <Draggable key={control.id} draggableId={control.id} index={index}>
                                  {(provided) => (
                                      <div 
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps} // Attach drag handle props here
                                      >
                                          {/* Render the actual control component */} 
                                          {renderControl(control)}
                                      </div>
                                  )}
                              </Draggable>
                          ))}
                          {provided.placeholder} {/* Placeholder for spacing during drag */} 
                      </div>
                  )}
              </Droppable>
              
               {/* Button to add controls (Place outside Droppable, but inside section) */} 
               <button onClick={openAddDialog} style={{ marginTop: 'auto', paddingTop: '10px'}}> 
                 + Add Control
               </button>
            </section>
        </DragDropContext>

        {/* Settings Panel Placeholder */}
        <section className="panel settings-panel">
          <h2>Settings</h2>
           {/* WebSocket URL Input */}
      <div>
              <label htmlFor="serverUrlInput">WebSocket Server URL: </label>
              <input
                id="serverUrlInput"
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                disabled={webSocketStatus !== 'disconnected'} 
              />
           </div>
           {/* Import/Export Buttons */}
           <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
               <button onClick={handleImportButtonClick}>Import Layout (JSON)</button>
               <button onClick={handleExportLayout}>Export Layout (JSON)</button>
      </div>
            {/* Hidden file input for import */}
            <input 
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }} 
                accept=".json,application/json" // Accept only JSON files
                onChange={handleImportLayout}
            />
        </section>

        {/* -- Hand Tracking Section -- */}
        <div className="config-section">
          <h3>Hand Tracking (Webcam)</h3>
          <button onClick={() => setIsHandTrackingActive(!isHandTrackingActive)}
                  className={isHandTrackingActive ? 'active' : ''}>
            {isHandTrackingActive ? 'Stop Hand Tracking' : 'Start Hand Tracking'}
          </button>
          <p>Status: {handTrackingStatus}</p>
          <div>
            <label>
              Position OSC Address:
              <input type="text" name="position" value={handTrackingOscConfig.position} onChange={handleHandOscConfigChange} />
            </label>
          </div>
          <div>
            <label>
              Velocity OSC Address:
              <input type="text" name="velocity" value={handTrackingOscConfig.velocity} onChange={handleHandOscConfigChange} />
            </label>
          </div>
          <div>
            <label>
              Gesture OSC Address:
              <input type="text" name="gesture" value={handTrackingOscConfig.gesture} onChange={handleHandOscConfigChange} />
            </label>
          </div>
           <div>
            <label>
              All Landmarks OSC Address (Optional):
              <input type="text" name="landmarks" value={handTrackingOscConfig.landmarks || ''} onChange={handleHandOscConfigChange} />
            </label>
          </div>
          <div>
            <label>
                <input
                    type="checkbox"
                    checked={sendRawLandmarks}
                    onChange={(e) => setSendRawLandmarks(e.target.checked)}
                />
                Send All Raw Landmarks (if address specified)
            </label>
          </div>
           <div>
            <label>
              Throttle Interval (ms):
              <input
                type="number"
                value={handThrottleInterval}
                onChange={(e) => setHandThrottleInterval(Math.max(20, parseInt(e.target.value, 10) || 50))}
                step="10"
                min="20"
              />
            </label>
          </div>
        </div>

        {/* -- Spacer --*/}
        <div style={{height: "20px"}}></div>

        <button onClick={openAddDialog} className="add-control-btn">Add Control</button>
      </main>

      {/* Hand Tracking Controller (Rendered conditionally but always part of React tree for hook) */}
      {isHandTrackingActive && ( // Only mount and run when active
        <HandTrackingController
            isActive={isHandTrackingActive}
            sendOsc={sendOsc}
            oscAddresses={handTrackingOscConfig}
            onStatusUpdate={setHandTrackingStatus}
            config={handTrackingConfig} // Config no longer contains showP5Video
        />
      )}

      {/* Render the Dialog */} 
      <ControlSettingsDialog 
          isOpen={isDialogOpen}
          onClose={closeDialog} 
          onSave={handleSaveControl}
          controlToEdit={controlBeingEdited}
      />

      {/* Footer (Optional) */}
      {/* <footer className="app-footer">
        <p>Footer Content</p>
      </footer> */}
      </div>
  )
}

export default App
