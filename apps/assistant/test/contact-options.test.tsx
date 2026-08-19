// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ContactOptionsView } from '../src/views/contact-options.js';
import { normalizeContactOptions } from '../src/views/widget-data.js';

const options = [
  {
    id: 'demo',
    label: 'Book a walkthrough',
    url: 'https://tivmark.com/#contact',
    detail: 'A short tour of Tivmark with the team.',
  },
  {
    id: 'start',
    label: 'Start a workspace',
    url: 'https://app.tivmark.com/?tab=join',
    detail: 'Set up your first team in minutes.',
  },
];

describe('contact options widget', () => {
  it('renders each way to reach Tivmark with its explanation', () => {
    render(
      <ContactOptionsView theme="light" state={{ kind: 'ready', data: { options } }} />,
    );

    expect(screen.getByText('Book a walkthrough')).toBeInTheDocument();
    expect(
      screen.getByText('A short tour of Tivmark with the team.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Start a workspace')).toBeInTheDocument();
  });

  it('asks the host to open the link rather than navigating itself', () => {
    const onOpen = vi.fn();
    render(
      <ContactOptionsView
        theme="light"
        state={{ kind: 'ready', data: { options } }}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start a workspace' }));

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://app.tivmark.com/?tab=join' }),
    );
  });

  it('announces a failure without offering a dead control', () => {
    render(
      <ContactOptionsView
        theme="light"
        state={{ kind: 'error', message: 'nope' }}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('drops options that are not absolute https links', () => {
    // The host opens these against a declared allowlist. A relative or javascript: URL would
    // render as a control that can never work, so it is dropped before it reaches the UI.
    const state = normalizeContactOptions({
      options: [
        options[0],
        { ...options[1], url: 'javascript:alert(1)' },
      ],
    });

    expect(state.kind).toBe('partial');
    if (state.kind !== 'partial') return;
    expect(state.data.options).toHaveLength(1);
    expect(state.data.options[0]?.id).toBe('demo');
  });

  it('treats a pending tool result as loading, not empty', () => {
    const state = normalizeContactOptions(undefined, { pending: true });
    expect(state.kind).toBe('loading');
  });
});
