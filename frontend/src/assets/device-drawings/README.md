# The drawings of the devices

The 24 drawings PixelCake shows a device with: on the canvas, in its lists and
windows, in the picture it exports. They were made for this app and are part
of it, under its licence. They are not from an icon set.

Each file is one device in a square of 128 units, built the same way:

- **Two layers.** The device is a flat silhouette cut in two, like a cake: a
  lower layer and an upper one, with a cut of 5 units between them. Where the
  upper layer ends is different in every drawing (`<clipPath>`: a rectangle as
  high as the layer).
- **The symbol.** What tells one device from another (the arrows of a router,
  the globe of a web server) is drawn on the layers in the colour of what is
  behind the drawing, and so is the cut: they read as holes.
- **The upper layer is the lamp of the device.** Its colour says the state the
  device is in: at rest, selected, working, to be looked at, failing, off. The
  lower layer never changes.

In a file the shapes are written three times: once in the colour of the lower
layer; once inside `<g class="pc-stato">`, clipped to the upper layer and
filled with `var(--pc-stato, …)`; once, in white, in the mask that keeps the
cut inside the silhouette. The colours written in the files are those of the
light theme.

## How the app uses them

The app does not load these files. `pnpm drawings:build`
(`scripts/build-device-drawings.mjs`) reads them and writes
`src/data/deviceDrawings.ts`: for each drawing its shapes once, without a
colour, the height of its upper layer and the box of what is drawn. Nothing of
a shape is changed. `components/ui/DeviceDrawing.tsx` draws a device from
that, with the colours of the theme (`--device-lower`, `--device-upper`,
`--device-ground`, and the colours of the states in `index.css`), and
`utils/drawingImage.ts` does the same in the exported picture.

`icone.json` is the kit's own list of its drawings, as it came with them: the
name of each and the group it is in (the network, the servers, the data, the
end devices). The script writes the groups with the shapes
(`DEVICE_DRAWING_GROUPS`), in the order of the kit, and stops when a drawing
is in no group or a group names a drawing that has no file. The drawing
picker of a template shows the drawings in those groups; their names, in
both languages, are in the dictionaries (`templates.devices.drawingNames`).

To change a drawing, or add one: keep the construction above (the script
stops on a file that is built otherwise), run `pnpm drawings:build`, and give
the new drawing a device in `utils/deviceDrawing.ts`.
