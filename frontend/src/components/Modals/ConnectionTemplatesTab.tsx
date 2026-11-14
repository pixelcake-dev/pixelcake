/**
 * Connection Templates Tab
 * Displays and manages connection type templates
 */

import { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTemplateStore } from '@/store/templateStore';
import ConnectionTemplateEditModal from './ConnectionTemplateEditModal';
import ConnectionLinePreview from './ConnectionLinePreview';
import type { ConnectionTemplate } from '@/types/network';
import { askConfirm } from '@/store/confirmStore';
import { useT } from '@/i18n';
import { linkTypeDescription } from '@/utils/templateText';

const ConnectionTemplatesTab = () => {
  const t = useT();
  const words = t.templates.links;
  const connectionTemplates = useTemplateStore((state) => state.connectionTemplates);
  const deleteConnectionTemplate = useTemplateStore((state) => state.deleteConnectionTemplate);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ConnectionTemplate | undefined>(
    undefined
  );

  const handleAddNew = () => {
    setSelectedTemplate(undefined);
    setEditModalOpen(true);
  };

  const handleEdit = (template: ConnectionTemplate) => {
    setSelectedTemplate(template);
    setEditModalOpen(true);
  };

  const handleDelete = async (template: ConnectionTemplate) => {
    const confirmed = await askConfirm({
      title: words.deleteQuestion.title(template.name),
      detail: words.deleteQuestion.detail,
      confirmLabel: t.common.actions.delete,
      danger: true,
    });
    if (confirmed) {
      deleteConnectionTemplate(template.id);
    }
  };

  const handleCloseModal = () => {
    setEditModalOpen(false);
    setSelectedTemplate(undefined);
  };

  return (
    <div className="connection-templates-tab">
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
        {connectionTemplates.map((template) => {
          // In the language of the interface while it is the app's own; as typed once rewritten
          const description = linkTypeDescription(template, t);
          return (
            <div key={template.id} className="template-card editable">
              {/* Line Preview */}
              <div className="template-icon-wrapper">
                <ConnectionLinePreview
                  color={template.color}
                  lineStyle={template.lineStyle}
                  strokeWidth={template.strokeWidth}
                  strokeDasharray={template.strokeDasharray}
                  width={80}
                  height={40}
                />
              </div>

              {/* Template Info */}
              <div className="template-info">
                <span className="template-name font-semibold">{template.name}</span>
                <span className="template-type text-xs text-[var(--text-color-light)]">
                  {template.type}
                </span>
                {description && (
                  <span className="text-xs text-[var(--text-color-light)] mt-1">{description}</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="template-actions">
                <button
                  className="action-btn edit-btn"
                  onClick={() => handleEdit(template)}
                  title={words.edit}
                >
                  <Pencil size={14} />
                </button>
                {template.isCustom && (
                  <button
                    className="action-btn delete-btn"
                    onClick={() => handleDelete(template)}
                    title={words.delete}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {connectionTemplates.length === 0 && (
          <div className="col-span-full text-center py-8 text-[var(--text-color-light)]">
            <p>{words.empty}</p>
            <p className="text-sm mt-2">{words.emptyHint}</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <ConnectionTemplateEditModal
        isOpen={editModalOpen}
        onClose={handleCloseModal}
        template={selectedTemplate}
      />
    </div>
  );
};

export default ConnectionTemplatesTab;
