import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';

interface CreateApiKeyParams {
  name: string;
  teamId: string;
  createdById?: string;
  scopes?: string[];
  expiresAt?: Date | null;
}

const hashApiKey = (apiKey: string) => {
  return createHash('sha256').update(apiKey).digest('hex');
};

const generateUniqueApiKey = () => {
  const apiKey = `tiv_sk_${randomBytes(32).toString('base64url')}`;

  return [hashApiKey(apiKey), apiKey];
};

export const createApiKey = async (params: CreateApiKeyParams) => {
  const { name, teamId, createdById, scopes = [], expiresAt } = params;

  const [hashedKey, apiKey] = generateUniqueApiKey();

  await prisma.apiKey.create({
    data: {
      name,
      hashedKey: hashedKey,
      prefix: apiKey.slice(0, 15),
      scopes,
      expiresAt,
      team: { connect: { id: teamId } },
      createdBy: createdById ? { connect: { id: createdById } } : undefined,
    },
  });

  return apiKey;
};

export const fetchApiKeys = async (teamId: string) => {
  return prisma.apiKey.findMany({
    where: {
      teamId,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
    },
  });
};

export const deleteApiKey = async (id: string) => {
  return prisma.apiKey.delete({
    where: {
      id,
    },
  });
};

export const getApiKey = async (apiKey: string) => {
  const credential = await prisma.apiKey.findUnique({
    where: {
      hashedKey: hashApiKey(apiKey),
    },
    select: {
      id: true,
      teamId: true,
      scopes: true,
      expiresAt: true,
    },
  });

  if (
    !credential ||
    (credential.expiresAt && credential.expiresAt <= new Date())
  ) {
    return null;
  }

  await prisma.apiKey.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  });

  return credential;
};

export const getApiKeyById = async (id: string) => {
  return prisma.apiKey.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      teamId: true,
    },
  });
};
