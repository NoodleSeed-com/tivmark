import type { NextApiRequest, NextApiResponse } from 'next';
import { ZodError } from 'zod';

import { ApiError } from '@/lib/errors';

const codeForStatus = (status: number) => {
  if (status === 400) return 'bad_request';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'validation_failed';
  if (status === 429) return 'rate_limited';
  return 'internal_error';
};

export const sendProblem = (res: NextApiResponse, error: unknown) => {
  const isValidation = error instanceof ZodError;
  const status = isValidation
    ? 422
    : error instanceof ApiError
      ? error.status
      : 500;
  const detail =
    error instanceof Error ? error.message : 'An unexpected error occurred.';

  return res.status(status).json({
    type: `https://tivmark.com/problems/${codeForStatus(status)}`,
    code: codeForStatus(status),
    title: status === 500 ? 'Internal server error' : detail,
    status,
    detail,
    ...(isValidation
      ? {
          errors: error.flatten().fieldErrors,
        }
      : {}),
  });
};

export const methodNotAllowed = (
  req: NextApiRequest,
  res: NextApiResponse,
  methods: string[]
) => {
  res.setHeader('Allow', methods.join(', '));
  return res.status(405).json({
    type: 'https://tivmark.com/problems/method_not_allowed',
    code: 'method_not_allowed',
    title: 'Method not allowed',
    status: 405,
    detail: `Method ${req.method} is not allowed.`,
  });
};
