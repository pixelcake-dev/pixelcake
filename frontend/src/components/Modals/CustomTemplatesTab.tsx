import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTemplateStore } from '@/store/templateStore';
import type { DeviceTemplate, DeviceType } from '@/types/network';

interface CustomTemplatesTabProps {
  templates: DeviceTemplate[];
}

const CustomTemplatesTab = ({ templates }: CustomTemplatesTabProps) => {
  const addTemplate = useTemplateStore((state) => state.addTemplate);
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Server' as DeviceType,
    icon: 'mdi:server',
    color: '#5B7C8D',
    terraformProvider: '',
    terraformResource: '',
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
      terraformFields: {
        provider: formData.terraformProvider,
        resource_type: formData.terraformResource,
      },
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
      color: '#5B7C8D',
      terraformProvider: '',
      terraformResource: '',
    });
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo template?')) {
      deleteTemplate(id);
    }
  };

  return (
    <div className="custom-templates-tab">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-[var(--text-color-light)]">
          Template personalizzati con campi Terraform
        </p>
        {!isCreating && (
          <Button variant="primary" onClick={() => setIsCreating(true)}>
            + Nuovo Template
          </Button>
        )}
      </div>

      {/* Create Form */}
      {isCreating && (
        <form onSubmit={handleSubmit} className="template-form mb-6 p-4 border border-[var(--border-color)] rounded-lg">
          <h4 className="font-semibold mb-3">Crea Nuovo Template</h4>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nome Template"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="es: AWS EC2 Instance"
              required
            />

            <Select
              label="Tipo Base"
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
              label="Icona Iconify"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="es: mdi:server"
              required
            />

            <div>
              <label className="block text-sm font-medium mb-2">
                Colore
              </label>
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

            <Input
              label="Terraform Provider"
              value={formData.terraformProvider}
              onChange={(e) => setFormData({ ...formData, terraformProvider: e.target.value })}
              placeholder="es: aws, azure, google"
            />

            <Input
              label="Terraform Resource Type"
              value={formData.terraformResource}
              onChange={(e) => setFormData({ ...formData, terraformResource: e.target.value })}
              placeholder="es: aws_instance, azurerm_firewall"
            />
          </div>

          <div className="flex gap-2 mt-4">
            <Button type="submit" variant="primary">
              Salva Template
            </Button>
            <Button type="button" onClick={() => setIsCreating(false)}>
              Annulla
            </Button>
          </div>
        </form>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <p className="text-center text-[var(--text-color-light)] py-8">
          Nessun template personalizzato. Creane uno!
        </p>
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
                Elimina
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomTemplatesTab;
