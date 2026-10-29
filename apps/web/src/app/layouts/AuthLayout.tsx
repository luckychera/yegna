import { ShieldCheck, Sprout, Users, Landmark } from 'lucide-react';
import { Link, Outlet } from 'react-router';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useI18n } from '@/i18n/I18nProvider';

const POINTS = [
  { icon: ShieldCheck, key: 'brand.secure' },
  { icon: Landmark, key: 'brand.transparent' },
  { icon: Users, key: 'brand.communityDriven' },
  { icon: Sprout, key: 'brand.builtForEthiopia' },
] as const;

export function AuthLayout() {
  const { t } = useI18n();

  return (
    <div className="relative grid min-h-dvh overflow-hidden bg-surface lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Shared background: includes the curved divider */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-cover bg-center bg-no-repeat lg:block"
        style={{ backgroundImage: "url('/images/auth-background.png')" }}
      />

      {/* Left branding panel */}
      <aside className="relative z-10 hidden flex-col justify-between p-12 text-white lg:flex">
        <div className="flex items-start justify-between gap-4">
          <BrandLogo tone="light" size="lg" />
          <LanguageSwitcher />
        </div>

        <div className="space-y-6">
          <h2 className="max-w-sm text-h1 font-bold">
            {t('brand.tagline')}
          </h2>

          <p className="max-w-sm text-body text-white/75">
            {t('brand.description')}
          </p>

          <ul className="space-y-3">
            {POINTS.map(({ icon: Icon, key }) => (
              <li
                key={key}
                className="flex items-center gap-3 text-body font-medium"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-small text-white/70">{t('brand.footer')}</p>
      </aside>

      {/* Auth form */}
      <main className="relative z-10 flex items-center justify-center px-4 py-10 sm:px-8 lg:bg-transparent">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" aria-label="Yegna home">
              <BrandLogo size="md" />
            </Link>
            <LanguageSwitcher />
          </div>

          <Outlet />
        </div>
      </main>
    </div>
  );
}

