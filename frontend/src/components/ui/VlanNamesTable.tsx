import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cellClass, errorClass, hintClass } from '@/components/ui/compactStyles';
import { VLAN_NAME_MAX_LENGTH, vlanRowProblem, type VlanRow } from '@/utils/vlanNames';

interface VlanNamesTableProps {
  /** The rows as they are typed (see vlanRows in utils/vlanNames) */
  rows: VlanRow[];
  onChange: (rows: VlanRow[]) => void;
  /** Say what is wrong with a row under it (once the user has tried to save) */
  showProblems: boolean;
}

/**
 * VlanNamesTable
 * The VLANs of the project, one to a row: its number, the name it goes by,
 * whether the drawing on screen uses it, and a button that takes it off the
 * list. The VLANs the drawing uses without a name are listed too, with the
 * name left to type; a row for any other VLAN is added by hand. Nothing here
 * is saved by itself: the rows go to the form of the settings.
 */
const VlanNamesTable: React.FC<VlanNamesTableProps> = ({ rows, onChange, showProblems }) => {
  // (a row added by hand has no number to be told by)
  const added = useRef(0);

  const change = (key: string, patch: Partial<VlanRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const add = () => {
    added.current += 1;
    onChange([...rows, { key: `new-${added.current}`, id: '', name: '', fixed: false, inUse: false }]);
  };

  /** Off the list; a VLAN the drawing uses stays in it, without its name */
  const remove = (row: VlanRow) =>
    row.inUse ? change(row.key, { name: '' }) : onChange(rows.filter((other) => other.key !== row.key));

  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 ? (
        <table className="w-full border-collapse text-sm" aria-label="VLAN del progetto">
          <thead>
            <tr className="text-left text-xs text-[var(--text-color-light)]">
              <th scope="col" className="font-medium pb-1 pr-3 w-[84px]">
                VLAN
              </th>
              <th scope="col" className="font-medium pb-1 pr-3">
                Nome
              </th>
              <th scope="col" className="font-medium pb-1 pr-3 w-[150px]">
                Su questo canvas
              </th>
              <th scope="col" className="pb-1 w-[28px]">
                <span className="sr-only">Togli</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const problem = showProblems ? vlanRowProblem(row, rows) : undefined;
              const number = row.id.trim();
              // (an unnamed VLAN of the drawing has nothing to take away)
              const removable = !row.inUse || row.name.trim() !== '';
              return (
                <React.Fragment key={row.key}>
                  <tr data-testid={`vlan-row-${row.fixed ? number : 'new'}`}>
                    <td className="pr-3 py-0.5 align-middle">
                      {row.fixed ? (
                        <span className="font-mono">{number}</span>
                      ) : (
                        <input
                          type="text"
                          inputMode="numeric"
                          className={`${cellClass} font-mono`}
                          aria-label="Numero della nuova VLAN"
                          placeholder="es. 30"
                          value={row.id}
                          autoFocus
                          onChange={(e) => change(row.key, { id: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="pr-3 py-0.5">
                      <input
                        type="text"
                        className={cellClass}
                        aria-label={row.fixed ? `Nome della VLAN ${number}` : 'Nome della nuova VLAN'}
                        aria-invalid={problem ? true : undefined}
                        placeholder={row.fixed && row.inUse ? 'senza nome' : 'es. Uffici'}
                        maxLength={VLAN_NAME_MAX_LENGTH}
                        value={row.name}
                        onChange={(e) => change(row.key, { name: e.target.value })}
                      />
                    </td>
                    <td className="pr-3 py-0.5 text-xs text-[var(--text-color-light)]">
                      {row.inUse ? 'in uso' : row.fixed ? 'non usata' : ''}
                    </td>
                    <td className="py-0.5">
                      {removable && (
                        <button
                          type="button"
                          className="p-1 rounded text-[var(--text-color-light)] hover:text-[var(--text-color)] hover:bg-[var(--bg-hover)]"
                          aria-label={
                            row.fixed ? `Togli il nome della VLAN ${number}` : 'Togli la nuova VLAN'
                          }
                          onClick={() => remove(row)}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {problem && (
                    <tr>
                      <td />
                      <td colSpan={3} className={`pb-1 ${errorClass}`} role="alert">
                        {problem}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className={hintClass}>Nessuna VLAN ha un nome, e questo canvas non ne usa.</p>
      )}
      <div>
        <Button variant="secondary" size="sm" onClick={add}>
          Aggiungi VLAN
        </Button>
      </div>
    </div>
  );
};

export default VlanNamesTable;
