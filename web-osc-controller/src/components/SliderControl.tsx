import React, { useState, useCallback } from 'react';

// Ideally, share this type from a central location (e.g., src/types.ts)
interface ControlConfig {
    id: string;
    type: 'slider' | 'button' | 'toggle';
    label: string;
    address: string;
    options?: { min?: number; max?: number; step?: number; valueOn?: number; valueOff?: number };
    appearance?: { color?: string };
}

interface SliderControlProps {
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
    flexDirection: 'column',
    gap: '0.5rem',
    borderLeftWidth: '5px', // Add thicker left border for color indication
    borderLeftStyle: 'solid'
};

const controlHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem'
};

const labelStyle: React.CSSProperties = {
    fontWeight: 500,
    fontSize: '0.95em'
};

const addressStyle: React.CSSProperties = {
    fontSize: '0.8em',
    color: '#aaa',
    fontFamily: 'monospace'
};

const valueDisplayStyle: React.CSSProperties = {
    fontSize: '0.85em',
    color: '#ccc',
    textAlign: 'right'
};

const sliderInputStyle: React.CSSProperties = {
    width: '100%'
};

const buttonGroupStyle: React.CSSProperties = {
    marginLeft: 'auto' // Push buttons to the right
};

const smallButtonStyle: React.CSSProperties = {
    marginLeft: '5px', 
    fontSize: '0.8em', 
    padding: '0.2em 0.5em'
};

export const SliderControl: React.FC<SliderControlProps> = ({ control, sendOsc, onEdit, onRemove }) => {
    const { id, label, address, options = {}, appearance = {} } = control;
    const { min = 0, max = 1, step = 0.01 } = options;
    const { color = '#ffffff' } = appearance; // Default to white if no color set

    // Local state to manage the slider value for controlled input
    // Initialize with a middle value or min, ensuring it's within bounds
    const initialValue = Math.max(min, Math.min(max, (min + max) / 2));
    const [value, setValue] = useState<number>(initialValue);

    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(event.target.value);
        setValue(newValue);
        sendOsc(address, [newValue]);
    }, [sendOsc, address]);

    // Combine base style with dynamic color
    const controlWrapperStyle: React.CSSProperties = {
        ...baseControlWrapperStyle,
        borderLeftColor: color, 
    };

    return (
        <div style={controlWrapperStyle}>
            <div style={controlHeaderStyle}>
                <div>
                    <span style={labelStyle}>{label}</span>
                    <div style={addressStyle}>{address}</div>
                </div>
                <div style={buttonGroupStyle}>
                    <button onClick={() => onEdit(control)} style={smallButtonStyle}>Edit</button>
                    <button onClick={() => onRemove(id)} style={smallButtonStyle}>Remove</button>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleChange}
                    style={sliderInputStyle}
                 />
                 <span style={valueDisplayStyle}>{value.toFixed(step < 0.1 ? 2 : (step < 1 ? 1 : 0))}</span> 
                 {/* Adjust precision based on step */}
            </div>
        </div>
    );
}; 