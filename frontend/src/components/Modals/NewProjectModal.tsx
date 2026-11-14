/**
 * New Project Modal
 * Form to create a new project with default settings.
 * The project is created in the browser and replaces the open one; whoever
 * opens this modal has already asked about unsaved changes
 * (requestNewProject in utils/projectFileAccess).
 */

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormContainer, FormFieldset } from '@/components/ui/FormContainer';
import { FieldRow, TextField } from '@/components/ui/compact';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { isValidIP } from '@/utils/ipHelpers';
import { useT } from '@/i18n';

/** Why the project was not created (kept as what it is: its words follow the language) */
type Problem = { kind: 'nameMissing' } | { kind: 'dnsNotAnAddress'; value: string };

const NewProjectModal = () => {
  const t = useT();
  const words = t.newProject;
  const isOpen = useUIStore((state) => state.modals.newProject);
  const closeModal = useUIStore((state) => state.closeModal);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ipClass, setIpClass] = useState('192.168.1.0');
  const [subnet, setSubnet] = useState('255.255.255.0');
  const [gateway, setGateway] = useState('192.168.1.1');
  const [dns, setDns] = useState('');
  const [error, setError] = useState<Problem | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setIpClass('192.168.1.0');
      setSubnet('255.255.255.0');
      setGateway('192.168.1.1');
      setDns('');
      setError(null);
    }
  }, [isOpen]);

  const handleCreate = () => {
    if (!name.trim()) {
      setError({ kind: 'nameMissing' });
      return;
    }
    // The DNS server is written on the card of every new device: it is
    // taken only when it is an address (or left empty: none)
    const server = dns.trim();
    if (server && !isValidIP(server)) {
      setError({ kind: 'dnsNotAnAddress', value: server });
      return;
    }

    createNewProject({
      name,
      description,
      settings: { ipClass, subnet, gateway, ...(server ? { dns: server } : {}) },
    });
    closeModal('newProject');
  };

  const handleCancel = () => {
    closeModal('newProject');
  };

  const errorText =
    error &&
    (error.kind === 'nameMissing'
      ? words.problems.nameMissing
      : words.problems.dnsNotAnAddress(error.value));

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={words.title}
      size="sm"
      minHeight="550px"
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <Button variant="secondary" onClick={handleCancel}>
            {t.common.actions.cancel}
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            {words.create}
          </Button>
        </div>
      }
    >
      <FormContainer>
        {/* Project Info */}
        <FormFieldset legend={words.info.legend}>
          <FormContainer gap="3">
            <Input
              label={words.info.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={words.info.namePlaceholder}
              fullWidth
              required
            />
            <Input
              label={words.info.description}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={words.info.descriptionPlaceholder}
              fullWidth
            />
          </FormContainer>
        </FormFieldset>

        {/* Global Network Settings: four short values, two to a row (the
            window is a narrow one) */}
        <FormFieldset legend={words.network.legend}>
          <FieldRow>
            <TextField
              label={words.network.network}
              span={2}
              mono
              value={ipClass}
              onChange={(e) => setIpClass(e.target.value)}
              placeholder="192.168.1.0"
            />
            <TextField
              label={words.network.mask}
              span={2}
              mono
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="255.255.255.0"
            />
            <TextField
              label="Gateway"
              span={2}
              mono
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              placeholder="192.168.1.1"
            />
            <TextField
              label={words.network.dns}
              span={2}
              mono
              value={dns}
              onChange={(e) => setDns(e.target.value)}
              placeholder={words.network.dnsPlaceholder}
            />
          </FieldRow>
        </FormFieldset>

        {/* Error Message */}
        {errorText && (
          <div className="modal-error-box">
            ⚠️ {errorText}
          </div>
        )}
      </FormContainer>
    </Modal>
  );
};

export default NewProjectModal;
