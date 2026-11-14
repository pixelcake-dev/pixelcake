import { useState, useMemo, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Minus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Scrollbars } from 'react-custom-scrollbars-2';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { useUIStore } from '@/store/uiStore';
import { useTemplateStore } from '@/store/templateStore';
import { useNetworkStore } from '@/store/networkStore';
import { bulkAddDevices } from '@/utils/bulkDeviceHelpers';
import { withLeases } from '@/engine';

/**
 * Configurable Device Row
 * Represents a single row in the configurable devices table
 */
interface ConfigurableDeviceRow {
  id: string;
  templateId: string;
  portCount: number;
  quantity: number;
}

const BulkAddDeviceModal = () => {
  const isOpen = useUIStore((state) => state.modals.bulkAddDevice);
  const closeModal = useUIStore((state) => state.closeModal);

  const templates = useTemplateStore((state) => state.templates);
  const genericTemplates = templates.filter((t) => !t.isCustom);

  const devices = useNetworkStore((state) => state.devices);
  const globalSettings = useNetworkStore((state) => state.globalNetworkSettings);
  const addDevice = useNetworkStore((state) => state.addDevice);

  // Separate configurable and standard templates
  const configurableTemplates = genericTemplates.filter(t => t.supportsPorts);
  const standardTemplates = genericTemplates.filter(t => t.supportsNICs && !t.supportsPorts);

  // State for configurable devices (Switch/Router/Firewall with dynamic port counts)
  const [configurableRows, setConfigurableRows] = useState<ConfigurableDeviceRow[]>([]);

  // State for standard devices (PC/Server/Database with fixed 1 NIC): how
  // many of each row, by the id of its template. Several templates are of
  // one type (the servers), and a quantity belongs to one row
  const [standardQuantities, setStandardQuantities] = useState<Record<string, number>>({});

  // State for search query
  const [searchQuery, setSearchQuery] = useState('');

  // State for add menu
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Track previous isOpen value to detect modal opening
  const prevIsOpenRef = useRef(false);

  // Initialize standard quantities only when modal opens
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const initialQuantities: Record<string, number> = {};
      standardTemplates.forEach((template) => {
        initialQuantities[template.id] = 0;
      });
      setStandardQuantities(initialQuantities);
      setConfigurableRows([]); // Reset configurable rows
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, standardTemplates]);

  // Calculate total device count
  const totalCount = useMemo(() => {
    const configurableTotal = configurableRows.reduce((sum, row) => sum + row.quantity, 0);
    const standardTotal = Object.values(standardQuantities).reduce((sum, qty) => sum + qty, 0);
    return configurableTotal + standardTotal;
  }, [configurableRows, standardQuantities]);

  // Filter configurable rows by search query
  const filteredConfigurableRows = useMemo(() => {
    if (!searchQuery.trim()) return configurableRows;

    const query = searchQuery.toLowerCase();
    return configurableRows.filter(row => {
      const template = configurableTemplates.find(t => t.id === row.templateId);
      return (
        template?.name.toLowerCase().includes(query) ||
        `${row.portCount} porte`.includes(query) ||
        `${row.portCount}`.includes(query)
      );
    });
  }, [configurableRows, searchQuery, configurableTemplates]);

  // Filter standard templates by search query
  const filteredStandardTemplates = useMemo(() => {
    if (!searchQuery.trim()) return standardTemplates;

    const query = searchQuery.toLowerCase();
    return standardTemplates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.type.toLowerCase().includes(query)
    );
  }, [standardTemplates, searchQuery]);

  // Add configurable device row
  const handleAddConfigurableRow = (templateId: string) => {
    const template = configurableTemplates.find(t => t.id === templateId);
    if (!template) return;

    const newRow: ConfigurableDeviceRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      templateId,
      portCount: template.defaultPortCount || template.portOptions?.[0] || 8,
      quantity: 0,
    };

    setConfigurableRows(prev => [...prev, newRow]);
    setShowAddMenu(false);
  };

  // Remove configurable device row
  const handleRemoveConfigurableRow = (rowId: string) => {
    setConfigurableRows(prev => prev.filter(row => row.id !== rowId));
  };

  // Update configurable device row
  const handleUpdateConfigurableRow = (rowId: string, updates: Partial<ConfigurableDeviceRow>) => {
    setConfigurableRows(prev =>
      prev.map(row => (row.id === rowId ? { ...row, ...updates } : row))
    );
  };

  // Update standard device quantity
  const handleUpdateStandardQuantity = (templateId: string, delta: number) => {
    setStandardQuantities(prev => {
      const current = prev[templateId] || 0;
      const newValue = Math.max(0, current + delta);
      return { ...prev, [templateId]: newValue };
    });
  };

  // Handle input change for standard devices
  const handleStandardInputChange = (templateId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setStandardQuantities(prev => ({ ...prev, [templateId]: numValue }));
    } else if (value === '') {
      setStandardQuantities(prev => ({ ...prev, [templateId]: 0 }));
    }
  };

  // Handle input change for configurable devices
  const handleConfigurableInputChange = (rowId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      handleUpdateConfigurableRow(rowId, { quantity: numValue });
    } else if (value === '') {
      handleUpdateConfigurableRow(rowId, { quantity: 0 });
    }
  };

  const handleAddDevices = () => {
    if (totalCount === 0) {
      toast.info('Seleziona almeno un dispositivo da aggiungere.');
      return;
    }

    // (the addresses proposed skip those a device has, written by hand or
    // leased by DHCP)
    const { connections } = useNetworkStore.getState();
    const added = bulkAddDevices(
      configurableRows,
      standardQuantities,
      withLeases({ devices, connections }).devices,
      globalSettings,
      templates,
      addDevice
    );

    closeModal('bulkAddDevice');

    toast.success(added === 1 ? '1 dispositivo aggiunto' : `${added} dispositivi aggiunti`);
  };

  const handleClose = () => {
    closeModal('bulkAddDevice');
    setSearchQuery('');
    setConfigurableRows([]);
    setShowAddMenu(false);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Aggiungi Dispositivi in Blocco"
      size="lg"
      noScroll={true}
    >
      <div className="flex flex-col h-full px-6 py-4">
        {/* Search Bar */}
        <div className="mb-4 flex-shrink-0">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cerca per tipo o configurazione..."
            autoFocus={false}
            inputWidth="100%"
            size="md"
          />
        </div>

        {/* Content Area with Scrollbars. The list takes what the window of the
            browser leaves it: the dialog is at most 85vh tall, and its title,
            search field, total and buttons take about 240px of that. With a
            fixed height the two buttons fell out of the dialog on a low window */}
        <div className="flex-1 overflow-hidden mb-4">
          <Scrollbars
            autoHeight
            autoHeightMax="min(500px, calc(85vh - 240px))"
            style={{ width: '100%' }}
            renderView={({ style, ...props }) => (
              <div {...props} style={{
                ...style,
                marginRight: -20,
                marginBottom: -20
              }} />
            )}
            renderThumbVertical={({ style, ...props }) => (
              <div
                {...props}
                style={{
                  ...style,
                  backgroundColor: 'var(--scroll-thumb)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  border: '2px solid transparent',
                  backgroundClip: 'padding-box',
                }}
              />
            )}
            renderTrackVertical={({ style, ...props }) => (
              <div
                {...props}
                style={{
                  ...style,
                  width: '10px',
                  right: '-2px',
                  bottom: '-2px',
                  top: '-2px',
                  background: 'linear-gradient(to right, transparent calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% - 1px), rgba(128, 128, 128, 0.3) calc(50% + 1px), transparent calc(50% + 1px))',
                }}
              />
            )}
          >
            <div className="pr-4 space-y-6">
              {/* CONFIGURABLE DEVICES SECTION */}
              <div className="configurable-section">
                <h3 className="section-title">
                  DISPOSITIVI CONFIGURABILI
                </h3>

                {filteredConfigurableRows.length > 0 ? (
                  <table className="bulk-add-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35%' }}>Tipo</th>
                        <th style={{ width: '30%' }}>Configurazione</th>
                        <th style={{ width: '20%' }}>Quantità</th>
                        <th style={{ width: '15%' }}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredConfigurableRows.map(row => {
                        const template = configurableTemplates.find(t => t.id === row.templateId);
                        if (!template) return null;

                        return (
                          <tr key={row.id}>
                            {/* Type Column */}
                            <td className="type-cell">
                              <Icon
                                icon={template.icon}
                                width={20}
                                height={20}
                                style={{ color: template.color }}
                              />
                              <span>{template.name}</span>
                            </td>

                            {/* Configuration Dropdown */}
                            <td className="config-cell">
                              <select
                                value={row.portCount}
                                onChange={(e) => handleUpdateConfigurableRow(row.id, {
                                  portCount: parseInt(e.target.value)
                                })}
                                className="config-select"
                              >
                                {template.portOptions?.map(portCount => (
                                  <option key={portCount} value={portCount}>
                                    {portCount} porte
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Quantity Input */}
                            <td className="quantity-cell">
                              <input
                                type="text"
                                value={row.quantity}
                                onChange={(e) => handleConfigurableInputChange(row.id, e.target.value)}
                                className="quantity-input"
                              />
                            </td>

                            {/* Remove Button */}
                            <td className="actions-cell">
                              <button
                                onClick={() => handleRemoveConfigurableRow(row.id)}
                                className="remove-btn"
                                title="Rimuovi riga"
                              >
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : configurableRows.length > 0 ? (
                  <div className="text-center text-[var(--text-color-light)] py-4 text-sm">
                    Nessun dispositivo trovato per "{searchQuery}"
                  </div>
                ) : null}

                {/* Add Button with Dropdown Menu */}
                <div className="add-row-container">
                  <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="add-row-btn"
                  >
                    <Plus size={16} />
                    Aggiungi Switch/Router/Firewall
                  </button>

                  {showAddMenu && (
                    <div className="add-menu">
                      {configurableTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => handleAddConfigurableRow(template.id)}
                          className="add-menu-item"
                        >
                          <Icon
                            icon={template.icon}
                            width={18}
                            height={18}
                            style={{ color: template.color }}
                          />
                          {template.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* STANDARD DEVICES SECTION */}
              {filteredStandardTemplates.length > 0 && (
                <div className="standard-section">
                  <h3 className="section-title">
                    DISPOSITIVI STANDARD (1 NIC di default)
                  </h3>

                  <table className="bulk-add-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50%' }}>Tipo</th>
                        <th style={{ width: '25%' }}>Quantità</th>
                        <th style={{ width: '25%' }}>Controlli</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStandardTemplates.map(template => (
                        <tr key={template.id}>
                          {/* Type Column */}
                          <td className="type-cell">
                            <Icon
                              icon={template.icon}
                              width={20}
                              height={20}
                              style={{ color: template.color }}
                            />
                            <span>{template.name}</span>
                          </td>

                          {/* Quantity Input */}
                          <td className="quantity-cell">
                            <input
                              type="text"
                              value={standardQuantities[template.id] || 0}
                              onChange={(e) => handleStandardInputChange(template.id, e.target.value)}
                              className="quantity-input"
                            />
                          </td>

                          {/* +/- Buttons */}
                          <td className="controls-cell">
                            <div className="controls-wrapper">
                              <button
                                onClick={() => handleUpdateStandardQuantity(template.id, -1)}
                                disabled={(standardQuantities[template.id] || 0) === 0}
                                className="quantity-btn"
                                title="Diminuisci"
                              >
                                <Minus size={14} />
                              </button>
                              <button
                                onClick={() => handleUpdateStandardQuantity(template.id, 1)}
                                className="quantity-btn"
                                title="Aumenta"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Scrollbars>
        </div>

        {/* Total Count */}
        <div className="pt-3 border-t border-[var(--border-color)] flex-shrink-0">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--text-color)]">Totale Dispositivi:</span>
            <span className="text-lg font-bold text-[var(--text-color)]">
              {totalCount}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-1.5 text-sm font-semibold rounded-md border border-[var(--border-color)] bg-transparent text-[var(--text-color)] hover:border-[var(--text-color)] transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleAddDevices}
            disabled={totalCount === 0}
            className="flex-1 px-4 py-1.5 text-sm font-semibold rounded-md border border-[var(--text-color)] bg-[var(--text-color)] text-[var(--bg-canvas)] enabled:hover:bg-[var(--accent-color)] enabled:hover:border-[var(--accent-color)] enabled:hover:text-[var(--on-accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Aggiungi ({totalCount})
          </button>
        </div>
      </div>

      {/* Inline CSS for table styling */}
      <style>{`
        /* Section Titles */
        .section-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-color-light);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-color);
        }

        /* Table Styles */
        .bulk-add-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-bottom: 16px;
        }

        .bulk-add-table thead {
          background-color: var(--bg-toolbar);
        }

        .bulk-add-table th {
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          color: var(--text-color-light);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid var(--border-color);
        }

        .bulk-add-table tbody tr {
          border-bottom: 1px solid var(--border-color);
          transition: background-color 0.15s ease;
        }

        .bulk-add-table tbody tr:hover {
          background-color: var(--bg-hover);
        }

        .bulk-add-table td {
          padding: 10px 12px;
          vertical-align: middle;
        }

        /* Type Cell */
        .type-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 500;
          color: var(--text-color);
          font-size: 14px;
        }

        /* Config Select */
        .config-select {
          width: 100%;
          padding: 6px 10px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          background-color: var(--bg-canvas);
          color: var(--text-color);
          font-size: 13px;
          cursor: pointer;
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
        }

        .config-select:hover {
          border-color: var(--text-color);
        }

        .config-select:focus {
          outline: none;
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb), 0.3);
        }

        /* Quantity Cell */
        .quantity-cell {
          text-align: center;
        }

        .quantity-input {
          width: 80px;
          padding: 6px 10px;
          text-align: center;
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          background-color: var(--bg-canvas);
          color: var(--text-color);
          font-size: 14px;
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
        }

        .quantity-input:hover {
          border-color: var(--text-color);
        }

        .quantity-input:focus {
          outline: none;
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb), 0.3);
        }

        /* Actions Cell */
        .actions-cell {
          text-align: center;
        }

        .remove-btn {
          padding: 6px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          background-color: transparent;
          color: var(--text-color-light);
          cursor: pointer;
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .remove-btn:hover {
          background-color: var(--danger-color);
          color: white;
          border-color: var(--danger-color);
        }

        /* Controls Cell */
        .controls-cell {
          padding: 0 12px;
        }

        .controls-wrapper {
          display: flex;
          gap: 6px;
          justify-content: center;
        }

        .quantity-btn {
          padding: 6px 10px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          background-color: var(--bg-canvas);
          color: var(--text-color);
          cursor: pointer;
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .quantity-btn:hover:not(:disabled) {
          background-color: var(--bg-hover);
          border-color: var(--text-color);
          color: var(--text-color);
        }

        .quantity-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Add Row Container */
        .add-row-container {
          position: relative;
          margin-bottom: 8px;
        }

        .add-row-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border: 1px dashed var(--border-color);
          border-radius: var(--radius);
          background-color: transparent;
          color: var(--text-color-light);
          cursor: pointer;
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
          width: 100%;
          font-size: 13px;
          font-weight: 500;
        }

        .add-row-btn:hover {
          border-color: var(--text-color);
          color: var(--text-color);
          background-color: var(--bg-hover);
        }

        /* Add Menu Dropdown */
        .add-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          min-width: 200px;
          background-color: var(--bg-menu);
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          box-shadow: 0 8px 24px var(--shadow-color);
          z-index: 10;
          overflow: hidden;
        }

        .add-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          border: none;
          background-color: transparent;
          color: var(--text-color);
          text-align: left;
          cursor: pointer;
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
          font-size: 14px;
          font-weight: 500;
        }

        .add-menu-item:hover {
          background-color: var(--bg-hover);
          color: var(--text-color);
        }

        .add-menu-item:not(:last-child) {
          border-bottom: 1px solid var(--border-color);
        }

        /* Spacing adjustments */
        .configurable-section {
          margin-bottom: 8px;
        }

        .standard-section {
          margin-bottom: 0;
        }
      `}</style>
    </Modal>
  );
};

export default BulkAddDeviceModal;
