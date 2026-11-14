/**
 * Export image — the drawing as a picture, to save to a file or to paste
 * into a document.
 *
 * The picture is drawn again from the data (utils/drawingImage), not taken
 * from the screen: it always shows the whole drawing, in the theme chosen
 * here, without selections or connection points. Opened while presenting,
 * it shows what the presentation shows: the simulated failures, the way of
 * the answer, and under the drawing the question with its answer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { useTemplateStore } from '@/store/templateStore';
import { usePresentationStore } from '@/store/presentationStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { assessImpact, hasFailures, planAndEvaluateFlow, withFailures } from '@/engine';
import type { Failures, Topology } from '@/engine';
import { captionOf } from '@/utils/presentation';
import { useDhcp } from '@/utils/useDhcp';
import { shownAddress } from '@/utils/dhcpLabels';
import {
  pixelSize,
  renderDrawingImage,
  scaledSvg,
  type DrawingMarks,
  type ImageTheme,
} from '@/utils/drawingImage';
import { createTextMeasure, iconShapeOf, measureDeviceSizes } from '@/utils/drawingMeasure';
import {
  PNG_SCALES,
  canChooseWhereToSave,
  canCopyImage,
  copyImage,
  fitScale,
  imageFileName,
  rasterizeSvg,
  saveImage,
  svgBlob,
  svgDataUrl,
  type ImageFormat,
  type PngScale,
} from '@/utils/imageExport';

const SCALE_NAMES: Record<PngScale, string> = {
  1: 'Normale',
  2: 'Grande',
  3: 'Molto grande',
};

const FORMAT_HINTS: Record<ImageFormat, string> = {
  png: 'Per documenti, presentazioni e messaggi.',
  svg: 'Vettoriale: si ingrandisce senza sgranare e si può ritoccare con un programma di disegno.',
};

const ExportImageModal = () => {
  const isOpen = useUIStore((state) => state.modals.exportImage);
  const closeModal = useUIStore((state) => state.closeModal);
  const handleClose = useCallback(() => closeModal('exportImage'), [closeModal]);

  // The dialog exists only while it is open: every time it starts from the
  // drawing and the theme on screen
  if (!isOpen) return null;
  return <ExportImageDialog onClose={handleClose} />;
};

const ExportImageDialog = ({ onClose }: { onClose: () => void }) => {
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const emailMode = useNetworkStore((state) => state.globalNetworkSettings.emailMode ?? 'auto');
  const deviceTemplates = useTemplateStore((state) => state.templates);
  const connectionTemplates = useTemplateStore((state) => state.connectionTemplates);
  const darkMode = useUIStore((state) => state.darkMode);
  const projectName = useProjectStore((state) => state.name);
  const canvases = useProjectStore((state) => state.canvases);
  const activeCanvasId = useProjectStore((state) => state.activeCanvasId);

  const presenting = usePresentationStore((state) => state.active);
  const sourceId = usePresentationStore((state) => state.sourceId);
  const targetId = usePresentationStore((state) => state.targetId);
  const flow = usePresentationStore((state) => state.flow);
  const failedDevices = usePresentationStore((state) => state.failedDevices);
  const failedConnections = usePresentationStore((state) => state.failedConnections);
  const route = usePresentationStore((state) => state.route);

  const [format, setFormat] = useState<ImageFormat>('png');
  const [theme, setTheme] = useState<ImageTheme>(darkMode ? 'dark' : 'light');
  const [transparent, setTransparent] = useState(false);
  const [withTitle, setWithTitle] = useState(true);
  const [withCaption, setWithCaption] = useState(true);
  const [scale, setScale] = useState<PngScale>(2);
  const [copied, setCopied] = useState(false);

  // The canvas is named only where there is more than one to tell apart
  const canvasName =
    canvases.length > 1
      ? (canvases.find((canvas) => canvas.id === activeCanvasId)?.name ?? null)
      : null;

  // Under each device the image says what the drawing says: for a device on
  // DHCP, the address it is leased
  const dhcp = useDhcp();
  const drawnDevices = useMemo(
    () =>
      devices.map((device) => {
        const address = shownAddress(device, dhcp);
        return address === device.ip ? device : { ...device, ip: address };
      }),
    [devices, dhcp]
  );

  const measureText = useMemo(() => createTextMeasure(), []);
  // The size of each device is read from the screen, again when the drawing changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sizes = useMemo(() => measureDeviceSizes(), [devices]);

  // While presenting: what is marked on the drawing, and what is said under it.
  // The same questions to the engine as the panel of the presentation.
  const marks: DrawingMarks | undefined = useMemo(
    () =>
      presenting ? { sourceId, targetId, failedDevices, failedConnections, route } : undefined,
    [presenting, sourceId, targetId, failedDevices, failedConnections, route]
  );

  const caption = useMemo(() => {
    if (!presenting) return null;
    const labels = new Map(devices.map((device) => [device.id, device.label] as const));
    const labelOf = (id: string) => labels.get(id) ?? id;
    const intact: Topology = { devices, connections };
    const failures: Failures = { devices: failedDevices, connections: failedConnections };
    const isBroken = hasFailures(failures);
    const asked = sourceId !== null && targetId !== null && sourceId !== targetId;
    const options = { emailMode };

    return captionOf({
      flow,
      question: asked ? { sourceLabel: labelOf(sourceId), targetLabel: labelOf(targetId) } : null,
      answer: asked
        ? planAndEvaluateFlow(flow, sourceId, targetId, withFailures(intact, failures), options)
        : null,
      intactAnswer:
        asked && isBroken ? planAndEvaluateFlow(flow, sourceId, targetId, intact, options) : null,
      failures: [
        ...failedDevices.map(labelOf),
        ...failedConnections.map((id) => {
          const cable = connections.find((entry) => entry.id === id);
          return cable ? `cavo ${labelOf(cable.source)} – ${labelOf(cable.target)}` : `cavo ${id}`;
        }),
      ],
      impact: isBroken ? assessImpact(intact, failures, { flow, emailMode }) : null,
      labelOf,
    });
  }, [
    presenting,
    devices,
    connections,
    sourceId,
    targetId,
    flow,
    failedDevices,
    failedConnections,
    emailMode,
  ]);

  const image = useMemo(
    () =>
      renderDrawingImage(
        {
          devices: drawnDevices,
          connections,
          deviceTemplates,
          connectionTemplates,
          sizes,
          iconOf: iconShapeOf,
          measureText,
          marks,
        },
        {
          theme,
          transparent,
          title: withTitle ? { name: projectName, detail: canvasName ?? undefined } : undefined,
          caption: withCaption && caption ? caption : undefined,
        }
      ),
    [
      drawnDevices,
      connections,
      deviceTemplates,
      connectionTemplates,
      sizes,
      measureText,
      marks,
      theme,
      transparent,
      withTitle,
      projectName,
      canvasName,
      withCaption,
      caption,
    ]
  );
  const previewUrl = useMemo(() => svgDataUrl(image.svg), [image]);

  // The PNG is made as soon as the choices are, not at the click: a browser
  // lets a page save or copy only straight from the click itself
  const pngScale = fitScale(image.width, image.height, scale);
  const pixels = pixelSize(image, pngScale);
  const [png, setPng] = useState<{ svg: string; scale: number; blob: Blob } | null>(null);
  /** The picture and the size the browser could not paint */
  const [pngFailed, setPngFailed] = useState<{ svg: string; scale: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const size = pixelSize(image, pngScale);
    rasterizeSvg(scaledSvg(image, pngScale), size.width, size.height).then(
      (blob) => {
        if (cancelled) return;
        setPng({ svg: image.svg, scale: pngScale, blob });
        setPngFailed(null);
      },
      (error: unknown) => {
        if (cancelled) return;
        console.error('[Image] PNG failed:', error);
        setPngFailed({ svg: image.svg, scale: pngScale });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [image, pngScale]);
  const pngBlob = png && png.svg === image.svg && png.scale === pngScale ? png.blob : null;
  // Both are about the picture and the size on show now: another choice is
  // another PNG, still to be painted
  const failed = pngFailed !== null && pngFailed.svg === image.svg && pngFailed.scale === pngScale;
  /** A large PNG takes a moment: the button says so instead of just not answering */
  const preparing = format === 'png' && !pngBlob && !failed;

  // "Copiata" goes back to "Copia" after a moment
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleSave = async () => {
    const content = format === 'svg' ? svgBlob(image.svg) : pngBlob;
    if (!content) return;
    const outcome = await saveImage(content, imageFileName(projectName, canvasName, format), format);
    if (outcome === 'saved' || outcome === 'downloaded') onClose();
  };

  const handleCopy = async () => {
    if (!pngBlob) return;
    if (await copyImage(pngBlob)) setCopied(true);
  };

  const formatName = format.toUpperCase();

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title=""
      size="lg"
      variant="tabbed"
      autoHeight={true}
      minHeight={undefined}
      maxHeight="calc(90vh - 120px)"
      verticalAlign="start"
      fixedContent={
        <div className="modal-header flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <h3 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-color)' }}>
            Esporta immagine
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="p-1 text-[var(--text-color-light)] hover:text-[var(--text-color)] hover:bg-[var(--bg-hover)] rounded transition-colors"
            style={{ color: 'var(--text-color-light)' }}
          >
            <X size={20} />
          </button>
        </div>
      }
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          {canCopyImage() && (
            <Button
              variant="secondary"
              onClick={() => void handleCopy()}
              disabled={!pngBlob}
              title="Copia l'immagine (PNG) per incollarla in un documento o in un messaggio"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiata' : 'Copia negli appunti'}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={format === 'png' && !pngBlob}
          >
            <Download size={14} />
            {preparing
              ? 'Preparo il PNG…'
              : canChooseWhereToSave()
                ? `Salva ${formatName}…`
                : `Scarica ${formatName}`}
          </Button>
        </div>
      }
    >
      <div className="export-image">
        <div className={transparent ? 'export-image-preview transparent' : 'export-image-preview'}>
          <img src={previewUrl} alt="Anteprima dell'immagine" />
        </div>

        <div className="export-image-options">
          <fieldset>
            <legend>Formato</legend>
            <div className="segmented compact">
              {(['png', 'svg'] as const).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={format === entry ? 'active' : ''}
                  aria-pressed={format === entry}
                  onClick={() => setFormat(entry)}
                >
                  {entry.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="export-image-hint">{FORMAT_HINTS[format]}</p>
          </fieldset>

          {format === 'png' && (
            <fieldset>
              <legend>Dimensione</legend>
              <div className="segmented compact">
                {PNG_SCALES.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    className={scale === entry ? 'active' : ''}
                    aria-pressed={scale === entry}
                    onClick={() => setScale(entry)}
                  >
                    {SCALE_NAMES[entry]}
                  </button>
                ))}
              </div>
              <p className="export-image-hint" data-testid="export-image-pixels">
                {pixels.width} × {pixels.height} pixel
                {pngScale < scale && ' (ridotta: è il massimo che il browser riesce a creare)'}
              </p>
            </fieldset>
          )}

          <fieldset>
            <legend>Tema</legend>
            <div className="segmented compact">
              <button
                type="button"
                className={theme === 'light' ? 'active' : ''}
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
              >
                Chiaro
              </button>
              <button
                type="button"
                className={theme === 'dark' ? 'active' : ''}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
              >
                Scuro
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Contenuto</legend>
            <label className="export-image-check">
              <input
                type="checkbox"
                checked={withTitle}
                onChange={(event) => setWithTitle(event.target.checked)}
              />
              Nome del progetto in alto
            </label>
            {caption && (
              <label className="export-image-check">
                <input
                  type="checkbox"
                  checked={withCaption}
                  onChange={(event) => setWithCaption(event.target.checked)}
                />
                {caption.tone
                  ? 'Domanda e risposta sotto il disegno'
                  : 'Guasti simulati sotto il disegno'}
              </label>
            )}
            <label className="export-image-check">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(event) => setTransparent(event.target.checked)}
              />
              Sfondo trasparente
            </label>
          </fieldset>

          {/* Only when the presentation has put something on the drawing */}
          {presenting && caption && (
            <p className="export-image-hint">
              L&apos;immagine mostra il disegno com&apos;è ora nella presentazione, con i segni
              della domanda e dei guasti simulati.
            </p>
          )}

          {failed && format === 'png' && (
            <div className="modal-error-box" role="alert">
              Il browser non è riuscito a creare l&apos;immagine PNG. Prova una dimensione più
              piccola, oppure il formato SVG.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ExportImageModal;
