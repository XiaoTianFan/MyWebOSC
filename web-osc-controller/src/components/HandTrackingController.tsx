// web-osc-controller/src/components/HandTrackingController.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import P5HandSketch, { DerivedHandData } from './P5HandSketch';
import { throttle } from '../utils/throttle'; // Assuming this path, adjust if necessary

// TypeScript declaration for the global ml5 object
declare global {
  interface Window {
    ml5: any;
  }
}

export interface HandTrackingOscAddresses {
  position: string;
  velocity: string;
  acceleration: string;
  gesture: string;
  landmarks?: string; // Optional: to send all landmarks
}

interface HandTrackingControllerProps {
  isActive: boolean;
  sendOsc: (address: string, args: any[]) => void;
  oscAddresses: HandTrackingOscAddresses;
  onStatusUpdate: (message: string) => void;
  config?: { // Optional configuration for the controller
    throttleInterval?: number; // ms
    sendRawLandmarks?: boolean; // Flag to send all landmarks
    p5CanvasWidth?: number;
    p5CanvasHeight?: number;
  }
}

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface HandData {
  position: Landmark | null;
  velocity: Landmark | null;
  acceleration: Landmark | null;
  gesture: number | null; // 0 for open, 1 for closed (example)
  timestamp: number;
}

const HandTrackingController: React.FC<HandTrackingControllerProps> = ({
  isActive,
  sendOsc,
  oscAddresses,
  onStatusUpdate,
  config = {}
}) => {
  const {
    throttleInterval = 50,
    sendRawLandmarks = false,
    p5CanvasWidth = 320,
    p5CanvasHeight = 240
  } = config;

  // State for displaying received data
  const [displayedPosition, setDisplayedPosition] = useState<string>("N/A");
  const [lastGestureDisplay, setLastGestureDisplay] = useState<string>("N/A");
  const [parsedCoords, setParsedCoords] = useState<{x: number, y: number, z: number} | null>(null); // New state for raw coords

  // Refs for calculating velocity and acceleration
  const lastPositionRef = useRef<{ data: Landmark, timestamp: number } | null>(null);
  const lastVelocityRef = useRef<{ data: Landmark, timestamp: number } | null>(null);
  const lastGestureRef = useRef<number | null>(null);
  const clearStateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for clearing timeout

  // Throttled OSC senders (re-instantiate based on new data flow)
  const throttledSendPosition = useCallback(throttle((x, y, z) => {
    sendOsc(oscAddresses.position, [x, y, z]);
  }, throttleInterval), [sendOsc, oscAddresses.position, throttleInterval]);

  const throttledSendVelocity = useCallback(throttle((vx, vy, vz) => {
    sendOsc(oscAddresses.velocity, [vx, vy, vz]);
  }, throttleInterval), [sendOsc, oscAddresses.velocity, throttleInterval]);

  const throttledSendAcceleration = useCallback(throttle((ax, ay, az) => {
    sendOsc(oscAddresses.acceleration, [ax, ay, az]);
  }, throttleInterval), [sendOsc, oscAddresses.acceleration, throttleInterval]);

  const sendGesture = useCallback((gestureState: number) => {
    sendOsc(oscAddresses.gesture, [gestureState]);
  }, [sendOsc, oscAddresses.gesture]);

  // Raw landmarks sending can be decided here too, if P5 sketch sends all landmarks
  const throttledSendAllLandmarks = useCallback(throttle((landmarks: any[]) => {
    if (oscAddresses.landmarks) {
      const flatLandmarks = landmarks.flat();
      sendOsc(oscAddresses.landmarks, flatLandmarks);
    }
  }, throttleInterval), [sendOsc, oscAddresses.landmarks, throttleInterval]);

  // Gesture determination logic (new 4-state pinch version)
  const determineHandGesture = useCallback((keypoints: any[]): number => {
    // console.log("DetermineGesture: Received keypoints:", keypoints?.length);
    if (!keypoints || keypoints.length < 21) return -1; 

    const findKp = (name: string): {x: number, y: number} | null => {
        const kp = keypoints.find(k => k.name === name);
        // Check for valid coordinates, return null if invalid
        return (kp && typeof kp.x === 'number' && typeof kp.y === 'number') ? { x: kp.x, y: kp.y } : null;
    }

    const thumbTip = findKp('thumb_tip');
    const indexTip = findKp('index_finger_tip');
    const middleTip = findKp('middle_finger_tip');
    const ringTip = findKp('ring_finger_tip');
    const pinkyTip = findKp('pinky_finger_tip');
    const wrist = findKp('wrist'); 
    const middleMcp = findKp('middle_finger_mcp'); 

    // Log found keypoints
    // console.log(`DG KP Found: thumb=${!!thumbTip}, index=${!!indexTip}, middle=${!!middleTip}, ring=${!!ringTip}, pinky=${!!pinkyTip}, wrist=${!!wrist}, mcp=${!!middleMcp}`);

    if (!thumbTip || !indexTip || !middleTip || !ringTip || !pinkyTip || !wrist || !middleMcp) {
        console.warn("DetermineGesture: Returning -1 due to missing key landmarks.");
        return -1; 
    }

    const dist = (p1: {x: number, y: number}, p2: {x: number, y: number}): number => {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    const thumbToIndex = dist(thumbTip, indexTip);
    const thumbToMiddle = dist(thumbTip, middleTip);
    const thumbToRing = dist(thumbTip, ringTip);
    const thumbToPinky = dist(thumbTip, pinkyTip);

    const scale = dist(wrist, middleMcp);
    if (scale === 0) { 
      console.warn("DetermineGesture: Returning -1 due to zero scale."); 
      return -1; 
    }

    const touchThreshold = scale * 0.3;
    
    // Log calculated values
    console.log(`DG Values: scale=${scale.toFixed(2)}, touchThreshold=${touchThreshold.toFixed(2)}, D(T->I)=${thumbToIndex.toFixed(2)}, D(T->M)=${thumbToMiddle.toFixed(2)}, D(T->R)=${thumbToRing.toFixed(2)}, D(T->P)=${thumbToPinky.toFixed(2)}`);

    const indexTouching = thumbToIndex < touchThreshold;
    const middleTouching = thumbToMiddle < touchThreshold;
    const ringTouching = thumbToRing < touchThreshold;
    const pinkyTouching = thumbToPinky < touchThreshold;

    if (indexTouching) { console.log("DG Returning: 1"); return 1; }
    if (middleTouching) { console.log("DG Returning: 2"); return 2; }
    if (ringTouching) { console.log("DG Returning: 3"); return 3; }
    if (pinkyTouching) { console.log("DG Returning: 4"); return 4; }

    // If none are touching
    console.log("DG Returning: 0");
    return 0; // Default state (e.g., Open hand)
  }, []);

  const handleP5HandData = useCallback((data: DerivedHandData) => {
    // Clear existing timeout on *any* new data from P5
    if (clearStateTimeoutRef.current) {
      clearTimeout(clearStateTimeoutRef.current);
      clearStateTimeoutRef.current = null;
    }

    if (data.error) {
      onStatusUpdate(`P5 Error: ${data.error}`);
      console.error(`P5 Error: ${data.error}`);
      // Set error state immediately
      setDisplayedPosition("Error");
      setParsedCoords(null);
      setLastGestureDisplay("Error");
      lastPositionRef.current = null;
      lastVelocityRef.current = null;
      lastGestureRef.current = null;
      return;
    }

    // --- Process based on rawPredictions ---
    if (data.rawPredictions && data.rawPredictions.length > 0) {
      const hand = data.rawPredictions[0];

      // Attempt to extract 3D position (middle_finger_mcp) 
      let currentPosition: Landmark | null = null;
      if (hand && hand.keypoints3D && hand.keypoints3D.length > 0) {
        // Find middle_finger_mcp specifically
        const mcp3D = hand.keypoints3D.find((kp: any) => kp.name === 'middle_finger_mcp'); 
        // Check if mcp3D object has valid x, y, z number properties
        if (mcp3D && typeof mcp3D.x === 'number' && typeof mcp3D.y === 'number' && typeof mcp3D.z === 'number') {
          currentPosition = { x: mcp3D.x, y: mcp3D.y, z: mcp3D.z }; // Use properties
        } else {
             console.warn("HandTrackingController: Invalid middle_finger_mcp 3D data structure:", mcp3D);
        }
      } else {
          console.warn("HandTrackingController: Hand detected, but keypoints3D array is missing or empty.");
      }

      console.log("HTC: Value of currentPosition before check:", currentPosition); // Log position value before IF

      // --- If Position was successfully extracted ---
      if (currentPosition) {
        let { x, y, z } = currentPosition; // Original (small) values from mcp3D

        // Multiply coordinates by 10
        const scaledX = x * 100;
        const scaledY = y * 100;
        const scaledZ = z * 100;

        // Update currentPosition with scaled values for further use (like velocity calc and OSC)
        currentPosition = { x: scaledX, y: scaledY, z: scaledZ };

        // Set UI states with scaled data
        setParsedCoords(currentPosition); // Use the updated currentPosition (scaled)
        setDisplayedPosition(`Pos: [${scaledX.toFixed(2)}, ${scaledY.toFixed(2)}, ${scaledZ.toFixed(2)}]`);
        throttledSendPosition(scaledX, scaledY, scaledZ); // Send scaled values

        const currentTime = Date.now();
        let currentVelocity: Landmark | null = null;

        // Calculate Velocity (uses currentPosition which is now scaled)
        if (lastPositionRef.current) { 
          const dt = (currentTime - lastPositionRef.current.timestamp) / 1000.0; 
          if (dt > 0) {
            const vx = (currentPosition.x - lastPositionRef.current.data.x) / dt; // Now uses scaled currentPosition.x
            const vy = (currentPosition.y - lastPositionRef.current.data.y) / dt; // Now uses scaled currentPosition.y
            const vz = (currentPosition.z - lastPositionRef.current.data.z) / dt; // Now uses scaled currentPosition.z
            throttledSendVelocity(vx, vy, vz); 
            currentVelocity = { x: vx, y: vy, z: vz };
          }
        }
        lastPositionRef.current = { data: currentPosition, timestamp: currentTime }; // Store scaled position for next frame
        
        // Gesture and raw landmarks need full landmark data from p5 sketch
        if (hand.keypoints && hand.keypoints.length > 0) {
          const gestureState = determineHandGesture(hand.keypoints);
          // Clear timeout because we have a valid gesture state (even if it's 0 or -1)
          if (clearStateTimeoutRef.current) {
            clearTimeout(clearStateTimeoutRef.current);
            clearStateTimeoutRef.current = null;
          }
          // Update state only if gesture changed
          if (gestureState !== lastGestureRef.current) {
              sendGesture(gestureState);
              let gestureString = 'N/A';
              switch (gestureState) {
                  case 0: gestureString = 'Open'; break;
                  case 1: gestureString = 'IndexPinch'; break;
                  case 2: gestureString = 'MiddlePinch'; break;
                  case 3: gestureString = 'RingPinch'; break;
                  case 4: gestureString = 'PinkyPinch'; break;
                  case -1: gestureString = 'Unknown'; break; 
              }
              setLastGestureDisplay(gestureString); 
              lastGestureRef.current = gestureState;
          }

          if (sendRawLandmarks && oscAddresses.landmarks) {
            // Flatten [ {x,y,name}, {x,y,name}, ... ] to [ x0, y0, x1, y1, ... ]
            const flatKeypoints = hand.keypoints.reduce((acc: number[], kp: any) => { 
                if (kp && typeof kp.x === 'number' && typeof kp.y === 'number') { 
                    acc.push(kp.x, kp.y); 
                } 
                return acc; 
            }, []);
            throttledSendAllLandmarks(flatKeypoints); // Send flattened 2D keypoints
          }
        } else {
          console.warn("HandTrackingController: Received rawPredictions, but hand object missing 'keypoints' property.", hand);
        }

        // Reset gesture display when no hand detected
        if (lastGestureRef.current !== 0 && lastGestureRef.current !== -1) { // Reset if not Open or Unknown
          sendGesture(0); // Send Open state when hand disappears? Or -1?
          setLastGestureDisplay('N/A');
          lastGestureRef.current = 0; // Assume Open when no hand detected
        }
      } else {
        // --- Position NOT Found (but rawPredictions existed) ---
        // Start timeout to clear *all* related states (Position, Coords, Gesture)
        if (!clearStateTimeoutRef.current) { // Avoid setting multiple timeouts
            clearStateTimeoutRef.current = setTimeout(() => {
              onStatusUpdate("Hand Detected (Invalid Keypoints)"); 
              setDisplayedPosition("Invalid Keypoints"); 
              setParsedCoords(null);
              setLastGestureDisplay('Unknown'); // Reset Gesture UI
              if (lastGestureRef.current !== -1) { // Send OSC only if state was different
                  sendGesture(-1);
              }
              lastGestureRef.current = -1; // Update Gesture Ref
              lastPositionRef.current = null;
              lastVelocityRef.current = null;
              clearStateTimeoutRef.current = null; // Clear ref after execution
            }, 500); 
        }
      }

    } else {
      // --- No rawPredictions --- 
      // Start timeout to clear *all* related states (Position, Coords, Gesture)
       if (!clearStateTimeoutRef.current) { // Avoid setting multiple timeouts
          clearStateTimeoutRef.current = setTimeout(() => {
            onStatusUpdate("No Hand Detected"); 
            setDisplayedPosition("None");
            setParsedCoords(null);
            setLastGestureDisplay('N/A'); // Reset Gesture UI to N/A or Open?
             if (lastGestureRef.current !== 0) { // Send OSC only if state wasn't already Open (0)
                 sendGesture(0); // Send Open state (0) when hand disappears?
             }
            lastGestureRef.current = 0; // Assume Open (0) state when no hand
            lastPositionRef.current = null;
            lastVelocityRef.current = null;
            clearStateTimeoutRef.current = null; // Clear ref after execution
          }, 500); 
       }
    }
  }, [
    onStatusUpdate,
    throttledSendPosition,
    throttledSendVelocity,
    sendGesture,
    throttledSendAllLandmarks,
    determineHandGesture,
    sendRawLandmarks,
    oscAddresses.landmarks
  ]);

  useEffect(() => {
    if (!isActive) {
      onStatusUpdate("Hand tracking disabled.");
      // Clear state immediately when disabled
      setDisplayedPosition("N/A");
      setParsedCoords(null);
      setLastGestureDisplay("N/A");
      // Clear refs
      lastPositionRef.current = null;
      lastVelocityRef.current = null;
      lastGestureRef.current = null;
      // Clear any pending timeout
      if (clearStateTimeoutRef.current) {
        clearTimeout(clearStateTimeoutRef.current);
        clearStateTimeoutRef.current = null;
      }
    } else {
      onStatusUpdate("Hand tracking enabled, awaiting P5 data...");
      lastGestureRef.current = null;
      // Clear any pending timeout on unmount
      if (clearStateTimeoutRef.current) {
        clearTimeout(clearStateTimeoutRef.current);
      }
    }
  }, [isActive, onStatusUpdate]);

  return (
    <div style={{ margin: '10px 0', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
      {/* Display Position and Gesture from HandTrackingController's perspective */}
      <div style={{marginBottom: '5px'}}>
        <span>Controller Status: </span>
        <span style={{fontWeight: 'bold'}}>{displayedPosition}</span>
        <span style={{marginLeft: '15px'}}>Gesture: </span>
        <span style={{fontWeight: 'bold'}}>{lastGestureDisplay}</span>
      </div>
      {/* Add direct coordinate display */} 
      <div style={{fontSize: '0.8em', marginBottom: '5px', fontFamily: 'monospace'}}>
        Parsed Coords: 
        X: {parsedCoords?.x.toFixed(3) ?? '---'} | 
        Y: {parsedCoords?.y.toFixed(3) ?? '---'} | 
        Z: {parsedCoords?.z.toFixed(3) ?? '---'}
      </div>
      
      { isActive && 
        <P5HandSketch 
            isActive={isActive} 
            onHandDataUpdate={handleP5HandData} 
            canvasWidth={p5CanvasWidth}
            canvasHeight={p5CanvasHeight}
        />
      }
    </div>
  );
};

export default HandTrackingController; 