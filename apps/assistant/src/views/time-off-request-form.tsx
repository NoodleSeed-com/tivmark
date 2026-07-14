import { useEffect, useState } from "react";
import {
  ActionBar,
  Field,
  Frame,
  Input,
  Select,
  StatusBadge,
  SubmitButton,
  Textarea,
  useCallTool,
  useLayout,
  useToolInfo,
  useUpdateModelContext,
  useWidgetLifecycle,
} from "../helpers.js";

const TYPE_OPTIONS = [
  { value: "VACATION", label: "Vacation" },
  { value: "SICK", label: "Sick" },
  { value: "PERSONAL", label: "Personal" },
  { value: "UNPAID", label: "Unpaid" },
];

export default function RequestForm() {
  const info = useToolInfo("request_time_off").structuredContent as
    | { team?: string; prompt?: string }
    | undefined;
  const team = info?.team ?? "";
  const submit = useCallTool("submit_time_off");

  // Widget → model channel: tell the assistant the form is on screen and what it currently holds, and
  // report the submitted milestone. So the assistant knows a form is open (no more "I can't see it")
  // and can react after submission without the user re-explaining.
  const layout = useLayout();
  const publishModelContext = useUpdateModelContext();
  const emitLifecycle = useWidgetLifecycle("time-off-request-form");

  const [type, setType] = useState("VACATION");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = startDate !== "" && endDate !== "" && endDate >= startDate;

  useEffect(() => {
    if (!layout.supports?.modelContext) return;
    const text = result
      ? `Time-off request submitted: ${result}`
      : `Time-off request form is open for team "${team}": ${type}, ${
          startDate || "no start date"
        } to ${endDate || "no end date"}.`;
    publishModelContext({
      content: [{ type: "text", text }],
      structuredContent: {
        widget: {
          name: "time-off-request-form",
          formOpen: !result,
          team,
          type,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    }).catch(() => {});
    // publishModelContext identity is stable per render contract; track the field values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.supports?.modelContext, team, type, startDate, endDate, result]);

  async function onSubmit() {
    if (!valid) {
      setError("Pick a start and end date (end on or after start).");
      return;
    }
    setError(null);
    try {
      const res = await submit.callTool({
        team,
        type,
        startDate,
        endDate,
        reason,
      });
      const s = res.structuredContent as { status?: string } | undefined;
      const status = s?.status ?? "Request submitted.";
      setResult(status);
      emitLifecycle("submitted", { team, type, startDate, endDate }).catch(
        () => {},
      );
    } catch {
      setError(
        "Could not submit the request — it may overlap an existing one.",
      );
    }
  }

  if (result) {
    return (
      <main data-llm={`Time-off request submitted: ${result}`}>
        <Frame title="Request submitted">
          <StatusBadge tone="success">Submitted</StatusBadge>
          <p>{result}</p>
        </Frame>
      </main>
    );
  }

  return (
    <main data-llm="Time-off request form (type, start date, end date, reason)">
      <Frame title="Request time off" subtitle={info?.prompt}>
        <Field label="Type" required>
          <Select
            value={type}
            options={TYPE_OPTIONS}
            onChange={(e) => setType(e.currentTarget.value)}
          />
        </Field>
        <Field label="Start date" required>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.currentTarget.value)}
          />
        </Field>
        <Field label="End date" required>
          <Input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.currentTarget.value)}
          />
        </Field>
        <Field label="Reason" detail="Optional">
          <Textarea
            value={reason}
            rows={2}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
        </Field>
        {error ? <StatusBadge tone="danger">{error}</StatusBadge> : null}
        <ActionBar>
          <SubmitButton
            pending={submit.isPending}
            pendingLabel="Submitting…"
            onClick={onSubmit}
          >
            Submit request
          </SubmitButton>
        </ActionBar>
      </Frame>
    </main>
  );
}
