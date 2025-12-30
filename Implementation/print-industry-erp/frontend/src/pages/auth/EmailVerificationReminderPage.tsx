import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { apolloClient } from '../../graphql/client';
import { CUSTOMER_RESEND_VERIFICATION_EMAIL } from '../../graphql/mutations/auth';
import { useAuthStore } from '../../store/authStore';

export const EmailVerificationReminderPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const [isResending, setIsResending] = useState(false);

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

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <svg
              className="h-12 w-12 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {t('auth.verifyYourEmail', 'Verify Your Email')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t(
              'auth.verifyEmailMessage',
              'Please verify your email address to access the application.'
            )}
          </p>
          {user && (
            <p className="mt-2 text-sm font-medium text-gray-900">
              {user.email}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <button
            onClick={handleResendEmail}
            disabled={isResending}
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending
              ? t('auth.loading.sending', 'Sending...')
              : t('auth.resendVerificationEmail', 'Resend Verification Email')}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {t('auth.logout', 'Logout')}
          </button>
        </div>

        <div className="text-center text-sm text-gray-600">
          <p>
            {t(
              'auth.checkSpamFolder',
              "Didn't receive the email? Check your spam folder or contact support."
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
