import React, { useEffect, useRef } from 'react';
// import type p5 from 'p5'; // Removed as we are using global p5

// TypeScript declaration for global ml5 and p5
declare global {
  interface Window {
    ml5: any;
    p5: any; // Changed from typeof p5 to any, as p5 is global via script
  }
}

export interface DerivedHandData {
  rawPredictions?: any[]; // For debugging or advanced use
  position?: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  acceleration?: { x: number; y: number; z: number };
  gesture?: number; // 0 for open, 1 for closed (example)
  error?: string; // For reporting errors from the sketch
}

interface P5HandSketchProps {
  isActive: boolean;
  onHandDataUpdate: (data: DerivedHandData) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

const P5HandSketch: React.FC<P5HandSketchProps> = ({
  isActive,
  onHandDataUpdate,
  canvasWidth = 320,
  canvasHeight = 240,
}) => {
  const sketchRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<any>(null);
  const videoRef = useRef<any>(null); // To store p5 video capture element
  const handPoseModelRef = useRef<any>(null); // To store ml5 handPose model
  // const lastHandDataRef = useRef<any>({}); // For calculating velocity/acceleration later - to be reintroduced

  useEffect(() => {
    if (!sketchRef.current || !window.p5 || !window.ml5) {
      console.warn("p5 or ml5 not loaded, or sketchRef not available");
      return;
    }

    if (!isActive) {
      if (p5InstanceRef.current) {
        console.log("P5 Sketch: isActive is false, removing sketch.");
        p5InstanceRef.current.remove(); // p5's remove() should handle its created elements like video
        p5InstanceRef.current = null;
      }
      return;
    }

    // If instance exists and isActive is true, assume it's running or will be handled by its internal logic
    if (p5InstanceRef.current && isActive) {
        return;
    }

    console.log("P5 Sketch: isActive is true, creating new p5 instance.");

    const sketch = (p: any) => {
      let currentHands: any[] = [];
      let isHandPoseModelReady = false; // Flag to track model readiness
      let lastDetectionStatus = "Initializing..."; // State within the sketch

      p.preload = () => {
        if (!handPoseModelRef.current) {
            console.log("P5 Sketch: Preloading handPose model...");
            try {
                handPoseModelRef.current = window.ml5.handPose(() => {
                    console.log("P5 Sketch: ml5.handPose base model object ready. Model:", handPoseModelRef.current);
                    isHandPoseModelReady = true;
                    if (videoRef.current && handPoseModelRef.current && typeof handPoseModelRef.current.detectStart === 'function') {
                        console.log("P5 Sketch: Model loaded (callback), video available, attempting to start detection.", videoRef.current);
                        handPoseModelRef.current.detectStart(videoRef.current, gotHands);
                    } else if (!videoRef.current) {
                        console.log("P5 Sketch: Model loaded (callback), but video not ready yet. Setup will handle detection start.");
                    }
                });
            } catch (error) {
                console.error("P5 Sketch: Error preloading handPose model:", error);
                onHandDataUpdate({ error: 'Failed to load handPose model' });
            }
        }
      };

      p.setup = () => {
        p.createCanvas(canvasWidth, canvasHeight);
        console.log("P5 Sketch: Setup canvas created.");
        try {
            videoRef.current = p.createCapture(p.VIDEO, { facingMode: "user" });
            videoRef.current.mirrorX = true;
            videoRef.current.size(canvasWidth, canvasHeight);
            videoRef.current.hide();
            console.log("P5 Sketch: Video capture created and hidden. Video Element:", videoRef.current);

            if (isHandPoseModelReady && handPoseModelRef.current && typeof handPoseModelRef.current.detectStart === 'function') {
                console.log("P5 Sketch: Model was ready in setup, video available, attempting to start hand detection.", videoRef.current);
                handPoseModelRef.current.detectStart(videoRef.current, gotHands);
            } else if (!isHandPoseModelReady && handPoseModelRef.current) {
                console.warn("P5 Sketch: handPose model NOT YET ready in setup (preload callback pending). Detection will start from model callback.");
            } else if (!handPoseModelRef.current) {
                 console.error("P5 Sketch: handPoseModelRef is null in setup, cannot start detection.");
                 onHandDataUpdate({ error: 'HandPose model reference not available in setup' });
            }
        } catch (error) {
            console.error("P5 Sketch: Error setting up video or starting detection:", error);
            onHandDataUpdate({ error: 'Failed to setup video or start detection' });
        }
      };

      function gotHands(results: any[]) {
        // console.log("P5 Sketch: gotHands raw results:", JSON.stringify(results)); // Keep disabled unless needed
        currentHands = results;

        if (currentHands && currentHands.length > 0) {
          const hand = currentHands[0];
          // console.log("P5 Sketch: gotHands - Hand object present:", JSON.stringify(hand));

          // Use keypoints3D for position, check landmarks for gesture calculation validity
          if (hand && hand.keypoints3D && hand.keypoints3D.length > 0 && hand.landmarks && hand.landmarks.length > 0) {
            // console.log("P5 Sketch: gotHands - PATH A (landmarks/keypoints3D found).");
            const wrist3D = hand.keypoints3D[0]; // Use 3D keypoint for wrist position

            // Check wrist3D validity
            if (wrist3D && typeof wrist3D[0] === 'number' && typeof wrist3D[1] === 'number' && typeof wrist3D[2] === 'number') {
              lastDetectionStatus = "Landmarks Found";
              const derivedData: DerivedHandData = {
                rawPredictions: currentHands, // Send full hand data including 2D landmarks for gesture
                position: { x: wrist3D[0], y: wrist3D[1], z: wrist3D[2] },
              };
              onHandDataUpdate(derivedData);
            } else {
              lastDetectionStatus = "Invalid Wrist 3D Data";
              console.warn("P5 Sketch: gotHands - Wrist 3D data invalid, sending no position.", wrist3D);
              onHandDataUpdate({ position: undefined, rawPredictions: currentHands });
            }
          } else {
            lastDetectionStatus = "Hand Found (No Keypoints)";
            // console.log("P5 Sketch: gotHands - PATH B (hand present, but no valid keypoints/landmarks). Hand object:", JSON.stringify(hand));
            onHandDataUpdate({ position: undefined, rawPredictions: currentHands });
          }
        } else {
          lastDetectionStatus = "No Hand Detected";
          // console.log("P5 Sketch: gotHands - PATH C (no hands in results array).");
          onHandDataUpdate({ position: undefined, rawPredictions: [] });
        }
      }

      p.draw = () => {
        if (videoRef.current) {
          p.background(200);
          p.image(videoRef.current, 0, 0, p.width, p.height);

          for (let i = 0; i < currentHands.length; i++) {
            let hand = currentHands[i];
            // Ensure hand and keypoints (as an array) exist before looping
            if (hand && Array.isArray(hand.keypoints) && hand.keypoints.length > 0) {
              for (let j = 0; j < hand.keypoints.length; j++) {
                let keypoint = hand.keypoints[j];
                if (keypoint && typeof keypoint.x === 'number' && typeof keypoint.y === 'number') {
                  p.fill(0, 255, 0);
                  p.noStroke();
                  p.ellipse(keypoint.x, keypoint.y, 10, 10);
                }
              }
            }
          }

          p.fill(255);
          p.stroke(0);
          p.textSize(12);
          p.textAlign(p.LEFT, p.TOP);
          p.text(`P5 Status: ${lastDetectionStatus}`, 5, 5);
        }
      };

      // This is p5's built-in way to clean up a sketch
      p.remove = () => {
        console.log("P5 Sketch: p.remove() called. Stopping video and detection.");
        if (videoRef.current) {
          if (typeof videoRef.current.stop === 'function') videoRef.current.stop();
          if (typeof videoRef.current.remove === 'function') videoRef.current.remove(); // p5.Element specific remove
          videoRef.current = null;
        }
        if (handPoseModelRef.current && typeof handPoseModelRef.current.detectStop === 'function') {
          console.log("P5 Sketch: Stopping handPose detection via model.detectStop().");
          handPoseModelRef.current.detectStop();
        }
        // Consider if handPoseModelRef.current itself should be nulled if it's recreated per instance
      };
    };

    if (sketchRef.current) {
        // Clear any previous sketch content if any (though remove() should handle it)
        // sketchRef.current.innerHTML = ''; 
        p5InstanceRef.current = new window.p5(sketch, sketchRef.current);
    }

    return () => {
      if (p5InstanceRef.current) {
        console.log("P5 Sketch: useEffect cleanup, calling p5Instance.remove().");
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, onHandDataUpdate, canvasWidth, canvasHeight]);

  return <div ref={sketchRef} style={{ width: canvasWidth, height: canvasHeight }} />;
};

export default P5HandSketch; 