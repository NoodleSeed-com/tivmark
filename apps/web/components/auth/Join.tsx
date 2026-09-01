import { useState, useRef } from 'react';
import { InputWithLabel } from '@/components/shared';
import { defaultHeaders, passwordPolicies } from '@/lib/common';
import { useFormik } from 'formik';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { Button } from 'react-daisyui';
import toast from 'react-hot-toast';
import type { ApiResponse } from 'types';
import * as Yup from 'yup';
import TogglePasswordVisibility from '../shared/TogglePasswordVisibility';
import AgreeMessage from './AgreeMessage';
import GoogleReCAPTCHA from '../shared/GoogleReCAPTCHA';
import ReCAPTCHA from 'react-google-recaptcha';
import { maxLengthPolicies } from '@/lib/common';
import { safeCallbackUrl, type OnboardingBlueprint } from '@/lib/onboarding';

interface JoinProps {
  recaptchaSiteKey: string | null;
  callbackUrl?: string;
  onboardingBlueprint?: OnboardingBlueprint;
}

const JoinUserSchema = Yup.object().shape({
  name: Yup.string().required().max(maxLengthPolicies.name),
  email: Yup.string().required().email().max(maxLengthPolicies.email),
  password: Yup.string()
    .required()
    .min(passwordPolicies.minLength)
    .max(maxLengthPolicies.password),
  team: Yup.string().required().min(3).max(maxLengthPolicies.team),
});

const Join = ({
  recaptchaSiteKey,
  callbackUrl,
  onboardingBlueprint,
}: JoinProps) => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string>('');
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const handlePasswordVisibility = () => {
    setIsPasswordVisible((prev) => !prev);
  };

  const formik = useFormik({
    initialValues: {
      name: '',
      email: '',
      password: '',
      team: onboardingBlueprint?.businessName ?? '',
    },
    validationSchema: JoinUserSchema,
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: async (values) => {
      const response = await fetch('/api/auth/join', {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({
          ...values,
          recaptchaToken,
        }),
      });

      const json = (await response.json()) as ApiResponse<{
        confirmEmail: boolean;
      }>;

      recaptchaRef.current?.reset();

      if (!response.ok) {
        toast.error(json.error.message);
        return;
      }

      if (json.data.confirmEmail) {
        router.push('/auth/verify-email');
        return;
      }

      toast.success(t('successfully-joined'));
      const destination = safeCallbackUrl(
        callbackUrl,
        onboardingBlueprint ? '/onboarding' : '/dashboard'
      );

      // Production's demo configuration has no CAPTCHA ceremony, so the owner can move
      // directly from account creation into the authenticated continuation. When CAPTCHA
      // is enabled, its token may be single-use; send the user through the normal login
      // instead of attempting an unreliable second verification with the spent token.
      if (onboardingBlueprint && !recaptchaSiteKey) {
        const signedIn = await signIn('credentials', {
          email: values.email,
          password: values.password,
          redirect: false,
          callbackUrl: destination,
        });
        if (signedIn?.ok) {
          window.location.assign(signedIn.url || destination);
          return;
        }
      }

      const params = new URLSearchParams({
        tab: 'login',
        success: 'successfully-joined',
        callbackUrl: destination,
      });
      router.push(`/?${params.toString()}`);
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      <div className="space-y-1">
        <InputWithLabel
          type="text"
          autoComplete="name"
          label={t('name')}
          name="name"
          placeholder={t('your-name')}
          value={formik.values.name}
          error={formik.touched.name ? formik.errors.name : undefined}
          onChange={formik.handleChange}
        />
        <InputWithLabel
          type="text"
          autoComplete="organization"
          label={t('company-name')}
          name="team"
          placeholder={t('company-name')}
          value={formik.values.team}
          error={formik.errors.team}
          onChange={formik.handleChange}
          readOnly={Boolean(onboardingBlueprint)}
        />
        {onboardingBlueprint ? (
          <p className="text-xs text-ui-muted">
            {t('onboarding-blueprint-loaded')}
          </p>
        ) : null}
        <InputWithLabel
          type="email"
          autoComplete="email"
          label={t('email')}
          name="email"
          placeholder={t('email-placeholder')}
          value={formik.values.email}
          error={formik.errors.email}
          onChange={formik.handleChange}
        />
        <div className="relative flex">
          <InputWithLabel
            type={isPasswordVisible ? 'text' : 'password'}
            autoComplete="new-password"
            label={t('password')}
            name="password"
            placeholder={t('password')}
            value={formik.values.password}
            error={formik.errors.password}
            onChange={formik.handleChange}
          />
          <TogglePasswordVisibility
            isPasswordVisible={isPasswordVisible}
            handlePasswordVisibility={handlePasswordVisibility}
          />
        </div>
        <GoogleReCAPTCHA
          recaptchaRef={recaptchaRef}
          onChange={setRecaptchaToken}
          siteKey={recaptchaSiteKey}
        />
      </div>
      <div className="mt-3 space-y-3">
        <Button
          type="submit"
          color="primary"
          loading={formik.isSubmitting}
          active={formik.dirty}
          fullWidth
          size="md"
        >
          {t('create-account')}
        </Button>
        <AgreeMessage text={t('create-account')} />
      </div>
    </form>
  );
};

export default Join;
