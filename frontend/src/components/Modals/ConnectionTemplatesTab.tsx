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

const ConnectionTemplatesTab = () => {
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

  const handleDelete = (template: ConnectionTemplate) => {
    const confirmed = confirm(
      `Sei sicuro di voler eliminare il tipo connessione "${template.name}"?\n\nLe connessioni esistenti con questo tipo potrebbero non visualizzarsi correttamente.`
    );
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
        <p className="text-sm text-[var(--text-color-light)]">
          Tipi di connessione disponibili per i collegamenti tra dispositivi
        </p>
        <Button variant="primary" onClick={handleAddNew} className="add-template-btn">
          <Plus size={18} />
          Nuovo Tipo Connessione
        </Button>
      </div>

      {/* Template Grid */}
      <div className="template-grid">
        {connectionTemplates.map((template) => (
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
              {template.description && (
                <span className="text-xs text-[var(--text-color-light)] mt-1">
                  {template.description}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="template-actions">
              <button
                className="action-btn edit-btn"
                onClick={() => handleEdit(template)}
                title="Modifica tipo connessione"
              >
                <Pencil size={14} />
              </button>
              {template.isCustom && (
                <button
                  className="action-btn delete-btn"
                  onClick={() => handleDelete(template)}
                  title="Elimina tipo connessione"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {connectionTemplates.length === 0 && (
          <div className="col-span-full text-center py-8 text-[var(--text-color-light)]">
            <p>Nessun tipo di connessione disponibile</p>
            <p className="text-sm mt-2">Clicca su "Nuovo Tipo Connessione" per iniziare</p>
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
