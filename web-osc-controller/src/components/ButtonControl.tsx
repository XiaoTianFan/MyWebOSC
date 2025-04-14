import React, { useCallback } from 'react';

// Ideally, share this type from a central location
interface ControlConfig {
    id: string;
    type: 'slider' | 'button' | 'toggle';
    label: string;
    address: string;
    options?: { valueOn?: number; valueOff?: number; }; // Options specific to button
    appearance?: { color?: string };
}

interface ButtonControlProps {
    control: ControlConfig;
    sendOsc: (address: string, args: any[]) => void;
    onEdit: (control: ControlConfig) => void;
    onRemove: (id: string) => void;
}

// Base styles
const baseControlWrapperStyle: React.CSSProperties = {
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '0.75rem',
    marginBottom: '0.5rem',
    backgroundColor: '#383838',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    borderLeftWidth: '5px', // Add thicker left border for color indication
    borderLeftStyle: 'solid'
};

const mainButtonStyle: React.CSSProperties = {
    padding: '0.5em 1em',
    flexGrow: 1, // Make button take available space
};

const buttonGroupStyle: React.CSSProperties = {
    // marginLeft: 'auto' // No longer needed with flex justify-content
};

const smallButtonStyle: React.CSSProperties = {
    marginLeft: '5px', 
    fontSize: '0.8em', 
    padding: '0.2em 0.5em'
};

export const ButtonControl: React.FC<ButtonControlProps> = ({ control, sendOsc, onEdit, onRemove }) => {
    const { id, label, address, options = {}, appearance = {} } = control;
    // Define default press/release values, allow override via options
    const valueOn = options?.valueOn ?? 1;
    const valueOff = options?.valueOff ?? 0;
    const { color = '#ffffff' } = appearance; // Default to white

    const handleMouseDown = useCallback(() => {
        sendOsc(address, [valueOn]);
    }, [sendOsc, address, valueOn]);

    const handleMouseUp = useCallback(() => {
        sendOsc(address, [valueOff]);
    }, [sendOsc, address, valueOff]);

    // Add touch events for mobile compatibility
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault(); // Prevent potential double-triggering or unwanted scrolling
        sendOsc(address, [valueOn]);
    }, [sendOsc, address, valueOn]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        sendOsc(address, [valueOff]);
    }, [sendOsc, address, valueOff]);

    // Combine base style with dynamic color
    const controlWrapperStyle: React.CSSProperties = {
        ...baseControlWrapperStyle,
        borderLeftColor: color,
    };

    // Optional: Apply color to the button itself too, e.g., border or background on hover/active
    const coloredButtonStyle: React.CSSProperties = {
        ...mainButtonStyle,
        // Example: Change border on hover
        // borderColor: color // This would require button style adjustments
    };

    return (
        <div style={controlWrapperStyle}>
             <button
                 style={coloredButtonStyle}
                 onMouseDown={handleMouseDown}
                 onMouseUp={handleMouseUp}
                 onTouchStart={handleTouchStart}
                 onTouchEnd={handleTouchEnd}
                 onMouseLeave={handleMouseUp} // Send 'off' if mouse leaves while pressed
                 onTouchCancel={handleTouchEnd} // Send 'off' if touch is cancelled
             >
                {label}
             </button>
            <div style={buttonGroupStyle}>
                <button onClick={() => onEdit(control)} style={smallButtonStyle}>Edit</button>
                <button onClick={() => onRemove(id)} style={smallButtonStyle}>Remove</button>
            </div>
        </div>
    );
}; 