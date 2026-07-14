import type { ServerDefinition } from '@noodleseed/one';
import {
  ActionBar,
  DataCard,
  DataList,
  EmptyState,
  Fact,
  Field,
  Flow,
  Frame,
  Input,
  Select,
  StatusBadge,
  SubmitButton,
  Textarea,
  generateHelpers,
} from '@noodleseed/one/react';

export type AppType = ServerDefinition;

export const { useCallTool, useLayout, useToolInfo, useViewState } =
  generateHelpers<AppType>();

export {
  ActionBar,
  DataCard,
  DataList,
  EmptyState,
  Fact,
  Field,
  Flow,
  Frame,
  Input,
  Select,
  StatusBadge,
  SubmitButton,
  Textarea,
};
