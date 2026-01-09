import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMfaInput, setShowMfaInput] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; mfa?: string }>({});

  const from = (location.state as unknown)?.from || '/dashboard';

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = t('auth.validation.emailRequired', 'Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('auth.validation.emailInvalid', 'Please enter a valid email address');
    }

    if (!password) {
      newErrors.password = t('auth.validation.passwordRequired', 'Password is required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password, showMfaInput ? mfaCode : undefined);
      toast.success(t('auth.loginSuccess', 'Login successful'));
      navigate(from, { replace: true });
    } catch (error: unknown) {
      console.error('Login failed:', error);

      const errorMessage = error.message || '';

      if (errorMessage.includes('MFA')) {
        setShowMfaInput(true);
        setErrors({ mfa: t('auth.mfaRequired', 'Enter your MFA code') });
      } else if (errorMessage.includes('locked')) {
        toast.error(
          t(
            'auth.accountLocked',
            'Too many failed attempts. Account locked for 30 minutes.'
          )
        );
      } else if (errorMessage.includes('not verified')) {
        toast.error(
          t(
            'auth.emailNotVerified',
            'Please verify your email address. Check your inbox.'
          )
        );
      } else {
        toast.error(
          t('auth.loginFailed', 'Invalid email or password')
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('auth.login', 'Login')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth.loginSubtitle', 'Sign in to your account')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('auth.fields.email', 'Email Address')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                placeholder={t('auth.fields.email', 'Email Address')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('auth.fields.password', 'Password')}
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={`appearance-none relative block w-full px-3 py-2 border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                  placeholder={t('auth.fields.password', 'Password')}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  aria-required="true"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.password}
                </p>
              )}
            </div>

            {showMfaInput && (
              <div>
                <label htmlFor="mfa" className="block text-sm font-medium text-gray-700">
                  {t('auth.fields.mfaCode', 'MFA Code')}
                </label>
                <input
                  id="mfa"
                  name="mfa"
                  type="text"
                  maxLength={6}
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                    errors.mfa ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                  placeholder={t('auth.fields.mfaCode', 'MFA Code')}
                  value={mfaCode}
                  onChange={(e) => {
                    setMfaCode(e.target.value);
                    setErrors((prev) => ({ ...prev, mfa: undefined }));
                  }}
                />
                {errors.mfa && (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {errors.mfa}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                {t('auth.forgotPassword', 'Forgot Password?')}
              </Link>
            </div>

            <div className="text-sm">
              <Link
                to="/register"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                {t('auth.createAccount', 'Create Account')}
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('auth.loading.loggingIn', 'Logging in...')}
                </span>
              ) : (
                t('auth.login', 'Login')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
