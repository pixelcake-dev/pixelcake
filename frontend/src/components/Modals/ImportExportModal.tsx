/**
 * Import/Export Modal
 * Export the topology as YAML (which can be imported back) or as a Terraform
 * HCL draft (a sketch that cannot be applied), import from YAML files
 */

import { useState, useRef, useCallback } from 'react';
import { X, Download, Copy, Upload, FileText, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { generateTerraform } from '@/utils/exportTerraform';
import { generateYaml } from '@/utils/exportYaml';
import { parseYamlTopology } from '@/utils/importYaml';
import type { ImportResult } from '@/utils/importYaml';

type ExportFormat = 'terraform' | 'yaml';
type ActiveTab = 'export' | 'import';
type ImportMode = 'replace' | 'append';

const ImportExportModal = () => {
  const isOpen = useUIStore((state) => state.modals.importExport);
  const closeModal = useUIStore((state) => state.closeModal);
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const loadTopology = useNetworkStore((state) => state.loadTopology);
  const addDevice = useNetworkStore((state) => state.addDevice);
  const addConnection = useNetworkStore((state) => state.addConnection);
  const clearAllDevices = useNetworkStore((state) => state.clearAllDevices);
  const currentProjectName = useProjectStore((state) => state.name);

  const [activeTab, setActiveTab] = useState<ActiveTab>('export');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('yaml');
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectName = currentProjectName || 'pixelcake-topology';

  const handleClose = () => {
    closeModal('importExport');
    setActiveTab('export');
    setImportResult(null);
    setImportFileName('');
    setCopied(false);
  };

  // --- Export ---

  const getExportContent = useCallback((): string => {
    if (exportFormat === 'terraform') {
      return generateTerraform(devices, connections, projectName);
    }
    return generateYaml(devices, connections, projectName);
  }, [exportFormat, devices, connections, projectName]);

  const getFileName = (): string => {
    const safeName = projectName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    return exportFormat === 'terraform'
      ? `${safeName}-topology.tf`
      : `${safeName}-topology.yaml`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getExportContent());
      setCopied(true);
      toast.success('Copiato negli appunti');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Errore durante la copia');
    }
  };

  const handleDownload = () => {
    const content = getExportContent();
    const fileName = getFileName();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`File scaricato: ${fileName}`);
  };

  // --- Import ---

  const processFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'yaml' && ext !== 'yml') {
      toast.error('Formato non supportato. Usa file .yaml o .yml');
      return;
    }

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = parseYamlTopology(content);
      setImportResult(result);
    };
    reader.onerror = () => {
      toast.error('Errore durante la lettura del file');
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    if (!importResult || importResult.devices.length === 0) {
      toast.error('Nessun dispositivo da importare');
      return;
    }

    if (importMode === 'replace') {
      clearAllDevices();
      loadTopology(importResult.devices, importResult.connections);
      toast.success(`Topologia importata: ${importResult.devices.length} dispositivi, ${importResult.connections.length} connessioni`);
    } else {
      // Append mode — add devices and connections individually
      // loadTopology replaces, so we use addDevice/addConnection for append
      const idMapping = new Map<string, string>();

      for (const device of importResult.devices) {
        const oldId = device.id;
        // addDevice generates a new ID internally — pass device without id
        addDevice({
          type: device.type,
          templateId: device.templateId,
          label: device.label,
          ip: device.ip,
          subnet: device.subnet,
          gateway: device.gateway,
          position: device.position,
          vendor: device.vendor,
          location: device.location,
          vlan: device.vlan,
          stp: device.stp,
          portCount: device.portCount,
          ports: device.ports,
          nics: device.nics,
        });
        // Get the newly created device (last one in array)
        const newDevices = useNetworkStore.getState().devices;
        const newDevice = newDevices[newDevices.length - 1];
        idMapping.set(oldId, newDevice.id);
      }

      for (const conn of importResult.connections) {
        const newSource = idMapping.get(conn.source);
        const newTarget = idMapping.get(conn.target);
        if (newSource && newTarget) {
          addConnection({
            source: newSource,
            target: newTarget,
            sourceHandle: conn.sourceHandle,
            targetHandle: conn.targetHandle,
            // Interface bindings read from the file (port ids and NIC ids are
            // per device, so they hold for the appended copies); ends without
            // one are bound to a free interface by addConnection
            sourcePort: conn.sourcePort,
            sourceNic: conn.sourceNic,
            targetPort: conn.targetPort,
            targetNic: conn.targetNic,
            type: conn.type,
            bandwidth: conn.bandwidth,
            vlan: conn.vlan,
            label: conn.label,
            color: conn.color,
            stpPortState: conn.stpPortState,
            stpPortPriority: conn.stpPortPriority,
          });
        }
      }

      toast.success(`Aggiunti: ${importResult.devices.length} dispositivi, ${importResult.connections.length} connessioni`);
    }

    handleClose();
  };

  if (!isOpen) return null;

  const exportContent = activeTab === 'export' ? getExportContent() : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title=""
      size="lg"
      variant="tabbed"
      autoHeight={true}
      minHeight={undefined}
      maxHeight="calc(90vh - 120px)"
      verticalAlign="start"
      fixedContent={
        <>
          {/* Header */}
          <div className="modal-header flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-color)' }}>
              Import / Export
            </h3>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-[var(--bg-canvas)] rounded"
              style={{ color: 'var(--text-color-light)' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Buttons */}
          <div className="settings-tabs px-6 pt-2 pb-3 border-b border-[var(--border-color)]">
            <button
              className={`settings-tab ${activeTab === 'export' ? 'active' : ''}`}
              onClick={() => setActiveTab('export')}
            >
              <Download size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              Export
            </button>
            <button
              className={`settings-tab ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              <Upload size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              Import
            </button>
          </div>
        </>
      }
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          {activeTab === 'export' ? (
            <>
              <Button variant="secondary" onClick={handleCopy} disabled={devices.length === 0}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiato' : 'Copia negli appunti'}
              </Button>
              <Button variant="primary" onClick={handleDownload} disabled={devices.length === 0}>
                <Download size={14} />
                Scarica {getFileName()}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={handleClose}>
                Annulla
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={!importResult || importResult.devices.length === 0}
              >
                <Upload size={14} />
                Importa
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="settings-content" style={{ minHeight: '400px' }}>
        {activeTab === 'export' ? (
          <ExportTab
            format={exportFormat}
            onFormatChange={setExportFormat}
            content={exportContent}
            deviceCount={devices.length}
            connectionCount={connections.length}
          />
        ) : (
          <ImportTab
            isDragging={isDragging}
            importResult={importResult}
            importFileName={importFileName}
            importMode={importMode}
            onModeChange={setImportMode}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
            fileInputRef={fileInputRef}
          />
        )}
      </div>
    </Modal>
  );
};

// --- Export Tab ---

interface ExportTabProps {
  format: ExportFormat;
  onFormatChange: (f: ExportFormat) => void;
  content: string;
  deviceCount: number;
  connectionCount: number;
}

const ExportTab = ({ format, onFormatChange, content, deviceCount, connectionCount }: ExportTabProps) => (
  <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {/* Format selector + Stats */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label
          htmlFor="export-format"
          style={{ fontSize: '0.85em', color: 'var(--text-color-light)' }}
        >
          Formato:
        </label>
        <select
          id="export-format"
          value={format}
          onChange={(e) => onFormatChange(e.target.value as ExportFormat)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-toolbar)',
            color: 'var(--text-color)',
            fontSize: '0.85em',
          }}
        >
          <option value="yaml">YAML (.yaml)</option>
          <option value="terraform">Terraform HCL (bozza)</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: '16px', fontSize: '0.8em', color: 'var(--text-color-light)' }}>
        <span>{deviceCount} dispositivi</span>
        <span>{connectionCount} connessioni</span>
      </div>
    </div>

    {/* The Terraform export is a sketch: say so before anyone tries to apply it */}
    {format === 'terraform' && (
      <div className="modal-info-box" role="note">
        <strong>È una bozza: non si può applicare con Terraform.</strong> I tipi di risorsa sono
        segnaposto e non è indicato alcun provider. Per salvare la topologia e poterla ricaricare
        usa il formato YAML.
      </div>
    )}

    {/* Preview */}
    {deviceCount === 0 ? (
      <div className="modal-info-box" style={{ textAlign: 'center', marginTop: '20px' }}>
        <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
        <p>Nessun dispositivo nella topologia corrente.</p>
        <p style={{ fontSize: '0.85em', marginTop: '4px' }}>Aggiungi dispositivi al canvas per poterli esportare.</p>
      </div>
    ) : (
      <div
        style={{
          position: 'relative',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}
      >
        {/* Code header bar */}
        <div
          style={{
            padding: '6px 12px',
            background: 'var(--bg-toolbar)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75em',
            color: 'var(--text-color-light)',
          }}
        >
          <span>{format === 'terraform' ? 'main.tf' : 'topology.yaml'}</span>
          <span>{content.split('\n').length} righe</span>
        </div>

        {/* Code content */}
        <pre
          style={{
            margin: 0,
            padding: '12px 16px',
            background: 'var(--bg-canvas)',
            color: 'var(--text-color)',
            fontSize: '0.8em',
            lineHeight: '1.5',
            fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: '400px',
            whiteSpace: 'pre',
            tabSize: 2,
          }}
        >
          {content}
        </pre>
      </div>
    )}
  </div>
);

// --- Import Tab ---

interface ImportTabProps {
  isDragging: boolean;
  importResult: ImportResult | null;
  importFileName: string;
  importMode: ImportMode;
  onModeChange: (m: ImportMode) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const ImportTab = ({
  isDragging,
  importResult,
  importFileName,
  importMode,
  onModeChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  fileInputRef,
}: ImportTabProps) => (
  <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {/* Drop zone */}
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      style={{
        padding: '32px',
        borderRadius: '8px',
        border: `2px dashed ${isDragging ? 'var(--accent-color)' : 'var(--border-color)'}`,
        background: isDragging ? 'rgba(var(--accent-color-rgb), 0.05)' : 'var(--bg-canvas)',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <Upload
        size={32}
        style={{
          margin: '0 auto 8px',
          color: isDragging ? 'var(--accent-color)' : 'var(--text-color-light)',
          opacity: isDragging ? 1 : 0.5,
        }}
      />
      <p style={{ color: 'var(--text-color)', fontSize: '0.9em', marginBottom: '4px' }}>
        {isDragging ? 'Rilascia il file qui' : 'Trascina un file qui o clicca per selezionare'}
      </p>
      <p style={{ color: 'var(--text-color-light)', fontSize: '0.8em' }}>
        Formati supportati: .yaml, .yml
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml"
        onChange={onFileSelect}
        style={{ display: 'none' }}
      />
    </div>

    {/* Import preview */}
    {importResult && (
      <>
        {/* File info */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'var(--bg-toolbar)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <FileText size={16} style={{ color: 'var(--accent-color)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-color)', fontSize: '0.9em' }}>
              {importFileName}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '20px', fontSize: '0.85em', color: 'var(--text-color-light)' }}>
            <span>{importResult.devices.length} dispositivi</span>
            <span>{importResult.connections.length} connessioni</span>
            {importResult.warnings.length > 0 && (
              <span style={{ color: '#f59e0b' }}>{importResult.warnings.length} avvisi</span>
            )}
          </div>
        </div>

        {/* Device list preview */}
        {importResult.devices.length > 0 && (
          <div
            style={{
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--bg-toolbar)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '0.8em',
                fontWeight: 600,
                color: 'var(--text-color)',
              }}
            >
              Dispositivi trovati
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {importResult.devices.map((d) => (
                <div
                  key={d.id}
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.82em',
                  }}
                >
                  <span style={{ color: 'var(--text-color)' }}>{d.label}</span>
                  <div style={{ display: 'flex', gap: '12px', color: 'var(--text-color-light)', fontSize: '0.9em' }}>
                    <span>{d.type}</span>
                    {d.ip && <span>{d.ip}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {importResult.warnings.length > 0 && (
          <div className="modal-error-box" style={{ fontSize: '0.82em' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: 600 }}>
              <AlertTriangle size={14} />
              Avvisi ({importResult.warnings.length})
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {importResult.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Import mode */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85em', color: 'var(--text-color-light)' }}>Modalità:</label>
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.85em', color: 'var(--text-color)', cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="importMode"
              checked={importMode === 'replace'}
              onChange={() => onModeChange('replace')}
            />
            Sostituisci topologia
          </label>
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.85em', color: 'var(--text-color)', cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="importMode"
              checked={importMode === 'append'}
              onChange={() => onModeChange('append')}
            />
            Aggiungi alla topologia
          </label>
        </div>
      </>
    )}
  </div>
);

export default ImportExportModal;
