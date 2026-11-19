import type { Dictionary } from '../dictionary';

/** Settings, advanced tab: figures and shortcuts */
export const advanced: Dictionary['advanced'] = {
  usage: {
    title: 'Usage statistics',
    intro: 'Statistics on the current use of the app.',
    devices: {
      title: 'Devices on the board',
      caption: 'Devices on the open board',
    },
    links: {
      title: 'Links on the board',
      caption: 'Links between devices',
    },
    deviceTemplates: {
      title: 'Custom device templates',
      caption: 'Custom templates created',
    },
    linkTemplates: {
      title: 'Custom link templates',
      caption: 'Link templates you created',
    },
  },

  shortcuts: {
    title: 'Keyboard and mouse shortcuts',
    intro:
      'Every key and gesture of the app, as on Windows and Linux. On a Mac, Ctrl becomes Cmd for save, undo, redo, copy and paste; the list with the Mac keys is in the documentation.',
    /** The groups: the sections of the page of the documentation */
    groups: {
      board: 'On the board',
      pointer: 'With the pointer',
      windows: 'In the windows',
      terminal: 'In the terminal',
      presenting: 'While presenting',
      marker: 'With the marker',
      tour: 'In the guided tour',
    },
    /** What each shortcut does, and the keys (or the gesture) that do it */
    rows: {
      save: { action: 'Save the project to a file', keys: 'Ctrl + S' },
      undo: { action: 'Undo the last change to the drawing', keys: 'Ctrl + Z' },
      redo: { action: 'Redo the change undone', keys: 'Ctrl + Y, Ctrl + Shift + Z' },
      copy: { action: 'Copy the selected devices and areas', keys: 'Ctrl + C' },
      paste: { action: 'Paste the copied devices and areas', keys: 'Ctrl + V' },
      delete: {
        action: 'Delete the selected devices, cables and areas (asks first)',
        keys: 'Delete',
      },
      toggleSelection: {
        action: 'Add a device, or an area (on its name or border), to the selection, or remove it',
        keys: 'Ctrl + click',
      },
      selectionBox: {
        action: 'Select several devices and areas with a selection box',
        keys: 'Drag on empty space',
      },
      pan: { action: 'Move the view', keys: 'Right button + drag' },
      zoom: { action: 'Zoom', keys: 'Mouse wheel' },
      zoomPoint: { action: 'Zoom in on a point', keys: 'Double click on empty space' },
      moveDevice: { action: 'Move a device', keys: 'Drag it' },
      nudge: { action: 'Move the selected device a little', keys: 'Arrow keys' },
      nudgeFar: { action: 'Move it further', keys: 'Shift + arrow keys' },
      release: { action: 'Let go of the selection', keys: 'Esc' },
      focusNext: { action: 'Move the keyboard focus through the cables and the devices', keys: 'Tab' },
      focusSelect: { action: 'Select the device that has the focus', keys: 'Enter' },

      openDevice: { action: 'Open the window of a device', keys: 'Double click' },
      deviceMenu: { action: 'Open the menu of a device', keys: 'Right click on the device' },
      cableMenu: { action: 'Open the menu of a cable', keys: 'Right click on the cable' },
      drawCable: {
        action: 'Draw a cable',
        keys: 'Drag from the edge of a device to another',
      },
      readNote: { action: 'Read the note of a device', keys: 'Rest the pointer on the device' },
      selectArea: { action: 'Select an area', keys: 'Click on its name or its border' },
      moveArea: {
        action: 'Move an area, or resize it',
        keys: 'Drag its name, its border or a handle',
      },
      renameArea: { action: 'Rename an area', keys: 'Double click on its name, or Enter' },
      areaMenu: { action: 'Open the menu of an area', keys: 'Right click on the area' },
      renameProject: {
        action: 'Rename the project or a board',
        keys: 'Double click on its name in the Explorer',
      },

      closeWindow: { action: 'Close the window on top', keys: 'Esc' },
      confirm: { action: 'Confirm a question, or a name being edited', keys: 'Enter' },
      nextField: { action: 'Move to the next field or the previous one', keys: 'Tab, Shift + Tab' },
      vlans: { action: 'Add the VLAN typed, in the VLAN field of a device', keys: 'Enter or comma' },

      run: { action: 'Run the command', keys: 'Enter' },
      history: { action: 'Walk through the commands of the session', keys: 'Up arrow, Down arrow' },
      interrupt: { action: 'Stop a ping or a trace that is running', keys: 'Ctrl + C' },
      closeTerminal: {
        action: 'Close the terminal (a ping or a trace that is running is stopped first)',
        keys: 'Esc',
      },

      leavePresentation: { action: 'Leave the presentation', keys: 'Esc' },
      askOrBreak: { action: 'Ask a question or simulate a failure', keys: 'Click a device or a cable' },
      presentationView: { action: 'Move the view', keys: 'Drag with the left button' },

      markerToggle: { action: 'Turn the marker on or off, also while presenting', keys: 'P' },
      markerOff: { action: 'Turn the marker off', keys: 'Esc' },
      markerText: { action: 'Write the words typed on the board (Esc gives them up)', keys: 'Enter' },
      markerNewLine: { action: 'Start a new line in the words', keys: 'Shift + Enter' },
      markerView: { action: 'Move the view while writing', keys: 'Right button + drag, mouse wheel' },

      tourNext: { action: 'Go to the next step', keys: 'Right arrow, Enter' },
      tourBack: { action: 'Go back a step', keys: 'Left arrow' },
      tourClose: { action: 'Close the tour, at any step', keys: 'Esc' },
      tourButtons: { action: 'Move between the buttons of the tour', keys: 'Tab, Shift + Tab' },
    },
  },
};
