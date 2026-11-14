import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormContainer } from '@/components/ui/FormContainer';
import DrawingPicker from '@/components/ui/DrawingPicker';
import { drawingOf } from '@/utils/deviceDrawing';
import type { DeviceDrawingId } from '@/data/deviceDrawings';
import { useTemplateStore } from '@/store/templateStore';
import type { DeviceTemplate } from '@/types/network';

/** What the form holds: the drawing is one of the app's, the one of the base type until another is chosen */
interface TemplateForm {
  name: string;
  type: string;
  icon: DeviceDrawingId | '';
}

const EMPTY_FORM: TemplateForm = { name: '', type: '', icon: '' };

interface TemplateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: DeviceTemplate | null; // null = create mode, non-null = edit mode
}

const TemplateEditModal = ({ isOpen, onClose, template }: TemplateEditModalProps) => {
  const addTemplate = useTemplateStore((state) => state.addTemplate);
  const updateTemplate = useTemplateStore((state) => state.updateTemplate);
  const templates = useTemplateStore((state) => state.templates);

  const isEditMode = template !== null;

  // Form state
  const [formData, setFormData] = useState<TemplateForm>(EMPTY_FORM);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when template changes
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        type: template.type,
        // (a template of before the drawings shows the one it is drawn with)
        icon: drawingOf(template, template.type),
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setErrors({});
  }, [template, isOpen]);

  /** The drawing the form shows as chosen */
  const drawing = formData.icon || drawingOf(undefined, formData.type);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome obbligatorio';
    }

    if (!formData.type || !formData.type.trim()) {
      newErrors.type = 'Tipo base obbligatorio';
    } else if (!isEditMode) {
      // Check for duplicate type only in create mode
      const existingTemplate = templates.find(
        (t) => t.type === formData.type && !t.isCustom
      );
      if (existingTemplate) {
        newErrors.type = 'Tipo già esistente tra i template generici';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    if (isEditMode && template) {
      // Update existing template
      updateTemplate(template.id, {
        name: formData.name,
        // type: formData.type, // Don't change type in edit mode to avoid breaking references
        icon: drawing,
      });
    } else {
      // Create new template
      // Auto-set VLAN/STP support based on device type
      const supportsVLAN = ['Switch', 'Router', 'Firewall'].includes(formData.type);
      const supportsSTP = ['Switch', 'Router', 'Firewall'].includes(formData.type);

      // Auto-set port management support
      const supportsPorts = ['Switch', 'Router', 'Firewall'].includes(formData.type);

      // Determine port options based on device type
      let portOptions: number[] | undefined;
      let defaultPortCount: number | undefined;

      if (formData.type === 'Switch') {
        portOptions = [5, 8, 16, 24, 48];
        defaultPortCount = 24;
      } else if (formData.type === 'Router' || formData.type === 'Firewall') {
        portOptions = [2, 4, 8, 16];
        defaultPortCount = 8;
      }

      addTemplate({
        name: formData.name,
        type: formData.type,
        icon: drawing,
        color: '#5E8096',
        isCustom: false,
        supportsVLAN,
        supportsSTP,
        supportsPorts,
        supportsNICs: !supportsPorts,
        portOptions,
        defaultPortCount,
      });
    }

    onClose();
  };

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={isEditMode ? 'Modifica Template Generico' : 'Nuovo Template Generico'}
      size="sm"
      variant="scrollable"
      autoHeight={true}
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleCancel}>
            Annulla
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {isEditMode ? 'Salva Modifiche' : 'Crea Template'}
          </Button>
        </div>
      }
    >
      <FormContainer gap="4">
        {/* Nome */}
        <div>
          <Input
            label="Nome"
            type="text"
            placeholder="es: PC, Printer, IoT Device"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            size="md"
            autoFocus
          />
          {errors.name && <span className="text-sm text-[var(--danger-color)]">{errors.name}</span>}
        </div>

        {/* Tipo Base */}
        <div>
          <Select
            label="Tipo Base"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value, icon: '' })}
            size="md"
            disabled={isEditMode}
            required
          >
            <option value="">-- Seleziona tipo --</option>
            <option value="PC">PC</option>
            <option value="Switch">Switch</option>
            <option value="Router">Router</option>
            <option value="Server">Server</option>
            <option value="Firewall">Firewall</option>
            <option value="AccessPoint">Access Point</option>
            <option value="LoadBalancer">Load Balancer</option>
            <option value="Database">Database</option>
            <option value="Cloud">Cloud</option>
          </Select>
          {errors.type && <span className="text-sm text-[var(--danger-color)]">{errors.type}</span>}
          {isEditMode && (
            <span className="text-xs text-[var(--text-color-light)] mt-1">
              Il tipo non può essere modificato per evitare problemi con i dispositivi esistenti
            </span>
          )}
        </div>

        {/* The drawing a device of this template is shown with */}
        <DrawingPicker
          label="Disegno"
          value={drawing}
          onChange={(icon) => setFormData({ ...formData, icon })}
        />
      </FormContainer>
    </Modal>
  );
};

export default TemplateEditModal;
