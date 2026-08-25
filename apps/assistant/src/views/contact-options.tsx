import { useState } from 'react';

import { useLayout, useOpenExternal, useToolInfo } from '../helpers.js';
import {
  normalizeContactOptions,
  type ContactOption,
  type ContactOptionsViewState,
} from './widget-data.js';
import {
  WidgetAction,
  WidgetFeedback,
  WidgetFrame,
  type WidgetTheme,
} from './widget-ui.js';
import './widget-style.css';

type ContactOptionsViewProps = {
  readonly theme: WidgetTheme;
  readonly state: ContactOptionsViewState;
  readonly onOpen?: (option: ContactOption) => void;
};

// Exported pure so tests can drive every state without an MCP host.
export function ContactOptionsView({
  theme,
  state,
  onOpen,
}: ContactOptionsViewProps) {
  const [opening, setOpening] = useState<string | undefined>(undefined);

  const body = () => {
    if (state.kind === 'loading') {
      return <WidgetFeedback kind="loading">Finding your options…</WidgetFeedback>;
    }
    if (state.kind === 'error') {
      return (
        <WidgetFeedback kind="error">
          These options could not be loaded. The contact details on tivmark.com still work.
        </WidgetFeedback>
      );
    }
    if (state.kind === 'empty') {
      return (
        <WidgetFeedback kind="empty">
          No contact options are configured right now.
        </WidgetFeedback>
      );
    }

    return (
      <>
        {state.kind === 'partial' ? (
          <WidgetFeedback kind="partial">
            Some options could not be shown.
          </WidgetFeedback>
        ) : null}
        <ul className="tv-list">
          {state.data.options.map((option) => (
            <li className="tv-row" key={option.id}>
              <div className="tv-row-main">
                <div className="tv-row-title">{option.label}</div>
                <div className="tv-row-detail">{option.detail}</div>
              </div>
              <WidgetAction
                tone="primary"
                // The row already names the option; repeating it on the button is noise.
                // Screen readers still get the full name through aria-label, so three
                // buttons reading "Open" stay distinguishable.
                aria-label={option.label}
                pending={opening === option.id}
                pendingLabel="Opening…"
                onClick={() => {
                  setOpening(option.id);
                  // The host opens the link. A widget never calls window.open, and the
                  // target origin must be declared in the server's handoff.allowedDomains.
                  Promise.resolve(onOpen?.(option)).finally(() =>
                    setOpening(undefined),
                  );
                }}
              >
                Open
              </WidgetAction>
            </li>
          ))}
        </ul>
      </>
    );
  };

  return (
    <WidgetFrame
      theme={theme}
      title="Talk to Tivmark"
      subtitle="Pick whichever fits — each one opens tivmark.com."
      dataLlm={
        state.kind === 'ready' || state.kind === 'partial'
          ? `${state.data.options.length} contact option(s)`
          : state.kind
      }
    >
      {body()}
    </WidgetFrame>
  );
}

export default function ContactOptions() {
  const { theme } = useLayout();
  const toolInfo = useToolInfo('talk_to_sales');
  const openExternal = useOpenExternal();
  const pending = Object.keys(toolInfo).length === 0;
  const state = normalizeContactOptions(toolInfo.structuredContent, {
    pending,
    error: toolInfo.isError,
  });

  return (
    <ContactOptionsView
      theme={theme === 'dark' ? 'dark' : 'light'}
      state={state}
      onOpen={(option) => openExternal(option.url)}
    />
  );
}
