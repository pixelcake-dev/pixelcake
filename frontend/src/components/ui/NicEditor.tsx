import React from 'react';
import { CheckField, FieldRow, SelectField, TextField } from '@/components/ui/compact';
import { cellClass, hintClass, labelClass, linkClass } from '@/components/ui/compactStyles';
import DhcpPoolFields from '@/components/ui/DhcpPoolFields';
import { generateMacAddress } from '@/utils/ipHelpers';
import { nicSuggestedPool } from '@/utils/dhcpLabels';
import { nicProblems } from '@/utils/interfaceProblems';
import { useT } from '@/i18n';
import type { NetworkInterfaceCard } from '@/types/network';

/**
 * What the card would have with its address on «Automatico (DHCP)», worked
 * out from the drawing: the lease, or the reason there is none
 */
export interface CardLease {
  /** `192.168.20.100 da Router-Core, porta 2`, or `Nessun indirizzo: …` */
  text: string;
  /**
   * The address, mask and gateway given, and the DNS server when the pool
   * hands one out; absent when the card gets no lease
   */
  given?: { ip: string; subnet: string; gateway: string; dns?: string };
}

type Speed = NetworkInterfaceCard['speed'];

interface NicAddressFieldsProps {
  nic: NetworkInterfaceCard;
  onChange: (patch: Partial<NetworkInterfaceCard>) => void;
  /** What the card gets from DHCP (see CardLease); left out, DHCP is offered without a preview */
  lease?: CardLease;
}

/**
 * NicAddressFields
 * Where a card takes its address from, and the address: written by hand
 * (address, mask, gateway and the DNS server the card asks, in one row), or
 * given by a DHCP server, and then shown with where it comes from. The same
 * fields are on the first screen of the device, for its first card, and in
 * the panel of each card.
 */
export const NicAddressFields: React.FC<NicAddressFieldsProps> = ({ nic, onChange, lease }) => {
  const t = useT();
  const say = t.interfaces.card.address;
  const fields = t.interfaces.fields;
  const automatic = nic.dhcp === true;
  const problems = nicProblems(nic);

  /**
   * From DHCP to an address written by hand: the fields start from the
   * address the card had, and from the DNS server that came with it (it
   * keeps them, now as its own). From an address to DHCP nothing typed is
   * thrown away until the device is saved: the choice put back finds it.
   */
  const changeMode = (dhcp: boolean) => {
    if (dhcp) {
      onChange({ dhcp: true });
      return;
    }
    if ((nic.ip ?? '').trim() || !lease?.given) {
      onChange({ dhcp: undefined });
      return;
    }
    onChange({ dhcp: undefined, ...lease.given });
  };

  const mode = (
    <SelectField
      id="nic-address-mode"
      label={say.source}
      value={automatic ? 'dhcp' : 'manual'}
      onChange={(e) => changeMode(e.target.value === 'dhcp')}
    >
      <option value="manual">{say.manual}</option>
      <option value="dhcp">{say.automatic}</option>
    </SelectField>
  );

  if (automatic) {
    const missing = lease !== undefined && !lease.given;
    return (
      <FieldRow>
        {mode}
        <div className="col-span-3 flex flex-col gap-0.5">
          <span className={labelClass}>{say.leased}</span>
          <div
            className="text-sm pl-2 py-1 min-h-[30px]"
            style={{
              borderLeft: `3px solid var(${missing ? '--danger-color' : lease?.given ? '--ok-color' : '--border-color'})`,
            }}
            role="status"
            data-testid="nic-lease"
          >
            {lease ? (
              <>
                {lease.text}
                {lease.given && (
                  <span className="block text-xs text-[var(--text-color-light)]">
                    {say.leaseDetails(lease.given.subnet, lease.given.gateway, lease.given.dns)}
                  </span>
                )}
              </>
            ) : (
              say.fromDhcpServer
            )}
          </div>
        </div>
        <span className={`col-span-4 ${hintClass}`}>{say.automaticHint}</span>
      </FieldRow>
    );
  }

  return (
    <FieldRow>
      {mode}
      <TextField
        label={fields.ipAddress}
        mono
        placeholder={t.interfaces.example('192.168.1.10')}
        value={nic.ip ?? ''}
        onChange={(e) => onChange({ ip: e.target.value })}
      />
      <TextField
        label={fields.subnetMask}
        mono
        placeholder={t.interfaces.example('255.255.255.0')}
        value={nic.subnet ?? ''}
        onChange={(e) => onChange({ subnet: e.target.value })}
      />
      <TextField
        label={fields.gateway}
        mono
        placeholder={t.interfaces.example('192.168.1.1')}
        value={nic.gateway ?? ''}
        onChange={(e) => onChange({ gateway: e.target.value })}
      />
      <TextField
        id="nic-dns"
        label={fields.dnsServer}
        mono
        placeholder={t.interfaces.example('192.168.1.53')}
        value={nic.dns ?? ''}
        error={problems.dns}
        onChange={(e) => onChange({ dns: e.target.value })}
      />
      <span className={`col-span-3 pt-[18px] ${hintClass}`}>{say.dnsHint}</span>
    </FieldRow>
  );
};

interface NicEditorProps {
  /** The card as it is in the form of the window */
  nic: NetworkInterfaceCard;
  /** What changes on the card: it goes straight to the form, which the window saves */
  onChange: (patch: Partial<NetworkInterfaceCard>) => void;
  lease?: CardLease;
  /** The card belongs to a server: it can hand out addresses to its network */
  canServe?: boolean;
  /** What the DHCP server of the card gave out, in words, as the engine reads the form */
  poolStatus?: string;
}

/**
 * NicEditor
 * The settings of one network card, laid out in rows of four: on or off,
 * name, speed and MAC; the address (see NicAddressFields); on a server, the
 * DHCP server of the network of the card; a note. Nothing here is saved by
 * itself: each change goes to the form of the window, and what is wrong is
 * said under the field as it is typed.
 */
const NicEditor: React.FC<NicEditorProps> = ({ nic, onChange, lease, canServe = false, poolStatus }) => {
  const t = useT();
  const say = t.interfaces.card;
  const fields = t.interfaces.fields;
  const problems = nicProblems(nic);
  const automatic = nic.dhcp === true;

  return (
    <div className="nic-editor flex flex-col gap-3" data-testid={`nic-editor-${nic.id}`}>
      <FieldRow>
        <CheckField
          id="nic-enabled"
          label={say.enabled}
          inRow
          checked={nic.enabled !== false}
          onChange={(enabled) => onChange({ enabled })}
        />
        <TextField
          label={say.name}
          placeholder={say.namePlaceholder}
          value={nic.name}
          error={problems.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <SelectField
          label={fields.linkSpeed}
          value={nic.speed || 'auto'}
          onChange={(e) => onChange({ speed: e.target.value as Speed })}
        >
          <option value="auto">Auto</option>
          <option value="10M">10 Mbps</option>
          <option value="100M">100 Mbps</option>
          <option value="1G">1 Gbps</option>
          <option value="2.5G">2.5 Gbps</option>
          <option value="10G">10 Gbps</option>
        </SelectField>
        <TextField
          label={say.mac}
          mono
          placeholder={t.interfaces.example('02:A1:B2:C3:D4:E5')}
          value={nic.mac ?? ''}
          onChange={(e) => onChange({ mac: e.target.value })}
          hint={
            <button type="button" className={linkClass} onClick={() => onChange({ mac: generateMacAddress() })}>
              {say.generateMac}
            </button>
          }
        />
      </FieldRow>

      <NicAddressFields nic={nic} onChange={onChange} lease={lease} />

      {/* DHCP server: a card of a server that has an address of its own */}
      {canServe && !automatic && (
        <DhcpPoolFields
          idPrefix="nic"
          pool={nic.dhcpServer}
          onChange={(dhcpServer) => onChange({ dhcpServer })}
          suggestion={nicSuggestedPool(nic)}
          gatewayHint={say.dhcpGatewayHint}
          error={problems.pool}
          status={poolStatus}
        />
      )}

      <div className="flex flex-col gap-0.5">
        <label htmlFor="nic-description" className={labelClass}>
          {fields.notes}
        </label>
        <textarea
          id="nic-description"
          className={cellClass}
          rows={2}
          placeholder={say.notesPlaceholder}
          value={nic.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  );
};

export default NicEditor;
