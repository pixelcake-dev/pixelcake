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
import { BASE_TYPES, BASE_TYPE_GROUPS, templateFieldsOfType } from '@/utils/templateBaseTypes';
import { useT, type Dictionary } from '@/i18n';

/** What is wrong with a field: named here, said in the language of the interface when drawn */
type FieldError = keyof Dictionary['templates']['devices']['editor']['errors'];
// (the drawing is always one of the app's: there is nothing to get wrong in it)
type FormErrors = Partial<Record<'name' | 'type', FieldError>>;

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
  /** A template was made (the list it is in is the one of the custom ones) */
  onCreated?: () => void;
}

const TemplateEditModal = ({ isOpen, onClose, template, onCreated }: TemplateEditModalProps) => {
  const t = useT();
  const words = t.templates.devices.editor;
  const addTemplate = useTemplateStore((state) => state.addTemplate);
  const updateTemplate = useTemplateStore((state) => state.updateTemplate);

  const isEditMode = template !== null;

  // Form state
  const [formData, setFormData] = useState<TemplateForm>(EMPTY_FORM);

  const [errors, setErrors] = useState<FormErrors>({});

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
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'nameRequired';
    }

    if (!formData.type || !formData.type.trim()) {
      newErrors.type = 'typeRequired';
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
      // Create new template: a variant of a kind the app covers already, or a
      // kind of its own. It is a custom one: it is kept with the project, and
      // restoring the built-in templates leaves it alone
      addTemplate({
        name: formData.name,
        type: formData.type,
        icon: drawing,
        color: '#5E8096',
        isCustom: true,
        ...templateFieldsOfType(formData.type),
      });
      onCreated?.();
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
      title={isEditMode ? words.titleEdit : words.titleNew}
      size="sm"
      variant="scrollable"
      autoHeight={true}
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleCancel}>
            {t.common.actions.cancel}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {isEditMode ? words.saveChanges : words.create}
          </Button>
        </div>
      }
    >
      <FormContainer gap="4">
        {/* Name */}
        <div>
          <Input
            label={words.name}
            type="text"
            placeholder={words.namePlaceholder}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            size="md"
            autoFocus
          />
          {errors.name && (
            <span className="text-sm text-[var(--danger-color)]">{words.errors[errors.name]}</span>
          )}
        </div>

        {/* Base type */}
        <div>
          <Select
            label={t.templates.devices.baseType}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value, icon: '' })}
            size="md"
            disabled={isEditMode}
            required
          >
            <option value="">{words.chooseType}</option>
            {BASE_TYPE_GROUPS.map((group) => (
              <optgroup key={group} label={t.templates.devices.baseTypeGroups[group]}>
                {BASE_TYPES.filter((entry) => entry.group === group).map((entry) => (
                  <option key={entry.type} value={entry.type}>
                    {entry.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          {errors.type && (
            <span className="text-sm text-[var(--danger-color)]">{words.errors[errors.type]}</span>
          )}
          {isEditMode && (
            <span className="text-xs text-[var(--text-color-light)] mt-1">{words.typeLocked}</span>
          )}
        </div>

        {/* The drawing a device of this template is shown with */}
        <DrawingPicker
          label={t.templates.devices.drawing}
          value={drawing}
          onChange={(icon) => setFormData({ ...formData, icon })}
        />
      </FormContainer>
    </Modal>
  );
};

export default TemplateEditModal;
