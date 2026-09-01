export type NewHireLaunchReceipt = {
  status: 'READY' | 'ACTIVE';
  launchId: string;
  team: { id: string; name: string; slug: string };
  newHire: {
    name: string;
    email: string;
    jobTitle: string;
    startDate: string;
    workLocation: string;
    timeZone: string;
    role: 'ADMIN' | 'MEMBER';
  };
  invitation: {
    id: string | null;
    status: 'PENDING' | 'ACCEPTED';
    expiresAt: string | null;
  };
  equipment: {
    package: 'STANDARD' | 'DESIGN' | 'ENGINEERING' | 'NONE';
    label: string;
    requestId: string | null;
    item: string | null;
    status: string | null;
  };
  policies: Array<{
    type: string;
    allowanceHalfDays: number | null;
    allowanceDays: number | null;
    assignment: 'ON_ACCEPTANCE';
  }>;
  checklist: Array<{
    id: string;
    label: string;
    status: 'COMPLETE';
  }>;
  nextSteps: Array<{ id: string; label: string; url: string }>;
  createdAt: string;
  activatedAt: string | null;
  authenticated: true;
};
