/**
 * A template for a kind of device the app covers already (a variant: its own
 * name and drawing, the same base type), and the button that puts back the
 * built-in templates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useTemplateStore } from '@/store/templateStore';
import { answerConfirms, settled } from '@/test/confirm';
import { dictionaryOf, getT } from '@/i18n';
import DeviceTemplatesTab from './DeviceTemplatesTab';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const store = () => useTemplateStore.getState();
const words = () => getT().templates.devices;

beforeEach(() => {
  localStorage.clear();
  store().loadDefaultTemplates();
  vi.clearAllMocks();
});

describe('New template, for a type that is covered already', () => {
  it('is made: a custom template of that base type, with its own name and drawing', async () => {
    render(<DeviceTemplatesTab />);
    fireEvent.click(screen.getByRole('button', { name: words().generic.add }));
    fireEvent.change(screen.getByLabelText(words().editor.name), { target: { value: 'Postazione CAD' } });
    fireEvent.change(screen.getByLabelText(words().baseType), { target: { value: 'PC' } });
    fireEvent.click(screen.getByRole('button', { name: words().editor.create }));

    const made = store().templates.find((template) => template.name === 'Postazione CAD');
    expect(made).toMatchObject({ type: 'PC', isCustom: true, supportsNICs: true });
    // the nine built-in ones are all still there
    expect(store().templates.filter((template) => !template.isCustom)).toHaveLength(24);
    // it is in the tab of the custom ones, which is the one on screen now
    await screen.findByText('Postazione CAD');
    expect(screen.queryByText(words().editor.errors.nameRequired)).toBeNull();
  });
});

describe('Restore built-in templates', () => {
  it('puts back the ones that were deleted, and says how many', async () => {
    answerConfirms(true);
    render(<DeviceTemplatesTab />);
    store().deleteTemplate('tpl-pc');
    store().deleteTemplate('tpl-cloud');
    await settled();
    fireEvent.click(screen.getByRole('button', { name: words().generic.restore }));
    await waitFor(() => expect(store().templates.filter((template) => !template.isCustom)).toHaveLength(24));
    expect(toast.success).toHaveBeenCalledWith(words().generic.restored(2));
  });

  it('with none missing, says so', () => {
    render(<DeviceTemplatesTab />);
    fireEvent.click(screen.getByRole('button', { name: words().generic.restore }));
    expect(toast.info).toHaveBeenCalledWith(words().generic.nothingToRestore);
    expect(store().templates).toHaveLength(24);
  });

  it('leaves the custom ones of the user alone', () => {
    store().addTemplate({
      name: 'Mio',
      type: 'Server',
      icon: 'server',
      color: '#5E8096',
      isCustom: true,
      supportsVLAN: false,
      supportsSTP: false,
      supportsPorts: false,
      supportsNICs: true,
    });
    store().deleteTemplate('tpl-pc');
    render(<DeviceTemplatesTab />);
    fireEvent.click(screen.getByRole('button', { name: words().generic.restore }));
    expect(store().templates.filter((template) => template.isCustom).map((template) => template.name)).toEqual(['Mio']);
  });
});

describe('what the custom tab promises', () => {
  it.each(['it', 'en'] as const)('names no Terraform fields, in %s', (language) => {
    expect(JSON.stringify(dictionaryOf(language).templates.devices.custom)).not.toMatch(/terraform/i);
  });
});
