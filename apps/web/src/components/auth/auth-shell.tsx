import Link from 'next/link';
import { Brand } from '@/components/brand';
import { Icon } from '@/components/icons';

export function AuthShell({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: 'login' | 'customer' | 'worker';
}) {
  const supporting =
    mode === 'worker'
      ? {
          overline: 'Your craft, in focus',
          title: 'A stronger path for the people who make things happen.',
          copy: 'Bring your skills into a trusted ecosystem, with room to grow on your own terms.',
        }
      : mode === 'customer'
        ? {
            overline: 'Start with confidence',
            title: 'The thoughtful way to discover good work.',
            copy: 'Connect with a trusted network of capable people and cooperative talent.',
          }
        : {
            overline: 'Welcome back',
            title: 'Progress works better when it is shared.',
            copy: 'Step into your workspace and continue building the work that matters.',
          };
  return (
    <main className="auth-page">
      <div className="auth-page__ambient auth-page__ambient--one" />
      <div className="auth-page__ambient auth-page__ambient--two" />
      <header className="auth-header">
        <Brand />
        <Link href="/" className="back-link">
          <Icon name="arrow-right" className="back-link__icon" /> Back to home
        </Link>
      </header>
      <section className="auth-layout">
        <aside className="auth-aside">
          <div className="auth-aside__copy">
            <div className="eyebrow">
              <span className="eyebrow__pulse" />
              {supporting.overline}
            </div>
            <h1>{supporting.title}</h1>
            <p>{supporting.copy}</p>
          </div>
          <div className="auth-aside__network">
            <div className="network-orbit">
              <span className="network-node network-node--a">
                <Icon name="user" />
              </span>
              <span className="network-node network-node--b">
                <Icon name="briefcase" />
              </span>
              <span className="network-node network-node--c">
                <Icon name="building" />
              </span>
              <div className="network-orbit__core">
                <span className="brand__mark">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
            <div className="auth-aside__promise">
              <Icon name="shield" />
              <span>
                <b>Your data stays yours.</b>
                <br />
                Secure, human-centred access.
              </span>
            </div>
          </div>
        </aside>
        <div className="auth-card-wrap">{children}</div>
      </section>
    </main>
  );
}
