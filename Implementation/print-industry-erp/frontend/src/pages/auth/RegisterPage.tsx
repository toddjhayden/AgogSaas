import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

export const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const [formData, setFormData] = useState({
    customerCode: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    acceptTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, _setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const passwordStrength = (password: string): { strength: string; color: string; width: string } => {
    if (!password) return { strength: '', color: '', width: '0%' };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength: t('auth.passwordStrength.weak', 'Weak'), color: 'bg-red-500', width: '33%' };
    if (strength <= 4) return { strength: t('auth.passwordStrength.medium', 'Medium'), color: 'bg-yellow-500', width: '66%' };
    return { strength: t('auth.passwordStrength.strong', 'Strong'), color: 'bg-green-500', width: '100%' };
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.customerCode) {
      newErrors.customerCode = t('auth.validation.customerCodeRequired', 'Customer code is required');
    }

    if (!formData.email) {
      newErrors.email = t('auth.validation.emailRequired', 'Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('auth.validation.emailInvalid', 'Please enter a valid email address');
    }

    if (!formData.password) {
      newErrors.password = t('auth.validation.passwordRequired', 'Password is required');
    } else if (formData.password.length < 8) {
      newErrors.password = t('auth.validation.passwordTooShort', 'Password must be at least 8 characters');
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = t('auth.validation.passwordUppercase', 'Password must contain an uppercase letter');
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = t('auth.validation.passwordLowercase', 'Password must contain a lowercase letter');
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = t('auth.validation.passwordNumber', 'Password must contain a number');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.validation.passwordMismatch', 'Passwords do not match');
    }

    if (!formData.firstName) {
      newErrors.firstName = t('auth.validation.firstNameRequired', 'First name is required');
    }

    if (!formData.lastName) {
      newErrors.lastName = t('auth.validation.lastNameRequired', 'Last name is required');
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = t('auth.validation.acceptTerms', 'You must accept the terms of service');
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
      await register({
        customerCode: formData.customerCode,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      toast.success(
        t(
          'auth.registerSuccess',
          'Registration successful. Please check your email to verify your account.'
        )
      );
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Registration failed:', error);

      const errorMessage = error.message || '';

      if (errorMessage.includes('already exists')) {
        toast.error(t('auth.emailExists', 'An account with this email already exists'));
      } else if (errorMessage.includes('invalid customer code')) {
        toast.error(t('auth.invalidCustomerCode', 'Invalid customer code'));
      } else {
        toast.error(t('auth.registerFailed', 'Registration failed. Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  };

  const strength = passwordStrength(formData.password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('auth.register', 'Register')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth.registerSubtitle', 'Create your account')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Customer Code */}
            <div>
              <label htmlFor="customerCode" className="block text-sm font-medium text-gray-700">
                {t('auth.fields.customerCode', 'Customer Code')}
              </label>
              <input
                id="customerCode"
                name="customerCode"
                type="text"
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  errors.customerCode ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                value={formData.customerCode}
                onChange={(e) => handleChange('customerCode', e.target.value)}
              />
              {errors.customerCode && (
                <p className="mt-1 text-sm text-red-600">{errors.customerCode}</p>
              )}
            </div>

            {/* Email */}
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
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                {t('auth.fields.firstName', 'First Name')}
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  errors.firstName ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                {t('auth.fields.lastName', 'Last Name')}
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  errors.lastName ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('auth.fields.password', 'Password')}
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className={`appearance-none relative block w-full px-3 py-2 border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {/* Eye icon */}
                </button>
              </div>
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>{t('auth.passwordStrength.label', 'Password strength')}:</span>
                    <span className="font-medium">{strength.strength}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${strength.color}`}
                      style={{ width: strength.width }}
                    ></div>
                  </div>
                </div>
              )}
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                {t('auth.fields.confirmPassword', 'Confirm Password')}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms of Service */}
            <div className="flex items-start">
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={formData.acceptTerms}
                onChange={(e) => handleChange('acceptTerms', e.target.checked)}
              />
              <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-900">
                {t('auth.acceptTerms', 'I accept the')}{' '}
                <a href="#" className="text-indigo-600 hover:text-indigo-500">
                  {t('auth.termsOfService', 'Terms of Service')}
                </a>
              </label>
            </div>
            {errors.acceptTerms && (
              <p className="text-sm text-red-600">{errors.acceptTerms}</p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t('auth.loading.registering', 'Creating account...') : t('auth.register', 'Register')}
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-600">{t('auth.alreadyHaveAccount', 'Already have an account?')}</span>{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              {t('auth.login', 'Login')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
