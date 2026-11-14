import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTemplateStore } from '@/store/templateStore';
import type { DeviceTemplate, DeviceType } from '@/types/network';
import { askConfirm } from '@/store/confirmStore';
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
  const [formData, setFormData] = useState({
    name: '',
    type: 'Server' as DeviceType,
    icon: 'mdi:server',
    color: '#5E8096',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const supportsVLAN = ['Switch', 'Router', 'Firewall'].includes(formData.type);
    const supportsSTP = ['Switch', 'Router', 'Firewall'].includes(formData.type);
    const supportsPorts = ['Switch', 'Router', 'Firewall'].includes(formData.type);
    const supportsNICs = !supportsPorts;

    addTemplate({
      name: formData.name,
      type: formData.type,
      icon: formData.icon,
      color: formData.color,
      isCustom: true,
      supportsVLAN,
      supportsSTP,
      supportsPorts,
      supportsNICs,
    });

    // Reset form
    setFormData({
      name: '',
      type: 'Server',
      icon: 'mdi:server',
      color: '#5E8096',
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
                setFormData({ ...formData, type: e.target.value as DeviceType })
              }
            >
              <option value="Server">Server</option>
              <option value="Firewall">Firewall</option>
              <option value="LoadBalancer">Load Balancer</option>
              <option value="Database">Database</option>
              <option value="Cloud">Cloud</option>
              <option value="Router">Router</option>
              <option value="Switch">Switch</option>
            </Select>

            <Input
              label={words.icon}
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder={words.iconPlaceholder}
              required
            />

            <div>
              <label className="block text-sm font-medium mb-2">{t.templates.devices.colour}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-20 border border-[var(--border-color)] rounded cursor-pointer"
                />
                <Icon
                  icon={formData.icon}
                  width={40}
                  height={40}
                  style={{ color: formData.color }}
                />
              </div>
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
                <Icon
                  icon={template.icon}
                  width={32}
                  height={32}
                  style={{ color: template.color }}
                />
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
