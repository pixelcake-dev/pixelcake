import { useState } from 'react';
import DeviceDrawing from '@/components/ui/DeviceDrawing';
import { drawingOf } from '@/utils/deviceDrawing';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTemplateStore } from '@/store/templateStore';
import TemplateEditModal from './TemplateEditModal';
import type { DeviceTemplate } from '@/types/network';
import { askConfirm } from '@/store/confirmStore';
import { useT } from '@/i18n';

interface GenericTemplatesTabProps {
  templates: DeviceTemplate[];
}

const GenericTemplatesTab = ({ templates }: GenericTemplatesTabProps) => {
  const t = useT();
  const words = t.templates.devices.generic;
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
      title: words.deleteQuestion.title(template.name),
      detail: words.deleteQuestion.detail,
      confirmLabel: t.common.actions.delete,
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
        <p className="text-sm text-[var(--text-color-light)]">{words.intro}</p>
        <Button variant="primary" onClick={handleAddNew} className="add-template-btn">
          <Plus size={18} />
          {words.add}
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
                title={words.edit}
              >
                <Pencil size={16} />
              </button>
              <button
                className="action-btn delete-btn"
                onClick={() => handleDelete(template)}
                title={words.delete}
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
