import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import DeviceDrawing from '@/components/ui/DeviceDrawing';
import DrawingPicker from '@/components/ui/DrawingPicker';
import { drawingOf } from '@/utils/deviceDrawing';
import type { DeviceDrawingId } from '@/data/deviceDrawings';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTemplateStore } from '@/store/templateStore';
import type { DeviceTemplate, DeviceType } from '@/types/network';
import { askConfirm } from '@/store/confirmStore';
import { BASE_TYPES, BASE_TYPE_GROUPS, templateFieldsOfType } from '@/utils/templateBaseTypes';
import { useT } from '@/i18n';

interface CustomTemplatesTabProps {
  templates: DeviceTemplate[];
}

const CustomTemplatesTab = ({ templates }: CustomTemplatesTabProps) => {
  const t = useT();
  const words = t.templates.devices.custom;
  const addTemplate = useTemplateStore((state) => state.addTemplate);
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);

  const [isCreating, setIsCreating] = useState(false);
  // (a new template starts with the drawing of its base type)
  const [formData, setFormData] = useState({
    name: '',
    type: 'Server' as DeviceType,
    icon: 'server' as DeviceDrawingId,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addTemplate({
      name: formData.name,
      type: formData.type,
      icon: formData.icon,
      color: '#5E8096',
      isCustom: true,
      ...templateFieldsOfType(formData.type),
    });

    // Reset form
    setFormData({
      name: '',
      type: 'Server',
      icon: 'server',
    });
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await askConfirm({
      title: words.deleteQuestion,
      confirmLabel: t.common.actions.delete,
      danger: true,
    });
    if (confirmed) {
      deleteTemplate(id);
    }
  };

  return (
    <div className="custom-templates-tab">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-[var(--text-color-light)]">{words.intro}</p>
        {!isCreating && (
          <Button variant="primary" onClick={() => setIsCreating(true)}>
            {words.add}
          </Button>
        )}
      </div>

      {/* Create Form */}
      {isCreating && (
        <form onSubmit={handleSubmit} className="template-form mb-6 p-4 border border-[var(--border-color)] rounded-lg">
          <h4 className="font-semibold mb-3">{words.formTitle}</h4>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={words.name}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={words.namePlaceholder}
              required
            />

            <Select
              label={t.templates.devices.baseType}
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as DeviceType,
                  icon: drawingOf(undefined, e.target.value),
                })
              }
            >
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

            <div className="col-span-2">
              <DrawingPicker
                label={t.templates.devices.drawing}
                value={formData.icon}
                onChange={(icon) => setFormData({ ...formData, icon })}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button type="submit" variant="primary">
              {words.save}
            </Button>
            <Button type="button" onClick={() => setIsCreating(false)}>
              {t.common.actions.cancel}
            </Button>
          </div>
        </form>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <p className="text-center text-[var(--text-color-light)] py-8">{words.empty}</p>
      ) : (
        <div className="template-list space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="template-item flex items-center justify-between p-3 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-menu)] transition"
            >
              <div className="flex items-center gap-3">
                <DeviceDrawing drawing={drawingOf(template, template.type)} size={32} />
                <div>
                  <div className="font-semibold">{template.name}</div>
                  <div className="text-xs text-[var(--text-color-light)]">
                    {template.type}
                    {template.terraformFields?.provider && (
                      <span> • {template.terraformFields.provider}</span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(template.id)}
              >
                {t.common.actions.delete}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomTemplatesTab;
