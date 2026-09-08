import Link from 'next/link';
import { Brand } from '@/components/brand';
import { Icon } from '@/components/icons';
import { SiteHeader } from '@/components/layout/site-header';
import { HeroOrbit } from '@/components/visual/hero-orbit';
import { Badge, SkillBadge, VerificationBadge } from '@/components/ui/badge';
import { FeatureCard, GlassCard, InteractiveCard } from '@/components/ui/card';

const audiences = [
  {
    icon: 'user' as const,
    number: '01',
    title: 'For people who make things happen.',
    body: 'Build a trusted, visible skills profile and find work that respects your craft.',
    action: 'Explore as a worker',
    href: '/register/worker',
    tags: ['Own your profile', 'Grow your skills'],
  },
  {
    icon: 'building' as const,
    number: '02',
    title: 'For cooperatives with a bigger horizon.',
    body: 'Give every member a stronger presence, clearer verification, and a shared path forward.',
    action: 'Build your cooperative',
    href: '/register/worker',
    tags: ['Coordinate talent', 'Elevate trust'],
  },
  {
    icon: 'compass' as const,
    number: '03',
    title: 'For customers who value good work.',
    body: 'Discover capable local professionals through a network built around accountability.',
    action: 'Find a service',
    href: '/register/customer',
    tags: ['Discover locally', 'Book with confidence'],
  },
];

const steps = [
  {
    number: '01',
    title: 'Join with intent',
    body: 'Create your account in a minute. Your mobile number becomes the key to your trusted identity.',
  },
  {
    number: '02',
    title: 'Make skills visible',
    body: 'Build a clear profile of the work you do, the strengths you bring, and the goals ahead.',
  },
  {
    number: '03',
    title: 'Move together',
    body: 'Discover people and opportunities through an ecosystem designed for shared progress.',
  },
];

export default function HomePage() {
  return (
    <main className="landing-page">
      <SiteHeader />
      <section className="landing-hero">
        <div className="hero-light hero-light--one" />
        <div className="hero-light hero-light--two" />
        <div className="landing-container landing-hero__grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow__pulse" />A new infrastructure for work
            </div>
            <h1>
              Better work has a <em>shared</em> future.
            </h1>
            <p>
              One trusted space for workers, cooperatives, and customers to turn skill into
              opportunity—and opportunity into lasting progress.
            </p>
            <div className="hero-copy__actions">
              <Link href="/register/worker" className="button button--primary button--lg">
                <span>Start your journey</span>
                <Icon name="arrow-right" />
              </Link>
              <a href="#how-it-works" className="button button--secondary button--lg">
                <span>See how it works</span>
              </a>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack" aria-hidden="true">
                <span>R</span>
                <span>S</span>
                <span>A</span>
                <span>+</span>
              </div>
              <p>
                <b>Built for the real economy.</b>
                <br />
                Where individual effort meets collective momentum.
              </p>
            </div>
          </div>
          <HeroOrbit />
        </div>
        <div className="hero-rule" />
      </section>
      <section className="landing-section landing-section--intro" id="ecosystem">
        <div className="landing-container section-heading">
          <div>
            <div className="eyebrow">One platform, many paths</div>
            <h2>There is more power in work when everyone can move forward.</h2>
          </div>
          <p>
            Sahakar connects the human side of services: proven capability, shared trust, and work
            that benefits the people behind it.
          </p>
        </div>
        <div className="landing-container audience-grid">
          {audiences.map((audience) => (
            <InteractiveCard key={audience.number} className="audience-card">
              <div className="audience-card__top">
                <span className="audience-card__number">{audience.number}</span>
                <span className="audience-card__icon">
                  <Icon name={audience.icon} />
                </span>
              </div>
              <h3>{audience.title}</h3>
              <p>{audience.body}</p>
              <div className="audience-card__tags">
                {audience.tags.map((tag) => (
                  <SkillBadge key={tag}>{tag}</SkillBadge>
                ))}
              </div>
              <Link href={audience.href} className="text-link">
                {audience.action}
                <Icon name="arrow-up-right" />
              </Link>
            </InteractiveCard>
          ))}
        </div>
      </section>
      <section className="landing-section trust-section" id="trust">
        <div className="landing-container trust-grid">
          <div className="trust-visual">
            <div className="trust-visual__card">
              <div className="trust-visual__card-head">
                <span className="mini-avatar">P</span>
                <div>
                  <b>Priya N.</b>
                  <small>Textile craftsperson</small>
                </div>
                <VerificationBadge />
              </div>
              <div className="skill-row">
                <span>Handloom weaving</span>
                <span>98%</span>
                <i>
                  <b />
                </i>
              </div>
              <div className="skill-row">
                <span>Natural dyes</span>
                <span>86%</span>
                <i>
                  <b />
                </i>
              </div>
              <div className="trust-visual__footer">
                <span>
                  <Icon name="shield" />
                  Identity protected
                </span>
                <span>
                  <Icon name="verify" />
                  Skills reviewed
                </span>
              </div>
            </div>
            <div className="trust-visual__beam" />
          </div>
          <div className="trust-copy">
            <div className="eyebrow">Trust, made tangible</div>
            <h2>Good work deserves a reputation that travels with it.</h2>
            <p>
              Profiles, verified skills, and cooperative context make it easier to see the people
              behind the service—and make more confident choices.
            </p>
            <ul className="check-list">
              <li>
                <Icon name="check" />
                Skills have a clear path to verification
              </li>
              <li>
                <Icon name="check" />
                People stay at the centre of every profile
              </li>
              <li>
                <Icon name="check" />
                Trust grows through a connected community
              </li>
            </ul>
            <Link href="/register/worker" className="text-link">
              Create your worker profile <Icon name="arrow-right" />
            </Link>
          </div>
        </div>
      </section>
      <section className="landing-section steps-section" id="how-it-works">
        <div className="landing-container">
          <div className="section-heading section-heading--center">
            <div>
              <div className="eyebrow">Simple by design</div>
              <h2>A clearer route from where you are to what is next.</h2>
            </div>
          </div>
          <div className="steps-grid">
            {steps.map((step) => (
              <FeatureCard key={step.number} className="step-card">
                <span>{step.number}</span>
                <div className="step-card__line" />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </FeatureCard>
            ))}
          </div>
        </div>
      </section>
      <section className="landing-section callout-section">
        <div className="landing-container">
          <GlassCard className="callout">
            <div>
              <Badge tone="cyan">
                <Icon name="sparkles" />
                The cooperative advantage
              </Badge>
              <h2>
                Individual talent.
                <br />
                <em>Shared possibility.</em>
              </h2>
              <p>Join the platform where progress is built with people, not around them.</p>
            </div>
            <Link href="/register/customer" className="button button--primary button--lg">
              <span>Enter sahakar</span>
              <Icon name="arrow-right" />
            </Link>
          </GlassCard>
        </div>
      </section>
      <footer className="landing-footer">
        <div className="landing-container landing-footer__inner">
          <Brand inverse />
          <p>Better work. Built together.</p>
          <div>
            <a href="#ecosystem">Ecosystem</a>
            <a href="#trust">Trust</a>
            <a href="/login">Sign in</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
