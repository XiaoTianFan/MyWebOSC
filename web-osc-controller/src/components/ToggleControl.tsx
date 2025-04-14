import React, { useState, useCallback } from 'react';

// Ideally, share this type from a central location
interface ControlConfig {
    id: string;
    type: 'slider' | 'button' | 'toggle';
    label: string;
    address: string;
    options?: { valueOn?: number; valueOff?: number }; // Similar options to button
    appearance?: { color?: string };
}

interface ToggleControlProps {
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

const toggleLabelStyle: React.CSSProperties = {
    flexGrow: 1,
    cursor: 'pointer', // Make label clickable
    userSelect: 'none' // Prevent text selection on click
};

const toggleInputStyle: React.CSSProperties = {
    // Basic checkbox styling, can be enhanced with CSS for a switch appearance
    marginLeft: '0.5rem',
    transform: 'scale(1.3)', // Make checkbox slightly larger
    cursor: 'pointer'
};

const buttonGroupStyle: React.CSSProperties = {
    // marginLeft: 'auto' // No longer needed with flex justify-content
};

const smallButtonStyle: React.CSSProperties = {
    marginLeft: '5px', 
    fontSize: '0.8em', 
    padding: '0.2em 0.5em'
};

export const ToggleControl: React.FC<ToggleControlProps> = ({ control, sendOsc, onEdit, onRemove }) => {
    const { id, label, address, options = {}, appearance = {} } = control;
    const valueOn = options?.valueOn ?? 1;
    const valueOff = options?.valueOff ?? 0;
    const { color = '#ffffff' } = appearance; // Default to white

    // Local state for the toggle's on/off status
    const [isOn, setIsOn] = useState<boolean>(false); // Default to off

    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const newState = event.target.checked;
        setIsOn(newState);
        sendOsc(address, [newState ? valueOn : valueOff]);
    }, [sendOsc, address, valueOn, valueOff]);

    // Combine base style with dynamic color
    const controlWrapperStyle: React.CSSProperties = {
        ...baseControlWrapperStyle,
        borderLeftColor: color,
    };

    // Optional: Apply accent color to the checkbox/switch itself (requires more advanced CSS)
    const coloredToggleInputStyle: React.CSSProperties = {
        ...toggleInputStyle,
        // accentColor: color // Modern CSS property, browser support varies
    };

    return (
        <div style={controlWrapperStyle}>
            <label htmlFor={`toggle-${id}`} style={toggleLabelStyle}>
                {label}
            </label>
            <input
                id={`toggle-${id}`}
                type="checkbox"
                checked={isOn}
                onChange={handleChange}
                style={coloredToggleInputStyle}
            />
            <div style={buttonGroupStyle}>
                <button onClick={() => onEdit(control)} style={smallButtonStyle}>Edit</button>
                <button onClick={() => onRemove(id)} style={smallButtonStyle}>Remove</button>
            </div>
        </div>
    );
}; 