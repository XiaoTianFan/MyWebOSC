import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Reuse the ControlConfig interface from App.tsx (or define it centrally)
// For simplicity here, let's redefine slightly. Ideally, share types.
interface ControlConfig {
    id: string;
    type: 'slider' | 'button' | 'toggle';
    label: string;
    address: string;
    options?: { min?: number; max?: number; step?: number; valueOn?: number; valueOff?: number }; // Combined options
    appearance?: { color?: string }; // Example appearance
}

interface ControlSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (controlConfig: ControlConfig) => void;
    controlToEdit?: ControlConfig | null; // Pass the control object for editing
}

// Basic Modal Styling (inline for simplicity, ideally use CSS)
const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#333',
    padding: '2rem',
    border: '1px solid #555',
    borderRadius: '8px',
    zIndex: 1000,
    color: 'white',
    minWidth: '350px',
    boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
};

const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
};

const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
};

const inputGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.9em',
    color: '#ccc',
};

const inputStyle: React.CSSProperties = {
    padding: '0.5em',
    backgroundColor: '#444',
    border: '1px solid #666',
    borderRadius: '4px',
    color: 'white',
};

const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    marginTop: '1rem',
};

export const ControlSettingsDialog: React.FC<ControlSettingsDialogProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    controlToEdit 
}) => {
    // Form state
    const [type, setType] = useState<'slider' | 'button' | 'toggle'>('slider');
    const [label, setLabel] = useState('');
    const [address, setAddress] = useState('');
    // Options state
    const [min, setMin] = useState('0');
    const [max, setMax] = useState('1');
    const [step, setStep] = useState('0.01');
    const [valueOn, setValueOn] = useState('1'); // For button/toggle
    const [valueOff, setValueOff] = useState('0'); // For button/toggle
    // Appearance state
    const [color, setColor] = useState('#ffffff'); // Default color: white

    // Reset form when opening or when controlToEdit changes
    useEffect(() => {
        if (isOpen) {
            const defaultColor = '#ffffff'; // Define default color
            if (controlToEdit) {
                setType(controlToEdit.type);
                setLabel(controlToEdit.label);
                setAddress(controlToEdit.address);
                setColor(controlToEdit.appearance?.color ?? defaultColor);
                
                // Set options based on type
                setMin(controlToEdit.options?.min?.toString() ?? '0');
                setMax(controlToEdit.options?.max?.toString() ?? '1');
                setStep(controlToEdit.options?.step?.toString() ?? '0.01');
                setValueOn(controlToEdit.options?.valueOn?.toString() ?? '1');
                setValueOff(controlToEdit.options?.valueOff?.toString() ?? '0');
                 
            } else {
                // Reset for new control
                setType('slider');
                setLabel('');
                setAddress('/control/');
                setColor(defaultColor); // Reset color
                // Reset options
                setMin('0');
                setMax('1');
                setStep('0.01');
                setValueOn('1');
                setValueOff('0');
            }
        } else {
            // Optional: Clear state when closed if desired, though resetting on open is usually sufficient
        }
    }, [isOpen, controlToEdit]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        
        let options: any = {};
        switch (type) {
            case 'slider':
                options = {
                    min: parseFloat(min) || 0,
                    max: parseFloat(max) || 1,
                    step: parseFloat(step) || 0.01,
                };
                break;
            case 'button':
            case 'toggle':
                 options = {
                    valueOn: parseFloat(valueOn) || 1,
                    valueOff: parseFloat(valueOff) || 0,
                 };
                 break;
        }

        const savedControl: ControlConfig = {
            id: controlToEdit ? controlToEdit.id : uuidv4(),
            type,
            label,
            address,
            options,
            appearance: { color } // Save selected color
        };
        onSave(savedControl);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div style={backdropStyle} onClick={onClose} />
            <div style={modalStyle}>
                <h2>{controlToEdit ? 'Edit Control' : 'Add New Control'}</h2>
                <form onSubmit={handleSubmit} style={formStyle}>
                    <div style={inputGroupStyle}>
                        <label htmlFor="control-label" style={labelStyle}>Label:</label>
                        <input 
                            id="control-label" 
                            type="text" 
                            value={label} 
                            onChange={e => setLabel(e.target.value)} 
                            required 
                            style={inputStyle}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label htmlFor="control-address" style={labelStyle}>OSC Address:</label>
                        <input 
                            id="control-address" 
                            type="text" 
                            value={address} 
                            onChange={e => setAddress(e.target.value)} 
                            placeholder="/example/address" 
                            required 
                            style={inputStyle}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label htmlFor="control-type" style={labelStyle}>Type:</label>
                        <select 
                            id="control-type" 
                            value={type} 
                            onChange={e => setType(e.target.value as typeof type)} 
                            required
                            style={inputStyle}
                        >
                            <option value="slider">Slider</option>
                            <option value="button">Button</option>
                            <option value="toggle">Toggle</option>
                            {/* Add more control types here */}
                        </select>
                    </div>

                    {/* Conditional Options based on Type */}
                    {type === 'slider' && (
                        <>
                            <div style={inputGroupStyle}>
                                <label htmlFor="control-min" style={labelStyle}>Min:</label>
                                <input 
                                    id="control-min" 
                                    type="number" 
                                    value={min} 
                                    onChange={e => setMin(e.target.value)} 
                                    style={inputStyle}
                                />
                            </div>
                            <div style={inputGroupStyle}>
                                <label htmlFor="control-max" style={labelStyle}>Max:</label>
                                <input 
                                    id="control-max" 
                                    type="number" 
                                    value={max} 
                                    onChange={e => setMax(e.target.value)} 
                                    style={inputStyle}
                                />
                            </div>
                             <div style={inputGroupStyle}>
                                <label htmlFor="control-step" style={labelStyle}>Step:</label>
                                <input 
                                    id="control-step" 
                                    type="number" 
                                    value={step} 
                                    onChange={e => setStep(e.target.value)} 
                                    style={inputStyle}
                                />
                            </div>
                        </>
                    )}
                    {(type === 'button' || type === 'toggle') && (
                        <>
                           <div style={inputGroupStyle}>
                                <label htmlFor="control-value-on" style={labelStyle}>Value On:</label>
                                <input id="control-value-on" type="number" value={valueOn} onChange={e => setValueOn(e.target.value)} style={inputStyle}/>
                            </div>
                            <div style={inputGroupStyle}>
                                <label htmlFor="control-value-off" style={labelStyle}>Value Off:</label>
                                <input id="control-value-off" type="number" value={valueOff} onChange={e => setValueOff(e.target.value)} style={inputStyle}/>
                            </div>
                        </>
                    )}

                    <div style={inputGroupStyle}>
                        <label htmlFor="control-color" style={labelStyle}>Color:</label>
                        <input 
                            id="control-color"
                            type="color" 
                            value={color} 
                            onChange={e => setColor(e.target.value)} 
                            style={{...inputStyle, height: '3em'}} // Make color input taller
                        />
                    </div>

                    <div style={buttonGroupStyle}>
                        <button type="button" onClick={onClose}>Cancel</button>
                        <button type="submit">{controlToEdit ? 'Save Changes' : 'Add Control'}</button>
                    </div>
                </form>
            </div>
        </>
    );
}; 