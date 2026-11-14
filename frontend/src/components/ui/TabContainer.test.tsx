/**
 * TabContainer: the open tab is kept by the container, or by whoever uses it.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TabContainer, { type Tab } from './TabContainer';

const TABS: Tab[] = [
  { id: 'one', label: 'Uno', content: <p>primo</p> },
  { id: 'two', label: 'Due', content: <p>secondo</p> },
];
const opened = () => document.querySelector('.tab-header.active')?.textContent;

describe('TabContainer', () => {
  it('by itself opens the first tab, or the one asked for, and follows the clicks', () => {
    const { unmount } = render(<TabContainer tabs={TABS} />);
    expect(opened()).toBe('Uno');
    expect(screen.getByText('primo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Due' }));
    expect(opened()).toBe('Due');
    expect(screen.getByText('secondo')).toBeInTheDocument();
    expect(screen.queryByText('primo')).toBeNull();
    unmount();

    render(<TabContainer tabs={TABS} defaultTab="two" />);
    expect(opened()).toBe('Due');
  });

  it('shows the tab it is given, and says which one is asked for', () => {
    const onTabChange = vi.fn();
    const { rerender } = render(<TabContainer tabs={TABS} activeTab="two" onTabChange={onTabChange} />);
    expect(opened()).toBe('Due');

    // a click asks; the tab changes when whoever keeps it says so
    fireEvent.click(screen.getByRole('button', { name: 'Uno' }));
    expect(onTabChange).toHaveBeenCalledWith('one');
    expect(opened()).toBe('Due');
    rerender(<TabContainer tabs={TABS} activeTab="one" onTabChange={onTabChange} />);
    expect(opened()).toBe('Uno');
    expect(screen.getByText('primo')).toBeInTheDocument();
  });

  it('whoever keeps the open tab can send to another one from inside a tab', () => {
    function Window() {
      const [tab, setTab] = useState('one');
      const tabs: Tab[] = [
        {
          id: 'one',
          label: 'Uno',
          content: (
            <button type="button" onClick={() => setTab('two')}>
              vai al secondo
            </button>
          ),
        },
        TABS[1],
      ];
      return <TabContainer tabs={tabs} activeTab={tab} onTabChange={setTab} />;
    }
    render(<Window />);
    fireEvent.click(screen.getByRole('button', { name: 'vai al secondo' }));
    expect(opened()).toBe('Due');
    expect(screen.getByText('secondo')).toBeInTheDocument();
    // and the headers still work
    fireEvent.click(screen.getByRole('button', { name: 'Uno' }));
    expect(opened()).toBe('Uno');
  });
});
