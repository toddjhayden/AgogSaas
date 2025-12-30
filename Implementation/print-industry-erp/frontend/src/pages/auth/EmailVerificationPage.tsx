import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { apolloClient } from '../../graphql/client';
import { CUSTOMER_VERIFY_EMAIL, CUSTOMER_RESEND_VERIFICATION_EMAIL } from '../../graphql/mutations/auth';

export const EmailVerificationPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token?: string }>();

  const [verificationStatus, setVerificationStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setVerificationStatus('error');
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      await apolloClient.mutate({
        mutation: CUSTOMER_VERIFY_EMAIL,
        variables: { token: verificationToken },
      });

      setVerificationStatus('success');
      toast.success(t('auth.emailVerified', 'Email verified successfully'));
    } catch (error) {
      console.error('Email verification failed:', error);
      setVerificationStatus('error');
      toast.error(t('auth.emailVerificationFailed', 'Email verification failed'));
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);

    try {
      await apolloClient.mutate({
        mutation: CUSTOMER_RESEND_VERIFICATION_EMAIL,
      });

      toast.success(
        t('auth.verificationEmailResent', 'Verification email sent. Check your inbox.')
      );
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      toast.error(t('auth.resendEmailFailed', 'Failed to resend verification email'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {verificationStatus === 'verifying' && (
            <>
              <div className="flex justify-center">
                <svg
                  className="animate-spin h-12 w-12 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                {t('auth.loading.verifying', 'Verifying email...')}
              </h2>
            </>
          )}

          {verificationStatus === 'success' && (
            <>
              <div className="flex justify-center">
                <svg
                  className="h-12 w-12 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                {t('auth.emailVerified', 'Email Verified')}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {t('auth.emailVerifiedMessage', 'Your email has been successfully verified. You can now login.')}
              </p>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {t('auth.goToLogin', 'Go to Login')}
                </Link>
              </div>
            </>
          )}

          {verificationStatus === 'error' && (
            <>
              <div className="flex justify-center">
                <svg
                  className="h-12 w-12 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                {t('auth.verificationFailed', 'Verification Failed')}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {t(
                  'auth.verificationFailedMessage',
                  'The verification link is invalid or has expired.'
                )}
              </p>
              <div className="mt-6 space-y-3">
                <button
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending
                    ? t('auth.loading.sending', 'Sending...')
                    : t('auth.resendVerificationEmail', 'Resend Verification Email')}
                </button>
                <div>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    {t('auth.backToLogin', 'Back to Login')}
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
