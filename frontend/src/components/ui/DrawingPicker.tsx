import { useId } from 'react';
import { DEVICE_DRAWING_GROUPS, type DeviceDrawingId } from '@/data/deviceDrawings';
import { useT } from '@/i18n';
import DeviceDrawing from './DeviceDrawing';
import { labelClass } from './compactStyles';

interface DrawingPickerProps {
  label: string;
  value: DeviceDrawingId;
  onChange: (drawing: DeviceDrawingId) => void;
}

/**
 * DrawingPicker
 * The drawing a template is shown with, chosen among those the app has, in
 * the groups of the kit they come from: the network, the servers, the data,
 * the end devices. Each is a button with the name of its drawing, in the
 * language of the interface, as its title and as its name for a screen
 * reader; the one chosen has its upper layer in the accent, and is said so
 * to who cannot see it (`aria-checked`).
 */
const DrawingPicker = ({ label, value, onChange }: DrawingPickerProps) => {
  const labelId = useId();
  const t = useT();
  const words = t.templates.devices;

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span id={labelId} className={labelClass}>
        {label}
      </span>
      <div className="drawing-picker" role="radiogroup" aria-labelledby={labelId}>
        {DEVICE_DRAWING_GROUPS.map(({ group, drawings }) => (
          <div
            key={group}
            className="drawing-picker-group"
            role="group"
            aria-labelledby={`${labelId}-${group}`}
          >
            <span id={`${labelId}-${group}`} className="drawing-picker-caption">
              {words.drawingGroups[group]}
            </span>
            <div className="drawing-picker-items">
              {drawings.map((drawing) => {
                const chosen = drawing === value;
                const name = words.drawingNames[drawing];
                return (
                  <button
                    key={drawing}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    aria-label={name}
                    title={name}
                    className={chosen ? 'drawing-picker-item chosen' : 'drawing-picker-item'}
                    onClick={() => onChange(drawing)}
                  >
                    <DeviceDrawing drawing={drawing} size={32} state={chosen ? 'selected' : 'rest'} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DrawingPicker;
