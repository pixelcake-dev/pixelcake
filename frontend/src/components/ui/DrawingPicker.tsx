import { useId } from 'react';
import { DEVICE_DRAWING_IDS, type DeviceDrawingId } from '@/data/deviceDrawings';
import { DRAWING_OF_TEMPLATE } from '@/utils/deviceDrawing';
import { useTemplateStore } from '@/store/templateStore';
import DeviceDrawing from './DeviceDrawing';
import { labelClass } from './compactStyles';

interface DrawingPickerProps {
  label: string;
  value: DeviceDrawingId;
  onChange: (drawing: DeviceDrawingId) => void;
}

/**
 * DrawingPicker
 * The drawing a template is shown with, chosen among those the app has. Each
 * is a button named after the device the app itself shows with it; the one
 * chosen has its upper layer in the accent, and is said so to who cannot see
 * it (`aria-checked`).
 */
const DrawingPicker = ({ label, value, onChange }: DrawingPickerProps) => {
  const labelId = useId();
  const templates = useTemplateStore((state) => state.templates);
  // The name of a drawing: the template the app comes with that is shown with it
  const nameOf = (drawing: DeviceDrawingId) =>
    templates.find((template) => !template.isCustom && DRAWING_OF_TEMPLATE[template.id] === drawing)
      ?.name ?? drawing;

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span id={labelId} className={labelClass}>
        {label}
      </span>
      <div className="drawing-picker" role="radiogroup" aria-labelledby={labelId}>
        {DEVICE_DRAWING_IDS.map((drawing) => {
          const chosen = drawing === value;
          return (
            <button
              key={drawing}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={nameOf(drawing)}
              title={nameOf(drawing)}
              className={chosen ? 'drawing-picker-item chosen' : 'drawing-picker-item'}
              onClick={() => onChange(drawing)}
            >
              <DeviceDrawing drawing={drawing} size={32} state={chosen ? 'selected' : 'rest'} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DrawingPicker;
