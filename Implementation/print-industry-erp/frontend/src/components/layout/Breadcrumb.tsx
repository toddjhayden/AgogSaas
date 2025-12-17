import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Breadcrumb: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600">
      <Link to="/" className="hover:text-primary-600">
        Home
      </Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;

        return (
          <React.Fragment key={name}>
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="text-gray-900 font-medium capitalize">{name}</span>
            ) : (
              <Link to={routeTo} className="hover:text-primary-600 capitalize">
                {name}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
