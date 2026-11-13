/**
 * Presentation mode — the panel next to the canvas. From the top: the
 * question (from, to, what), the answer in two lines, the simulated failures
 * with what they do to the rest of the network, and last the way of the
 * packet hop by hop. Closed, it leaves the whole window to the drawing and
 * keeps working.
 */

import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Square,
  Wrench,
  X,
  ZapOff,
} from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore, type PresentationFlow } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import {
  FLOW_HINTS,
  FLOW_NAMES,
  answerLegs,
  compareWithIntact,
  exchanges,
  groupBySource,
  summarizeAnswer,
  type AnswerLeg,
  type ImpactGroup,
} from '@/utils/presentation';
import { usePresentationAnswer } from './usePresentationAnswer';
import { useDhcp } from '@/utils/useDhcp';
import { shownAddress } from '@/utils/dhcpLabels';

const FLOWS: PresentationFlow[] = ['ping', 'web', 'email'];

const TONE_ICONS = {
  ok: CircleCheck,
  ko: CircleX,
  unknown: CircleAlert,
};

/** On a large drawing a failure touches hundreds of exchanges: this much is shown at first */
const MAX_GROUPS = 6;
const MAX_TARGETS = 5;

/** The exchanges a failure touched: each device with the destinations concerned */
const ImpactGroups = ({
  groups,
  onAsk,
}: {
  groups: ImpactGroup[];
  onAsk: (sourceId: string, targetId: string) => void;
}) => {
  const [showAll, setShowAll] = useState(false);
  const isLong =
    groups.length > MAX_GROUPS || groups.some((group) => group.targets.length > MAX_TARGETS);
  const shownGroups = showAll ? groups : groups.slice(0, MAX_GROUPS);

  return (
    <>
      <ul className="presentation-impact-groups">
        {shownGroups.map((group) => {
          const targets = showAll ? group.targets : group.targets.slice(0, MAX_TARGETS);
          const hidden = group.targets.length - targets.length;
          return (
            <li key={group.sourceId}>
              <span className="presentation-impact-source">{group.label}</span>
              <span aria-hidden="true"> → </span>
              {targets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className="presentation-chip"
                  aria-label={`Mostra da ${group.label} a ${target.label}`}
                  title={target.reason ?? `Mostra da ${group.label} a ${target.label}`}
                  onClick={() => onAsk(group.sourceId, target.id)}
                >
                  {target.label}
                </button>
              ))}
              {hidden > 0 && <span className="presentation-impact-more">e altri {hidden}</span>}
            </li>
          );
        })}
        {!showAll && groups.length > MAX_GROUPS && (
          <li className="presentation-impact-more">
            e altri {groups.length - MAX_GROUPS} dispositivi
          </li>
        )}
      </ul>
      {isLong && (
        <button
          type="button"
          className="presentation-link"
          aria-expanded={showAll}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Mostra meno' : 'Mostra tutto'}
        </button>
      )}
    </>
  );
};

/** The devices of one leg, in order; `reached` is how far the packet has got */
const LegSteps = ({ leg, reached }: { leg: AnswerLeg; reached: number | null }) => (
  <ol>
    {leg.steps.map((step, stepIndex) => {
      const pending = reached !== null && step.animationIndex > reached;
      const current = reached !== null && step.animationIndex === reached;
      return (
        <li
          key={`${step.deviceId}-${stepIndex}`}
          className={[`status-${step.status}`, pending ? 'pending' : '', current ? 'current' : '']
            .filter(Boolean)
            .join(' ')}
        >
          <span className="presentation-step-label">{step.label}</span>
          {step.note && <span className="presentation-step-note">{step.note}</span>}
        </li>
      );
    })}
  </ol>
);

const PresentationPanel = () => {
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);

  const panelOpen = usePresentationStore((state) => state.panelOpen);
  const setPanelOpen = usePresentationStore((state) => state.setPanelOpen);
  const sourceId = usePresentationStore((state) => state.sourceId);
  const targetId = usePresentationStore((state) => state.targetId);
  const flow = usePresentationStore((state) => state.flow);
  const failedDevices = usePresentationStore((state) => state.failedDevices);
  const failedConnections = usePresentationStore((state) => state.failedConnections);
  const setSource = usePresentationStore((state) => state.setSource);
  const setTarget = usePresentationStore((state) => state.setTarget);
  const swapEnds = usePresentationStore((state) => state.swapEnds);
  const setFlow = usePresentationStore((state) => state.setFlow);
  const ask = usePresentationStore((state) => state.ask);
  const replay = usePresentationStore((state) => state.replay);
  const toggleDeviceFailure = usePresentationStore((state) => state.toggleDeviceFailure);
  const toggleConnectionFailure = usePresentationStore((state) => state.toggleConnectionFailure);
  const repairAll = usePresentationStore((state) => state.repairAll);

  const isRunning = useSimulationStore((state) => state.isRunning);
  const stopSimulation = useSimulationStore((state) => state.stopSimulation);

  // The answer is worked out here whether the panel is open or not
  const { answer, intactAnswer, impact, reached } = usePresentationAnswer();

  const labelOf = useMemo(() => {
    const labels = new Map(devices.map((device) => [device.id, device.label] as const));
    return (id: string) => labels.get(id) ?? id;
  }, [devices]);

  const dhcp = useDhcp();
  const deviceOptions = useMemo(
    () =>
      [...devices]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((device) => {
          // (a device on DHCP shows the address it is leased)
          const address = shownAddress(device, dhcp);
          return { value: device.id, label: address ? `${device.label} (${address})` : device.label };
        }),
    [devices, dhcp]
  );

  const cableName = (connectionId: string) => {
    const connection = connections.find((entry) => entry.id === connectionId);
    return connection ? `${labelOf(connection.source)} – ${labelOf(connection.target)}` : connectionId;
  };

  if (!panelOpen) {
    return (
      <aside className="presentation-panel collapsed" aria-label="Pannello della presentazione">
        <button
          type="button"
          className="presentation-icon-button"
          title="Apri il pannello"
          aria-label="Apri il pannello"
          onClick={() => setPanelOpen(true)}
        >
          <PanelLeftOpen size={20} />
        </button>
      </aside>
    );
  }

  const summary =
    answer && sourceId && targetId
      ? summarizeAnswer(answer, flow, labelOf(sourceId), labelOf(targetId))
      : null;
  const legs = answer ? answerLegs(answer) : [];
  const comparison = answer && intactAnswer ? compareWithIntact(answer, intactAnswer, labelOf) : null;
  const ToneIcon = summary ? TONE_ICONS[summary.tone] : null;
  const failureCount = failedDevices.length + failedConnections.length;

  const brokenGroups = impact ? groupBySource(impact.broken, impact.endpoints, labelOf) : [];
  const reroutedGroups = impact ? groupBySource(impact.rerouted, impact.endpoints, labelOf) : [];

  return (
    <aside className="presentation-panel" aria-label="Pannello della presentazione">
      <div className="presentation-panel-scroll overflow-y-auto">
        {/* ── Question ───────────────────────────────────────────────── */}
        <section className="presentation-section" aria-labelledby="presentation-question">
          <div className="presentation-section-head">
            <h4 id="presentation-question">Domanda</h4>
            <button
              type="button"
              className="presentation-icon-button"
              title="Chiudi il pannello"
              aria-label="Chiudi il pannello"
              onClick={() => setPanelOpen(false)}
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          <div className="presentation-ends">
            <div className="presentation-ends-fields">
              <div className="presentation-end">
                <span id="presentation-from">Da</span>
                <SearchableSelect
                  labelledBy="presentation-from"
                  value={sourceId ?? ''}
                  onChange={(value) => setSource(value)}
                  options={deviceOptions}
                  placeholder="Da dove parte…"
                />
              </div>
              <div className="presentation-end">
                <span id="presentation-to">A</span>
                <SearchableSelect
                  labelledBy="presentation-to"
                  value={targetId ?? ''}
                  onChange={(value) => setTarget(value)}
                  options={deviceOptions}
                  placeholder="Dove arriva…"
                />
              </div>
            </div>
            <button
              type="button"
              className="presentation-icon-button"
              title="Inverti partenza e arrivo"
              aria-label="Inverti partenza e arrivo"
              disabled={!sourceId && !targetId}
              onClick={swapEnds}
            >
              <ArrowLeftRight size={18} />
            </button>
          </div>

          <div className="presentation-segmented" role="group" aria-label="Tipo di scambio">
            {FLOWS.map((entry) => (
              <button
                key={entry}
                type="button"
                className={flow === entry ? 'active' : ''}
                aria-pressed={flow === entry}
                title={FLOW_HINTS[entry]}
                onClick={() => setFlow(entry)}
              >
                {FLOW_NAMES[entry]}
              </button>
            ))}
          </div>

          {isRunning ? (
            <button type="button" className="presentation-primary" onClick={stopSimulation}>
              <Square size={16} /> Ferma
            </button>
          ) : (
            <button
              type="button"
              className="presentation-primary"
              disabled={!answer || answer.animationPath.length < 2}
              onClick={replay}
            >
              <Play size={16} /> Mostra di nuovo
            </button>
          )}
        </section>

        {/* ── Answer ─────────────────────────────────────────────────── */}
        <section className="presentation-section" aria-labelledby="presentation-answer">
          <h4 id="presentation-answer">Risposta</h4>

          {!summary || !ToneIcon ? (
            <p className="presentation-hint">
              {sourceId && !targetId
                ? 'Ora scegli dove arriva.'
                : !sourceId && targetId
                  ? 'Ora scegli da dove parte.'
                  : 'Scegli da dove parte e dove arriva: con i due menu qui sopra, oppure con un clic su un dispositivo del disegno.'}
            </p>
          ) : (
            <>
              <div className={`presentation-verdict tone-${summary.tone}`} role="status">
                <ToneIcon size={26} aria-hidden="true" />
                <div>
                  <strong>{summary.headline}</strong>
                  <span>{summary.detail}</span>
                </div>
              </div>
              {summary.reason && (
                <p className="presentation-reason" title="Il motivo, come lo dà il motore">
                  {summary.reason}
                </p>
              )}
              {comparison && <p className="presentation-whatif">{comparison}</p>}
            </>
          )}
        </section>

        {/* ── Failures ───────────────────────────────────────────────── */}
        <section className="presentation-section" aria-labelledby="presentation-failures">
          <h4 id="presentation-failures">Guasti simulati</h4>

          {failureCount === 0 ? (
            <p className="presentation-hint">
              Cosa succede se si rompe? Clic su un dispositivo o su un cavo del disegno, poi «Simula
              un guasto». Il disegno non viene modificato.
            </p>
          ) : (
            <>
              <ul className="presentation-failures">
                {failedDevices.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      className="presentation-chip failure"
                      title="Ripara"
                      aria-label={`Ripara ${labelOf(id)}`}
                      onClick={() => toggleDeviceFailure(id)}
                    >
                      <ZapOff size={14} aria-hidden="true" /> {labelOf(id)} <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {failedConnections.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      className="presentation-chip failure"
                      title="Ripara"
                      aria-label={`Ripara il cavo ${cableName(id)}`}
                      onClick={() => toggleConnectionFailure(id)}
                    >
                      <ZapOff size={14} aria-hidden="true" /> cavo {cableName(id)}{' '}
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" className="presentation-secondary" onClick={repairAll}>
                    <Wrench size={14} aria-hidden="true" /> Ripara tutto
                  </button>
                </li>
              </ul>

              {impact && (
                <div className="presentation-impact">
                  <h5>Sul resto della rete</h5>
                  {impact.endpoints.length < 2 ? (
                    <p className="presentation-hint">
                      Per misurare l&apos;effetto servono almeno due dispositivi finali (PC, server…)
                      con un indirizzo.
                    </p>
                  ) : impact.working === 0 ? (
                    <p className="presentation-hint">
                      Con {FLOW_NAMES[flow]} nessuna comunicazione tra i dispositivi finali funzionava
                      già prima dei guasti.
                    </p>
                  ) : (
                    <>
                      <p className="presentation-impact-scope">
                        {FLOW_NAMES[flow]} tra i {impact.endpoints.length} dispositivi finali:{' '}
                        {exchanges(impact.working)} che senza guasti{' '}
                        {impact.working === 1 ? 'funziona' : 'funzionano'}.
                      </p>

                      <p className={`presentation-impact-line ${impact.broken.length > 0 ? 'ko' : 'ok'}`}>
                        {impact.broken.length === 0
                          ? 'Nessuna si interrompe'
                          : `${impact.broken.length} ${impact.broken.length === 1 ? 'si interrompe' : 'si interrompono'}`}
                      </p>
                      <ImpactGroups groups={brokenGroups} onAsk={ask} />

                      {impact.rerouted.length > 0 && (
                        <>
                          <p className="presentation-impact-line detour">
                            {impact.rerouted.length}{' '}
                            {impact.rerouted.length === 1 ? 'passa' : 'passano'} da un&apos;altra strada
                          </p>
                          <ImpactGroups groups={reroutedGroups} onAsk={ask} />
                          <p className="presentation-small">
                            Il motore prende la strada più corta che funziona; protocolli come lo
                            spanning tree non sono simulati.
                          </p>
                        </>
                      )}

                      {impact.unchanged > 0 && (
                        <p className="presentation-impact-line same">
                          {impact.unchanged} {impact.unchanged === 1 ? 'non cambia' : 'non cambiano'}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── The way, hop by hop ────────────────────────────────────── */}
        {answer && legs.length > 0 && (
          <section className="presentation-section" aria-labelledby="presentation-way">
            <h4 id="presentation-way">Percorso</h4>

            {legs.map((leg, legIndex) =>
              leg.retracesPrevious ? (
                // A reply that comes back the way the request went is one line,
                // opened on demand
                <details key={`${leg.title}-${legIndex}`} className="presentation-leg">
                  <summary>
                    <h5>{leg.title}</h5> <span>per la stessa strada</span>
                  </summary>
                  <LegSteps leg={leg} reached={reached} />
                </details>
              ) : (
                <div key={`${leg.title}-${legIndex}`} className="presentation-leg">
                  <h5>{leg.title}</h5>
                  <LegSteps leg={leg} reached={reached} />
                </div>
              )
            )}

            {answer.notes.length > 0 && (
              <div className="presentation-notes">
                <h5>Note del motore</h5>
                <ul>
                  {answer.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
};

export default PresentationPanel;
