import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { apolloClient } from '../../graphql/client';
import { CUSTOMER_REQUEST_PASSWORD_RESET } from '../../graphql/mutations/auth';

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error(t('auth.validation.emailRequired', 'Email is required'));
      return;
    }

    setIsLoading(true);

    try {
      await apolloClient.mutate({
        mutation: CUSTOMER_REQUEST_PASSWORD_RESET,
        variables: { email },
      });

      setEmailSent(true);
      toast.success(
        t('auth.passwordResetSent', 'Password reset email sent. Check your inbox.')
      );
    } catch (error) {
      console.error('Password reset request failed:', error);
      toast.error(
        t('auth.passwordResetFailed', 'Failed to send password reset email')
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              {t('auth.checkYourEmail', 'Check Your Email')}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {t(
                'auth.passwordResetInstructions',
                'We have sent password reset instructions to your email address.'
              )}
            </p>
          </div>
          <div>
            <Link
              to="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              {t('auth.backToLogin', 'Back to Login')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('auth.forgotPassword', 'Forgot Password?')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t(
              'auth.forgotPasswordSubtitle',
              'Enter your email address and we will send you a password reset link'
            )}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t('auth.fields.email', 'Email Address')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder={t('auth.fields.email', 'Email Address')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? t('auth.loading.sending', 'Sending...')
                : t('auth.sendResetLink', 'Send Reset Link')}
            </button>
          </div>

          <div className="text-center text-sm">
            <Link
              to="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              {t('auth.backToLogin', 'Back to Login')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
