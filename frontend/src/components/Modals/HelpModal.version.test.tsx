/**
 * The version the guide shows is the one of package.json, read when the app
 * is built: never a number written in the window. Here the version is made
 * another one, and the guide has to follow.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import HelpModal from './HelpModal';

vi.mock('@/constants/brand', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/constants/brand')>()),
  APP_VERSION: '9.8.7',
}));

describe('the version in the guide', () => {
  it('is the version of the app, whatever it is', () => {
    useUIStore.getState().openHelp('about');
    render(<HelpModal />);

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('9.8.7 (Beta)')).toBeInTheDocument();
  });
});
