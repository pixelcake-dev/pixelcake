/**
 * The form of a custom template offers every base type the app has, and a
 * template made with it is made as the built-in one of that type.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTemplateStore } from '@/store/templateStore';
import { DRAWING_OF_TYPE } from '@/utils/deviceDrawing';
import { BASE_TYPES, templateFieldsOfType } from '@/utils/templateBaseTypes';
import CustomTemplatesTab from '@/components/Modals/CustomTemplatesTab';
import TemplateEditModal from '@/components/Modals/TemplateEditModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const templates = () => useTemplateStore.getState().templates;
const builtIn = (type: string) => templates().find((t) => !t.isCustom && t.type === type && t.id === `tpl-${type.toLowerCase()}`)!;

beforeEach(() => {
  useTemplateStore.getState().loadDefaultTemplates();
});

const NINE = ['PC', 'Switch', 'Router', 'Server', 'Firewall', 'AccessPoint', 'LoadBalancer', 'Database', 'Cloud'];

describe('the base types of a custom template', () => {
  it('are the nine of the app, each with a drawing', () => {
    expect([...BASE_TYPES.map((entry) => entry.type)].sort()).toEqual([...NINE].sort());
    for (const type of NINE) expect(DRAWING_OF_TYPE[type]).toBeTruthy();
  });

  it('give the capabilities the built-in template of the type has', () => {
    for (const type of NINE) {
      const fields = templateFieldsOfType(type);
      const real = builtIn(type);
      expect(real, type).toBeTruthy();
      expect(
        {
          supportsVLAN: fields.supportsVLAN,
          supportsSTP: fields.supportsSTP,
          supportsPorts: fields.supportsPorts,
          supportsNICs: fields.supportsNICs,
          portOptions: fields.portOptions,
          defaultPortCount: fields.defaultPortCount,
        },
        type
      ).toEqual({
        supportsVLAN: real.supportsVLAN,
        supportsSTP: real.supportsSTP,
        supportsPorts: real.supportsPorts,
        supportsNICs: real.supportsNICs,
        portOptions: real.portOptions,
        defaultPortCount: real.defaultPortCount,
      });
    }
  });

  it('are all offered by the form of the custom devices', () => {
    render(<CustomTemplatesTab templates={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Nuovo template/ }));
    const offered = Array.from(screen.getByRole('combobox').querySelectorAll('option')).map((option) => option.getAttribute('value'));
    expect([...offered].sort()).toEqual([...NINE].sort());
  });

  it.each(NINE)('a custom %s is made like the built-in one', (type) => {
    render(<CustomTemplatesTab templates={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Nuovo template/ }));
    fireEvent.change(screen.getByPlaceholderText(/AWS EC2/), { target: { value: `Mio ${type}` } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: type } });
    fireEvent.submit(document.querySelector('form.template-form')!);

    const made = templates()[templates().length - 1];
    const real = builtIn(type);
    expect(made).toMatchObject({
      name: `Mio ${type}`,
      type,
      icon: DRAWING_OF_TYPE[type],
      isCustom: true,
      supportsVLAN: real.supportsVLAN,
      supportsSTP: real.supportsSTP,
      supportsPorts: real.supportsPorts,
      supportsNICs: real.supportsNICs,
      ...(real.portOptions && { portOptions: real.portOptions, defaultPortCount: real.defaultPortCount }),
    });
    // (the types with network cards have no port count to offer)
    expect(Boolean(made.portOptions)).toBe(Boolean(real.portOptions));
  });

  it('are the same in the form of the generic templates', () => {
    render(<TemplateEditModal isOpen onClose={() => {}} template={null} />);
    const offered = Array.from(screen.getByRole('combobox').querySelectorAll('option'))
      .map((option) => option.getAttribute('value'))
      .filter(Boolean);
    expect([...offered].sort()).toEqual([...NINE].sort());
  });
});
