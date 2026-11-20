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
import { useSimulationStore } from '@/store/simulationStore';
import { useMarkerStore } from '@/store/markerStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { hasFailures, planAndEvaluateFlow, withFailures } from '@/engine';
import type { Failures, Topology } from '@/engine';
import { captionOf } from '@/utils/presentation';
import { useImpact } from '@/utils/useImpact';
import { useDhcp } from '@/utils/useDhcp';
import { noLeaseLabel, shownAddress } from '@/utils/dhcpLabels';
import { useAddressConflicts } from '@/utils/useAddressConflicts';
import { conflictedAddress } from '@/utils/addressConflicts';
import {
  pixelSize,
  renderDrawingImage,
  scaledSvg,
  type DrawingMarks,
  type ImageTheme,
} from '@/utils/drawingImage';
import { createTextMeasure } from '@/utils/drawingMeasure';
import { loadHandFont } from '@/utils/handFont';
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
import { getT, useLanguage, useT } from '@/i18n';

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
  const t = useT();
  const language = useLanguage();
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  // (the image shows what the board shows: no area while they are hidden)
  const allAreas = useNetworkStore((state) => state.areas);
  const areasShown = useUIStore((state) => state.areasShown);
  const areas = useMemo(() => (areasShown ? allAreas : []), [allAreas, areasShown]);
  // The notes of annotation mode, over the drawing, only while the mode is on:
  // the image shows what the board shows
  const canvasMarks = useNetworkStore((state) => state.marks);
  const annotating = useMarkerStore((state) => state.active);
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
  const writing = useMemo(() => (annotating ? canvasMarks : []), [annotating, canvasMarks]);
  // (notes the image leaves out, and says so)
  const notesLeftOut = !annotating && canvasMarks.length > 0;

  // The handwriting goes inside the picture, read once from the app when
  // there are words to write; meanwhile the words are in the computer's
  const hasWords = writing.some((mark) => mark.kind === 'text');
  const [handFont, setHandFont] = useState<string | null>(null);
  useEffect(() => {
    if (!hasWords || handFont) return;
    let cancelled = false;
    void loadHandFont().then((font) => {
      if (!cancelled && font) setHandFont(font);
    });
    return () => {
      cancelled = true;
    };
  }, [hasWords, handFont]);

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
  // (and an address another device has too, in conflict)
  const conflicts = useAddressConflicts();
  const drawnDevices = useMemo(() => {
    // (a device that was leased no address says so in words: said again
    // when the language changes)
    void language;
    return devices.map((device) => {
      const conflict = conflictedAddress(device, conflicts);
      const address = conflict ? getT().canvas.device.conflict(conflict) : shownAddress(device, dhcp);
      return address === device.ip ? device : { ...device, ip: address };
    });
  }, [devices, dhcp, conflicts, language]);

  // What the lamps of the devices say outside a presentation, as on the
  // canvas: who waits for an address, whose address is in conflict, and the
  // answer the last question left
  const waiting = useMemo(
    () => drawnDevices.filter((device) => device.ip === noLeaseLabel()).map((device) => device.id),
    [drawnDevices]
  );
  const inConflict = useMemo(() => [...conflicts.byDevice.keys()], [conflicts]);
  const answer = useSimulationStore((state) => state.answer);

  const measureText = useMemo(() => createTextMeasure(), []);

  // While presenting: what is marked on the drawing, and what is said under it.
  // The same questions to the engine as the panel of the presentation.
  const marks: DrawingMarks | undefined = useMemo(
    () =>
      presenting ? { sourceId, targetId, failedDevices, failedConnections, route } : undefined,
    [presenting, sourceId, targetId, failedDevices, failedConnections, route]
  );

  // The effect of the failures is the panel's, worked out once (utils/impactMemo):
  // when the window opens before it is, the picture waits for it
  const intact: Topology = useMemo(() => ({ devices, connections }), [devices, connections]);
  const failures: Failures = useMemo(
    () => ({ devices: failedDevices, connections: failedConnections }),
    [failedDevices, failedConnections]
  );
  const isBroken = hasFailures(failures);
  const impactOptions = useMemo(
    () => (presenting && isBroken ? { flow, emailMode } : null),
    [presenting, isBroken, flow, emailMode]
  );
  const { report: impact, computing: impactComputing } = useImpact(intact, failures, impactOptions);

  const caption = useMemo(() => {
    if (!presenting) return null;
    const labels = new Map(devices.map((device) => [device.id, device.label] as const));
    const labelOf = (id: string) => labels.get(id) ?? id;
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
          return t.exportImage.picture.cable(
            cable ? `${labelOf(cable.source)} – ${labelOf(cable.target)}` : id
          );
        }),
      ],
      impact,
      labelOf,
    });
  }, [
    presenting,
    devices,
    connections,
    intact,
    failures,
    isBroken,
    impact,
    sourceId,
    targetId,
    flow,
    failedDevices,
    failedConnections,
    emailMode,
    // (the caption is made of sentences: it is written again when the language changes)
    t,
  ]);

  const image = useMemo(
    () => {
      // The picture has words of its own (the two ends of a question, the
      // name it goes by): it is drawn again when the language changes
      void language;
      return renderDrawingImage(
        {
          devices: drawnDevices,
          connections,
          areas,
          deviceTemplates,
          connectionTemplates,
          measureText,
          marks,
          waiting,
          conflicts: inConflict,
          answer,
          writing,
          handFont: handFont ?? undefined,
        },
        {
          theme,
          transparent,
          title: withTitle ? { name: projectName, detail: canvasName ?? undefined } : undefined,
          caption: withCaption && caption ? caption : undefined,
        }
      );
    },
    [
      drawnDevices,
      connections,
      areas,
      deviceTemplates,
      connectionTemplates,
      measureText,
      marks,
      waiting,
      inConflict,
      answer,
      writing,
      handFont,
      theme,
      transparent,
      withTitle,
      projectName,
      canvasName,
      withCaption,
      caption,
      language,
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
  /** The words under the picture wait for the effect of the failures: nothing leaves without it */
  const waitingForEffect = withCaption && impactComputing;

  // "Copiata" goes back to "Copia" after a moment
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleSave = async () => {
    if (waitingForEffect) return;
    const content = format === 'svg' ? svgBlob(image.svg) : pngBlob;
    if (!content) return;
    const outcome = await saveImage(content, imageFileName(projectName, canvasName, format), format);
    if (outcome === 'saved' || outcome === 'downloaded') onClose();
  };

  const handleCopy = async () => {
    if (!pngBlob || waitingForEffect) return;
    if (await copyImage(pngBlob)) setCopied(true);
  };

  const formatName = format.toUpperCase();
  const scaleNames: Record<PngScale, string> = {
    1: t.exportImage.size.normal,
    2: t.exportImage.size.large,
    3: t.exportImage.size.veryLarge,
  };

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
        <div className="modal-header flex items-center justify-between mx-6 pt-5 pb-3 flex-shrink-0">
          <h3 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-color)' }}>
            {t.exportImage.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.actions.close}
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
              disabled={!pngBlob || waitingForEffect}
              title={t.exportImage.copyHint}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t.exportImage.copied : t.exportImage.copy}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={(format === 'png' && !pngBlob) || waitingForEffect}
          >
            <Download size={14} />
            {waitingForEffect
              ? t.exportImage.waitingForEffect
              : preparing
                ? t.exportImage.preparing
                : canChooseWhereToSave()
                ? t.exportImage.save(formatName)
                : t.exportImage.download(formatName)}
          </Button>
        </div>
      }
    >
      <div className="export-image">
        <div className={transparent ? 'export-image-preview transparent' : 'export-image-preview'}>
          <img src={previewUrl} alt={t.exportImage.previewAlt} />
        </div>

        <div className="export-image-options">
          <fieldset>
            <legend>{t.exportImage.format.legend}</legend>
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
            <p className="export-image-hint">{t.exportImage.format.hints[format]}</p>
          </fieldset>

          {format === 'png' && (
            <fieldset>
              <legend>{t.exportImage.size.legend}</legend>
              <div className="segmented compact">
                {PNG_SCALES.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    className={scale === entry ? 'active' : ''}
                    aria-pressed={scale === entry}
                    onClick={() => setScale(entry)}
                  >
                    {scaleNames[entry]}
                  </button>
                ))}
              </div>
              <p className="export-image-hint" data-testid="export-image-pixels">
                {t.exportImage.size.pixels(pixels.width, pixels.height, pngScale < scale)}
              </p>
            </fieldset>
          )}

          <fieldset>
            <legend>{t.exportImage.theme.legend}</legend>
            <div className="segmented compact">
              <button
                type="button"
                className={theme === 'light' ? 'active' : ''}
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
              >
                {t.exportImage.theme.light}
              </button>
              <button
                type="button"
                className={theme === 'dark' ? 'active' : ''}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
              >
                {t.exportImage.theme.dark}
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend>{t.exportImage.content.legend}</legend>
            <label className="export-image-check">
              <input
                type="checkbox"
                checked={withTitle}
                onChange={(event) => setWithTitle(event.target.checked)}
              />
              {t.exportImage.content.projectName}
            </label>
            {caption && (
              <label className="export-image-check">
                <input
                  type="checkbox"
                  checked={withCaption}
                  onChange={(event) => setWithCaption(event.target.checked)}
                />
                {caption.tone
                  ? t.exportImage.content.questionAndAnswer
                  : t.exportImage.content.failures}
              </label>
            )}
            <label className="export-image-check">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(event) => setTransparent(event.target.checked)}
              />
              {t.exportImage.content.transparent}
            </label>
          </fieldset>

          {/* Only when the presentation has put something on the drawing */}
          {presenting && caption && (
            <p className="export-image-hint">{t.exportImage.presentationNote}</p>
          )}

          {/* Notes hidden while annotation mode is off are not in the picture */}
          {notesLeftOut && <p className="export-image-hint">{t.marker.notInImage}</p>}

          {failed && format === 'png' && (
            <div className="modal-error-box" role="alert">
              {t.exportImage.pngFailed}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ExportImageModal;
