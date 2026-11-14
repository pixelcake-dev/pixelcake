import { useState } from 'react';
import DeviceDrawing from '@/components/ui/DeviceDrawing';
import { drawingOf } from '@/utils/deviceDrawing';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTemplateStore } from '@/store/templateStore';
import TemplateEditModal from './TemplateEditModal';
import type { DeviceTemplate } from '@/types/network';
import { askConfirm } from '@/store/confirmStore';

interface GenericTemplatesTabProps {
  templates: DeviceTemplate[];
}

const GenericTemplatesTab = ({ templates }: GenericTemplatesTabProps) => {
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DeviceTemplate | null>(null);

  const handleAddNew = () => {
    setSelectedTemplate(null);
    setEditModalOpen(true);
  };

  const handleEdit = (template: DeviceTemplate) => {
    setSelectedTemplate(template);
    setEditModalOpen(true);
  };

  const handleDelete = async (template: DeviceTemplate) => {
    const confirmed = await askConfirm({
      title: `Eliminare il template «${template.name}»?`,
      detail: 'I dispositivi esistenti di questo tipo potrebbero non essere più disegnati come prima.',
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (confirmed) {
      deleteTemplate(template.id);
    }
  };

  const handleCloseModal = () => {
    setEditModalOpen(false);
    setSelectedTemplate(null);
  };

  return (
    <div className="generic-templates-tab">
      {/* Header with Add Button */}
      <div className="tab-header">
        <p className="text-sm text-[var(--text-color-light)]">
          Dispositivi predefiniti disponibili per uso rapido
        </p>
        <Button variant="primary" onClick={handleAddNew} className="add-template-btn">
          <Plus size={18} />
          Aggiungi Nuovo Template
        </Button>
      </div>

      {/* Template Grid */}
      <div className="template-grid">
        {templates.map((template) => (
          <div key={template.id} className="template-card editable">
            <div className="template-icon-wrapper">
              <DeviceDrawing drawing={drawingOf(template, template.type)} size={40} />
            </div>
            <div className="template-info">
              <span className="template-name font-semibold">{template.name}</span>
              <span className="template-type text-xs text-[var(--text-color-light)]">
                {template.type}
              </span>
            </div>
            {/* Action Buttons */}
            <div className="template-actions">
              <button
                className="action-btn edit-btn"
                onClick={() => handleEdit(template)}
                title="Modifica template"
              >
                <Pencil size={16} />
              </button>
              <button
                className="action-btn delete-btn"
                onClick={() => handleDelete(template)}
                title="Elimina template"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Create Modal */}
      <TemplateEditModal
        isOpen={editModalOpen}
        onClose={handleCloseModal}
        template={selectedTemplate}
      />
    </div>
  );
};

export default GenericTemplatesTab;
