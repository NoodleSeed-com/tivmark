import Link from 'next/link';
import { useRouter } from 'next/router';
import { useFormik } from 'formik';
import { signIn, useSession } from 'next-auth/react';
import { Button } from 'react-daisyui';
import type { ComponentStatus } from 'react-daisyui/dist/types';
import ReCAPTCHA from 'react-google-recaptcha';
import { useTranslation } from 'next-i18next';
import { useEffect, useRef, useState } from 'react';
import * as Yup from 'yup';

import env from '@/lib/env';
import { maxLengthPolicies } from '@/lib/common';
import {
  Alert,
  InputWithLabel,
  Loading,
  ThemeLogo,
  ThemeToggle,
} from '@/components/shared';
import AgreeMessage from './AgreeMessage';
import GithubButton from './GithubButton';
import GoogleButton from './GoogleButton';
import Join from './Join';
import JoinWithInvitation from './JoinWithInvitation';
import GoogleReCAPTCHA from '@/components/shared/GoogleReCAPTCHA';
import TogglePasswordVisibility from '@/components/shared/TogglePasswordVisibility';
import { safeCallbackUrl, type OnboardingBlueprint } from '@/lib/onboarding';

type AuthProviders = {
  github: boolean;
  google: boolean;
  email: boolean;
  saml: boolean;
  credentials: boolean;
};

interface AuthPortalProps {
  csrfToken?: string | null;
  authProviders: AuthProviders;
  recaptchaSiteKey: string | null;
  initialTab: 'login' | 'signup';
  onboardingBlueprint?: OnboardingBlueprint;
}

interface Message {
  text: string | null;
  status: ComponentStatus | null;
}

const LoginForm = ({
  csrfToken,
  authProviders,
  recaptchaSiteKey,
  token,
  callbackUrl,
}: Omit<AuthPortalProps, 'initialTab'> & {
  token?: string;
  callbackUrl?: string;
}) => {
  const { t } = useTranslation('common');
  const [message, setMessage] = useState<Message>({ text: null, status: null });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const redirectUrl = token
    ? `/invitations/${token}`
    : safeCallbackUrl(callbackUrl, env.redirectIfAuthenticated);

  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema: Yup.object().shape({
      email: Yup.string().required().email().max(maxLengthPolicies.email),
      password: Yup.string().required().max(maxLengthPolicies.password),
    }),
    onSubmit: async ({ email, password }) => {
      setMessage({ text: null, status: null });

      const response = await signIn('credentials', {
        email,
        password,
        csrfToken,
        redirect: false,
        callbackUrl: redirectUrl,
        recaptchaToken,
      });

      recaptchaRef.current?.reset();

      if (!response?.ok) {
        setMessage({
          text: response?.error || 'Something went wrong',
          status: 'error',
        });
        return;
      }

      window.location.assign(response.url || redirectUrl);
    },
  });

  const params = token ? `?token=${encodeURIComponent(token)}` : '';

  return (
    <>
      {message.text && message.status && (
        <Alert status={message.status} className="mb-4">
          {t(message.text)}
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {authProviders.github && <GithubButton />}
        {authProviders.google && <GoogleButton />}
      </div>

      {(authProviders.github || authProviders.google) &&
        authProviders.credentials && <div className="divider">{t('or')}</div>}

      {authProviders.credentials && (
        <form onSubmit={formik.handleSubmit} noValidate>
          <div className="space-y-3">
            <InputWithLabel
              type="email"
              autoComplete="email"
              label={t('email')}
              name="email"
              placeholder={t('email-placeholder')}
              value={formik.values.email}
              error={formik.touched.email ? formik.errors.email : undefined}
              onBlur={formik.handleBlur}
              onChange={formik.handleChange}
            />
            <div className="relative flex">
              <InputWithLabel
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                name="password"
                placeholder={t('password')}
                value={formik.values.password}
                label={
                  <label className="label">
                    <span className="label-text">{t('password')}</span>
                    <Link
                      href="/auth/forgot-password"
                      className="label-text-alt text-ui-accent hover:text-ui-heading"
                    >
                      {t('forgot-password')}
                    </Link>
                  </label>
                }
                error={
                  formik.touched.password ? formik.errors.password : undefined
                }
                onBlur={formik.handleBlur}
                onChange={formik.handleChange}
              />
              <TogglePasswordVisibility
                isPasswordVisible={isPasswordVisible}
                handlePasswordVisibility={() =>
                  setIsPasswordVisible((visible) => !visible)
                }
              />
            </div>
            <GoogleReCAPTCHA
              recaptchaRef={recaptchaRef}
              onChange={setRecaptchaToken}
              siteKey={recaptchaSiteKey}
            />
          </div>
          <div className="mt-5 space-y-3">
            <Button
              type="submit"
              color="primary"
              loading={formik.isSubmitting}
              fullWidth
              size="md"
            >
              {t('sign-in')}
            </Button>
            <AgreeMessage text={t('sign-in')} />
          </div>
        </form>
      )}

      {(authProviders.email || authProviders.saml) && (
        <div className="divider" />
      )}

      <div className="space-y-3">
        {authProviders.email && (
          <Link
            href={`/auth/magic-link${params}`}
            className="btn btn-outline w-full"
          >
            {t('sign-in-with-email')}
          </Link>
        )}
        {authProviders.saml && (
          <Link href="/auth/sso" className="btn btn-outline w-full">
            {t('continue-with-saml-sso')}
          </Link>
        )}
      </div>
    </>
  );
};

const SignupProviders = ({
  authProviders,
}: {
  authProviders: AuthProviders;
}) => {
  const { t } = useTranslation('common');
  const hasSocialProvider = authProviders.github || authProviders.google;

  if (!hasSocialProvider) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {authProviders.github && <GithubButton />}
        {authProviders.google && <GoogleButton />}
      </div>
      {authProviders.credentials && <div className="divider">{t('or')}</div>}
    </>
  );
};

const AuthPortal = ({
  csrfToken,
  authProviders,
  recaptchaSiteKey,
  initialTab,
  onboardingBlueprint,
}: AuthPortalProps) => {
  const router = useRouter();
  const { status } = useSession();
  const { t } = useTranslation('common');
  const { token, error, success } = router.query as {
    token?: string;
    error?: string;
    success?: string;
    callbackUrl?: string;
  };
  const callbackUrl =
    typeof router.query.callbackUrl === 'string'
      ? router.query.callbackUrl
      : undefined;
  const isSignup = initialTab === 'signup';
  const authenticatedDestination = safeCallbackUrl(
    callbackUrl,
    onboardingBlueprint ? '/onboarding' : env.redirectIfAuthenticated
  );

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(authenticatedDestination);
    }
  }, [authenticatedDestination, router, status]);

  if (status === 'loading' || status === 'authenticated') {
    return <Loading />;
  }

  const preservedQuery = new URLSearchParams();
  if (token) preservedQuery.set('token', token);
  if (callbackUrl) preservedQuery.set('callbackUrl', callbackUrl);
  const query = preservedQuery.toString()
    ? `&${preservedQuery.toString()}`
    : '';

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-ui-canvas px-4 py-16 text-ui-text sm:px-6">
      <ThemeToggle className="absolute right-4 top-4 sm:right-6 sm:top-6" />
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <ThemeLogo className="w-44" priority />
        </div>
        <div className="mt-8 border border-ui-border bg-ui-surface shadow-sm">
          <div
            className="grid grid-cols-2 border-b border-ui-border"
            role="tablist"
          >
            <Link
              href={`/?tab=login${query}`}
              role="tab"
              aria-selected={!isSignup}
              className={`px-4 py-4 text-center text-sm font-semibold ${
                !isSignup
                  ? 'border-b-2 border-tivmark-gold text-ui-heading'
                  : 'text-ui-muted hover:bg-ui-surface-muted hover:text-ui-heading'
              }`}
            >
              {t('sign-in')}
            </Link>
            <Link
              href={`/?tab=signup${query}`}
              role="tab"
              aria-selected={isSignup}
              className={`px-4 py-4 text-center text-sm font-semibold ${
                isSignup
                  ? 'border-b-2 border-tivmark-gold text-ui-heading'
                  : 'text-ui-muted hover:bg-ui-surface-muted hover:text-ui-heading'
              }`}
            >
              {t('create-account')}
            </Link>
          </div>

          <div className="p-5 sm:p-6">
            <h1 className="font-serif text-2xl text-ui-heading">
              {isSignup ? t('get-started') : t('welcome-back')}
            </h1>
            <p className="mt-1 mb-5 text-sm text-ui-muted">
              {isSignup ? t('create-a-new-account') : t('log-in-to-account')}
            </p>

            {(error || success) && (
              <Alert status={error ? 'error' : 'success'} className="mb-4">
                {t(error || success || '')}
              </Alert>
            )}

            {isSignup ? (
              token ? (
                <>
                  <SignupProviders authProviders={authProviders} />
                  <JoinWithInvitation
                    inviteToken={token}
                    recaptchaSiteKey={recaptchaSiteKey}
                  />
                </>
              ) : (
                <>
                  <SignupProviders authProviders={authProviders} />
                  <Join
                    recaptchaSiteKey={recaptchaSiteKey}
                    callbackUrl={callbackUrl}
                    onboardingBlueprint={onboardingBlueprint}
                  />
                </>
              )
            ) : (
              <LoginForm
                csrfToken={csrfToken}
                authProviders={authProviders}
                recaptchaSiteKey={recaptchaSiteKey}
                token={token}
                callbackUrl={callbackUrl}
              />
            )}
          </div>
        </div>
        <p className="mt-5 text-center text-sm text-ui-muted">
          <a
            href="https://tivmark.com"
            className="font-medium text-ui-accent hover:text-ui-heading"
          >
            {t('back-to-tivmark')}
          </a>
        </p>
      </div>
    </main>
  );
};

export default AuthPortal;
