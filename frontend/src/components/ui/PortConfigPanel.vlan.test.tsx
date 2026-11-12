/**
 * PortConfigPanel tests — what a switch port saves for its VLAN (the engine
 * reads exactly these fields, see engine/vlan.ts) and the security zone of a
 * firewall port, which may be none.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Port } from '@/types';
import { portVlanMode } from '@/engine';
import PortConfigPanel from './PortConfigPanel';

function renderPanel(port: Port, deviceType: string) {
  const onSave = vi.fn<(portId: number, updates: Partial<Port>) => void>();
  render(<PortConfigPanel port={port} deviceType={deviceType} onSave={onSave} onCancel={() => {}} />);
  /** The port as it would be after the save, or undefined when nothing was saved */
  const saved = (): Port | undefined => {
    const call = onSave.mock.calls.at(-1);
    return call ? { ...port, ...call[1] } : undefined;
  };
  return { onSave, saved };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

const ACCESS = 'VLAN (singola)';
const TRUNK = 'VLANs (separati da virgola)';
const MODE = 'Modalità Porta';

describe('PortConfigPanel — VLAN of a switch port', () => {
  it('an access port saves one VLAN, which the engine reads as its access VLAN', () => {
    const { saved } = renderPanel({ id: 3, enabled: true, portType: 'access' }, 'Switch');
    type(ACCESS, '10');
    save();
    expect(saved()).toMatchObject({ portType: 'access', vlan: 10 });
    expect(portVlanMode(saved())).toEqual({ kind: 'access', vlan: 10, explicit: true });
  });

  it('a trunk saves its list', () => {
    const { saved } = renderPanel({ id: 8, enabled: true, portType: 'trunk' }, 'Switch');
    type(TRUNK, '10, 20,30');
    save();
    expect(saved()).toMatchObject({ portType: 'trunk', vlan: [10, 20, 30] });
    expect(portVlanMode(saved())).toEqual({ kind: 'trunk', vlans: [10, 20, 30] });
  });

  it('a trunk left without a list carries every VLAN', () => {
    const { saved } = renderPanel({ id: 8, enabled: true, portType: 'access' }, 'Switch');
    type(MODE, 'trunk');
    save();
    expect(saved()?.vlan).toBeUndefined();
    expect(portVlanMode(saved())).toEqual({ kind: 'trunk', vlans: [] });
  });

  it('emptying the field takes the VLAN off the port', () => {
    const { saved } = renderPanel({ id: 3, enabled: true, portType: 'access', vlan: 10 }, 'Switch');
    expect(screen.getByLabelText(ACCESS)).toHaveValue('10');
    type(ACCESS, '');
    save();
    expect(saved()?.vlan).toBeUndefined();
    expect(portVlanMode(saved())).toEqual({ kind: 'access', vlan: 1, explicit: false });
  });

  it('keeps what was typed when the port changes between access and trunk', () => {
    const { saved } = renderPanel({ id: 3, enabled: true, portType: 'access', vlan: 10 }, 'Switch');
    type(MODE, 'trunk');
    expect(screen.getByLabelText(TRUNK)).toHaveValue('10');
    type(TRUNK, '10, 20');
    type(MODE, 'access');
    expect(screen.getByLabelText(ACCESS)).toHaveValue('10');
    save();
    expect(saved()).toMatchObject({ portType: 'access', vlan: 10 });
  });

  it('refuses a number that is not a VLAN, and says so', () => {
    const { onSave } = renderPanel({ id: 3, enabled: true, portType: 'access' }, 'Switch');
    type(ACCESS, '5000');
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('5000 non è una VLAN: il numero va da 1 a 4094');

    type(ACCESS, '4094');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    save();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('explains what the field means in each mode, and the VLAN 1 rule', () => {
    renderPanel({ id: 3, enabled: true, portType: 'access' }, 'Switch');
    expect(screen.getByText(/La porta appartiene a questa VLAN/)).toBeInTheDocument();
    expect(
      screen.getByText('Appena una porta dello switch ha una VLAN, quelle senza sono nella VLAN 1.')
    ).toBeInTheDocument();
    type(MODE, 'trunk');
    expect(screen.getByText(/Le VLAN che la porta trasporta con etichetta/)).toBeInTheDocument();
  });

  it('does not offer a VLAN on router and firewall ports', () => {
    renderPanel({ id: 1, enabled: true, portType: 'lan' }, 'Router');
    expect(screen.queryByLabelText(ACCESS)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(TRUNK)).not.toBeInTheDocument();
  });
});

describe('PortConfigPanel — security zone of a firewall port', () => {
  const ZONE = 'Zona di Sicurezza';

  it('a port without a zone stays without one when it is saved', () => {
    // saving a name must not put the port in "trust" behind the user's back
    const { saved } = renderPanel({ id: 3, enabled: true, portType: 'lan' }, 'Firewall');
    expect(screen.getByLabelText(ZONE)).toHaveValue('');
    type('Nome Porta (opzionale)', 'Riserva');
    save();
    expect(saved()?.name).toBe('Riserva');
    expect(saved()?.securityZone).toBeUndefined();
  });

  it('saves the zone that is chosen', () => {
    const { saved } = renderPanel({ id: 2, enabled: true, portType: 'wan' }, 'Firewall');
    type(ZONE, 'untrust');
    save();
    expect(saved()?.securityZone).toBe('untrust');
  });

  it('shows the zone the port is in, and "Nessuna" removes it', () => {
    const { saved } = renderPanel(
      { id: 2, enabled: true, portType: 'wan', securityZone: 'dmz' },
      'Firewall'
    );
    expect(screen.getByLabelText(ZONE)).toHaveValue('dmz');
    type(ZONE, '');
    save();
    expect(saved()?.securityZone).toBeUndefined();
  });
});

describe('PortConfigPanel — settings the engine does not simulate', () => {
  it('says so next to NAT and IPS', () => {
    const router = render(
      <PortConfigPanel port={{ id: 1, enabled: true }} deviceType="Router" onSave={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByText(/il motore non traduce gli indirizzi/)).toBeInTheDocument();
    router.unmount();

    render(
      <PortConfigPanel port={{ id: 1, enabled: true }} deviceType="Firewall" onSave={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByText('Resta come documentazione: il motore non lo simula.')).toBeInTheDocument();
    expect(screen.getByText(/Per il firewall conta la zona di sicurezza/)).toBeInTheDocument();
  });
});
