/**
 * Connection Template Edit Modal
 * Modal for creating and editing connection templates
 */

import { useState, useEffect } from 'react';
import { useTemplateStore } from '@/store/templateStore';
import type { ConnectionTemplate } from '@/types/network';
import ConnectionLinePreview from './ConnectionLinePreview';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormContainer } from '@/components/ui/FormContainer';
import { getT, useT, type Dictionary } from '@/i18n';
import { linkTypeDescription } from '@/utils/templateText';

/** What stops the save: named here, said in the language of the interface when drawn */
type FormError = keyof Dictionary['templates']['links']['editor']['errors'];

interface ConnectionTemplateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: ConnectionTemplate; // If provided, edit mode; otherwise create mode
}

const ConnectionTemplateEditModal = ({
  isOpen,
  onClose,
  template,
}: ConnectionTemplateEditModalProps) => {
  const t = useT();
  const words = t.templates.links.editor;
  const addConnectionTemplate = useTemplateStore((state) => state.addConnectionTemplate);
  const updateConnectionTemplate = useTemplateStore((state) => state.updateConnectionTemplate);
  const connectionTemplates = useTemplateStore((state) => state.connectionTemplates);

  const isEditMode = !!template;

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [strokeWidth, setStrokeWidth] = useState(2.5);
  const [error, setError] = useState<FormError | null>(null);

  // Initialize form with template data in edit mode
  useEffect(() => {
    if (template) {
      setName(template.name);
      setType(template.type);
      // The description starts as the list shows it: in the language of the
      // interface while it is the app's own. It is read when the editor
      // opens (hence `getT()`, not a dependency of this effect): from then
      // on the field holds what the user is typing, which a change of
      // language must not write over
      setDescription(linkTypeDescription(template, getT()) || '');
      setColor(template.color);
      setLineStyle(template.lineStyle);
      setStrokeWidth(template.strokeWidth);
    } else {
      // Reset form in create mode
      setName('');
      setType('');
      setDescription('');
      setColor('#3b82f6');
      setLineStyle('solid');
      setStrokeWidth(2.5);
    }
    setError(null);
  }, [template, isOpen]);

  // Calculate stroke dash array based on line style
  const getStrokeDasharray = () => {
    switch (lineStyle) {
      case 'dashed':
        return '8 4';
      case 'dotted':
        return '1 5';
      case 'solid':
      default:
        return undefined;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('nameRequired');
      return;
    }

    if (!type.trim()) {
      setError('typeRequired');
      return;
    }

    // Validate unique type (only in create mode or if type changed)
    if (!isEditMode || type !== template?.type) {
      const typeExists = connectionTemplates.some((existing) => existing.type === type.toLowerCase());
      if (typeExists) {
        setError('typeExists');
        return;
      }
    }

    // Validate color hex
    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (!hexRegex.test(color)) {
      setError('invalidColour');
      return;
    }

    // Validate stroke width
    if (strokeWidth < 1 || strokeWidth > 10) {
      setError('thicknessOutOfRange');
      return;
    }

    const templateData = {
      name: name.trim(),
      type: type.toLowerCase().trim(),
      description: description.trim() || undefined,
      color,
      lineStyle,
      strokeWidth,
      strokeWidthHighlighted: strokeWidth + 1.5, // Auto-calculate highlighted width
      strokeDasharray: getStrokeDasharray(),
      isCustom: true,
    };

    if (isEditMode && template) {
      updateConnectionTemplate(template.id, templateData);
    } else {
      addConnectionTemplate(templateData);
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? words.titleEdit : words.titleNew}
      size="sm"
      variant="scrollable"
      autoHeight={true}
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={onClose}>
            {t.common.actions.cancel}
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {isEditMode ? words.saveChanges : words.create}
          </Button>
        </div>
      }
    >
      <FormContainer gap="4">
          {/* Name */}
          <Input
            label={words.name}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={words.namePlaceholder}
            size="md"
            required
          />

          {/* Type ID */}
          <div>
            <Input
              label={words.typeId}
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder={words.typeIdPlaceholder}
              size="md"
              disabled={isEditMode} // Cannot change type in edit mode
              required
            />
            <span className="form-hint">{words.typeIdHint}</span>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-color)]">{words.description}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={words.descriptionPlaceholder}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent max-w-[400px]"
              rows={2}
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-color)]">{words.colour}</label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-20 h-10 cursor-pointer"
                size="xs"
              />
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                size="xs"
                className="flex-1"
                pattern="^#[0-9A-Fa-f]{6}$"
                required
              />
            </div>
          </div>

          {/* Line Style */}
          <Select
            label={words.lineStyle}
            value={lineStyle}
            onChange={(e) => setLineStyle(e.target.value as 'solid' | 'dashed' | 'dotted')}
            required
          >
            <option value="solid">{words.lineStyles.solid}</option>
            <option value="dashed">{words.lineStyles.dashed}</option>
            <option value="dotted">{words.lineStyles.dotted}</option>
          </Select>

          {/* Stroke Width */}
          <div>
            <Input
              label={words.thickness}
              type="number"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              min={1}
              max={10}
              step={0.5}
              size="xs"
              required
            />
            <span className="form-hint">{words.thicknessHint}</span>
          </div>

          {/* Live Preview */}
          <div className="form-field">
            <label>{words.preview}</label>
            <ConnectionLinePreview
              color={color}
              lineStyle={lineStyle}
              strokeWidth={strokeWidth}
              strokeDasharray={getStrokeDasharray()}
              width={150}
              height={50}
            />
          </div>

        {/* Error Message */}
        {error && <div className="modal-error-box mb-4">{words.errors[error]}</div>}
      </FormContainer>
    </Modal>
  );
};

export default ConnectionTemplateEditModal;
