/**
 * The keys of undo and redo: Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo
 * (Cmd on a Mac), with Caps Lock on and on a keyboard whose letters are not
 * Latin too. In a field the keys are the browser's, for the text; nothing
 * happens while presenting, nor while a window or a question is open over
 * the board. And a press of the pointer: whatever changes until it is let
 * go is one step.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import type { NetworkDevice } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { askConfirm } from '@/store/confirmStore';
import { clearHistory, useHistoryStore } from '@/store/historyStore';
import { registerUndoShortcuts } from './undoActions';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const pc = (label: string, x = 100): Omit<NetworkDevice, 'id'> => ({
  type: 'PC',
  label,
  ip: '',
  subnet: '255.255.255.0',
  gateway: '',
  position: { x, y: 100 },
});

const labels = () => useNetworkStore.getState().devices.map((device) => device.label);

/** PC-1 added, as a step of its own */
async function addPc() {
  useNetworkStore.getState().addDevice(pc('PC-1'));
  await settle();
}

/** A key pressed on what has the focus (the page when nothing has it); false when the app took it */
const press = (init: KeyboardEventInit, target: Element = document.body) => fireEvent.keyDown(target, init);

const UNDO = { key: 'z', code: 'KeyZ', ctrlKey: true };

let unregister: () => void;

beforeEach(async () => {
  localStorage.clear();
  usePresentationStore.getState().exit();
  useNetworkStore.setState({ devices: [], connections: [], areas: [], selectedDeviceIds: [], selectedAreaIds: [] });
  useUIStore.setState((state) => ({
    modals: Object.fromEntries(Object.keys(state.modals).map((name) => [name, false])) as typeof state.modals,
  }));
  await settle();
  clearHistory();
  unregister = registerUndoShortcuts();
});

afterEach(() => {
  unregister();
  document.body.innerHTML = '';
});

describe('the keys of undo', () => {
  it.each([
    ['Ctrl+Z', UNDO],
    ['Cmd+Z, on a Mac', { key: 'z', code: 'KeyZ', metaKey: true }],
    ['Ctrl+Z with Caps Lock on', { key: 'Z', code: 'KeyZ', ctrlKey: true }],
    ['Ctrl+Z on a Russian keyboard', { key: 'я', code: 'KeyZ', ctrlKey: true }],
  ])('%s undoes', async (_name, keys) => {
    await addPc();
    expect(press(keys)).toBe(false);
    expect(labels()).toEqual([]);
  });

  it.each([
    ['Ctrl+Y', { key: 'y', code: 'KeyY', ctrlKey: true }],
    ['Ctrl+Shift+Z', { key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true }],
    ['Cmd+Shift+Z, on a Mac', { key: 'Z', code: 'KeyZ', metaKey: true, shiftKey: true }],
    ['Ctrl+Shift+Z with Caps Lock on', { key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true }],
    ['Ctrl+Y on a Greek keyboard', { key: 'υ', code: 'KeyY', ctrlKey: true }],
  ])('%s redoes', async (_name, keys) => {
    await addPc();
    press(UNDO);
    expect(press(keys)).toBe(false);
    expect(labels()).toEqual(['PC-1']);
  });

  it('other keys with Ctrl are not undo or redo: Ctrl+Alt+Z, Ctrl+Shift+Y, Z alone', async () => {
    await addPc();
    expect(press({ key: 'z', code: 'KeyZ', ctrlKey: true, altKey: true })).toBe(true);
    expect(press({ key: 'Y', code: 'KeyY', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(press({ key: 'z', code: 'KeyZ' })).toBe(true);
    expect(labels()).toEqual(['PC-1']);
  });

  it.each([
    ['a text field', 'input'],
    ['a text area', 'textarea'],
  ])('in %s the keys are the browser’s, for the text: the drawing stays as it is', async (_name, tag) => {
    await addPc();
    const field = document.createElement(tag);
    document.body.appendChild(field);
    field.focus();
    expect(press(UNDO, field)).toBe(true);
    expect(press({ key: 'y', code: 'KeyY', ctrlKey: true }, field)).toBe(true);
    expect(labels()).toEqual(['PC-1']);
  });

  it('in the line of the terminal too, while the terminal is open', async () => {
    await addPc();
    useUIStore.getState().openModal('codeTerminal');
    const line = document.createElement('input');
    document.body.appendChild(line);
    expect(press(UNDO, line)).toBe(true);
    expect(labels()).toEqual(['PC-1']);
    // (the terminal floats beside the board: outside its line the keys are the board's)
    expect(press(UNDO)).toBe(false);
    expect(labels()).toEqual([]);
  });

  it('do nothing while presenting', async () => {
    await addPc();
    usePresentationStore.getState().enter();
    press(UNDO);
    expect(labels()).toEqual(['PC-1']);
  });

  it('do nothing while a window is open over the board, or a question', async () => {
    await addPc();
    useUIStore.getState().openModal('settings');
    press(UNDO);
    expect(labels()).toEqual(['PC-1']);
    useUIStore.getState().closeModal('settings');

    void askConfirm({ title: 'Delete?', confirmLabel: 'Delete' });
    press(UNDO);
    expect(labels()).toEqual(['PC-1']);
  });
});

describe('a press of the pointer', () => {
  it('makes whatever changes until it is let go one step', async () => {
    const id = useNetworkStore.getState().addDevice(pc('PC-1'));
    await settle();
    clearHistory();
    fireEvent.pointerDown(document.body, { pointerId: 1, button: 0 });
    for (let x = 110; x <= 300; x += 10) {
      useNetworkStore.getState().updateDevice(id, { position: { x, y: 100 } });
      await settle();
    }
    fireEvent.pointerUp(document.body, { pointerId: 1 });
    await settle();
    expect(useHistoryStore.getState().canUndo).toBe(true);
    press(UNDO);
    expect(useNetworkStore.getState().devices[0].position).toEqual({ x: 100, y: 100 });
    expect(useHistoryStore.getState().canUndo).toBe(false);
  });

  it('ends with the page losing the focus, if the release never comes', async () => {
    const id = useNetworkStore.getState().addDevice(pc('PC-1'));
    await settle();
    clearHistory();
    fireEvent.pointerDown(document.body, { pointerId: 1, button: 0 });
    useNetworkStore.getState().updateDevice(id, { position: { x: 400, y: 100 } });
    fireEvent.blur(window);
    await settle();
    expect(useHistoryStore.getState().canUndo).toBe(true);
  });
});
