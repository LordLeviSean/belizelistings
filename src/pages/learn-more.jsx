import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  Calendar,
  Heart,
  Inbox,
  Map,
  MapPin,
  MessageSquare,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import SiteNav from "@/components/SiteNav";
import BackButton from "@/components/BackButton";
import styles from "@/styles/LearnMore.module.css";

const WHY_FOCUS = [
  "clarity",
  "trust",
  "verification",
  "simplicity",
  "making property easier to discover",
];

const CAPABILITIES = [
  { icon: BadgeCheck, label: "Browse verified listings" },
  { icon: Map, label: "Explore Belize using the interactive national property map" },
  { icon: MapPin, label: "Search by district" },
  { icon: Users, label: "Contact listing agents" },
  { icon: Calendar, label: "Schedule property viewings" },
  { icon: Heart, label: "Save favorites" },
  { icon: UserPlus, label: "Create a free account" },
  { icon: Inbox, label: "Receive inquiries" },
  { icon: Building2, label: "Manage listings" },
  { icon: Shield, label: "View listing verification history" },
  { icon: MessageSquare, label: "Secure buyer-owner messaging" },
];

const DIFFERENTIATORS = [
  {
    title: "Interactive Property Map",
    body: "Explore Belize visually instead of scrolling endless property lists.",
  },
  {
    title: "Verified Listings",
    body: "Verification helps create greater confidence between buyers and sellers.",
  },
  {
    title: "Built Around Real Professionals",
    body: "Designed to work alongside Belize's real estate professionals—not replace them.",
  },
  {
    title: "Belize First",
    body: "Every feature is designed specifically around Belize's property market.",
  },
];

const BETA_IMPROVEMENTS = [
  "interface improvements",
  "new features",
  "performance updates",
  "expanded verification tools",
  "additional marketplace capabilities",
];

const ROAD_AHEAD = [
  "Advanced property management",
  "Agent business tools",
  "Market insights",
  "Saved searches",
  "Smart alerts",
  "Enhanced messaging",
  "Viewing management",
  "Professional analytics",
  "Additional verification features",
  "Mobile improvements",
  "Performance enhancements",
];

const TRUST_VALUES = [
  "verification",
  "professionalism",
  "clarity",
  "transparency",
  "long-term reliability",
  "community trust",
];

const MEMBERSHIP_TIERS = [
  {
    name: "Free",
    status: "Available now",
    statusClass: "tierStatusAvailable",
    description: "Perfect for buyers, renters, and occasional property owners.",
    features: [
      "Create an account",
      "Browse listings",
      "Save favorites",
      "Contact agents",
      "Manage basic listings",
    ],
  },
  {
    name: "Professional",
    status: "Planned",
    statusClass: "",
    description: "Designed for active agents and property owners.",
    features: [
      "Higher listing limits",
      "Professional dashboard tools",
      "Advanced inquiry management",
      "Viewing management",
      "Listing performance insights",
      "Enhanced branding",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    status: "Future",
    statusClass: "",
    description: "Built for agencies, brokerages, and larger organizations.",
    features: [
      "Team management",
      "Brokerage tools",
      "Shared dashboards",
      "Enterprise reporting",
      "Additional administrative controls",
    ],
  },
];

function CtaPair({ className = "" }) {
  return (
    <div className={`${styles.heroActions} ${className}`.trim()}>
      <Link href="/login?signup=1" className={styles.primaryBtn}>
        Create Free Account
      </Link>
      <Link href="/" className={styles.secondaryBtn}>
        Explore the Map
      </Link>
    </div>
  );
}

export default function LearnMorePage() {
  return (
    <div className={styles.page}>
      <SiteNav active="browse" />

      <div className={styles.wrapper}>
        <BackButton label="Back" className={styles.backButton} />

        <section className={styles.section} aria-labelledby="learn-hero-title">
          <div className={styles.hero}>
            <div className={styles.heroInner}>
              <span className={styles.betaBadge}>Open Beta</span>
              <h1 id="learn-hero-title" className={styles.heroTitle}>
                Built for Belize.
              </h1>
              <p className={styles.heroCopy}>
                BelizeListings is a modern property marketplace designed specifically for Belize.
              </p>
              <p className={styles.heroCopy}>
                Our mission is to create one trusted place where buyers, renters, property owners,
                and real estate professionals can confidently connect.
              </p>
              <CtaPair />
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="why-title">
          <p className={styles.sectionKicker}>Our purpose</p>
          <h2 id="why-title" className={styles.sectionTitle}>
            Why We Built BelizeListings
          </h2>
          <p className={styles.sectionLead}>
            Finding property in Belize has traditionally meant searching across social media posts,
            scattered listings, and word of mouth.
          </p>
          <p className={styles.sectionLead}>
            BelizeListings brings everything together into one modern marketplace designed
            specifically for Belize.
          </p>
          <p className={styles.sectionLead}>Every design decision is focused on:</p>
          <ul className={styles.bulletList}>
            {WHY_FOCUS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="capabilities-title">
          <p className={styles.sectionKicker}>Today</p>
          <h2 id="capabilities-title" className={styles.sectionTitle}>
            What You Can Do Today
          </h2>
          <div className={styles.capabilityGrid}>
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <div key={label} className={styles.capabilityItem}>
                <span className={styles.capabilityIcon} aria-hidden>
                  <Icon size={15} strokeWidth={2.2} />
                </span>
                <p className={styles.capabilityText}>{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="different-title">
          <p className={styles.sectionKicker}>Differentiators</p>
          <h2 id="different-title" className={styles.sectionTitle}>
            What Makes BelizeListings Different
          </h2>
          <div className={styles.differentiatorGrid}>
            {DIFFERENTIATORS.map(({ title, body }) => (
              <article key={title} className={`${styles.glassCard} ${styles.diffCard}`}>
                <h3 className={styles.diffCardTitle}>{title}</h3>
                <p className={styles.diffCardBody}>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="beta-title">
          <span className={styles.betaBadge}>Open Beta</span>
          <h2 id="beta-title" className={styles.sectionTitle}>
            Open Beta
          </h2>
          <div className={`${styles.glassCard} ${styles.betaPanel}`}>
            <p className={styles.sectionLead}>
              BelizeListings is fully functional today and available for public use.
            </p>
            <p className={styles.sectionLead}>
              We&apos;re continuing to improve the platform through regular updates and community
              feedback.
            </p>
            <p className={styles.sectionLead}>During Open Beta you may notice:</p>
            <ul className={styles.bulletList}>
              {BETA_IMPROVEMENTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className={styles.sectionLead}>
              We believe the best products are built alongside the people who use them.
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="road-title">
          <p className={styles.sectionKicker}>Looking forward</p>
          <h2 id="road-title" className={styles.sectionTitle}>
            The Road Ahead
          </h2>
          <p className={styles.sectionLead}>
            Planned improvements — no fixed dates, but direction you can count on:
          </p>
          <ul className={styles.bulletList}>
            {ROAD_AHEAD.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className={styles.sectionLead}>
            Development is ongoing, and priorities may evolve based on user feedback.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="membership-title">
          <p className={styles.sectionKicker}>Membership direction</p>
          <h2 id="membership-title" className={styles.sectionTitle}>
            Memberships
          </h2>
          <p className={styles.membershipIntro}>
            BelizeListings will always offer a free way to participate, while additional
            professional tools will become available over time.
          </p>
          <div className={styles.tierGrid}>
            {MEMBERSHIP_TIERS.map(({ name, status, statusClass, description, features }) => (
              <article key={name} className={`${styles.glassCard} ${styles.tierCard}`}>
                <div className={styles.tierHeader}>
                  <h3 className={styles.tierName}>{name}</h3>
                  <span
                    className={`${styles.tierStatus} ${statusClass ? styles[statusClass] : ""}`.trim()}
                  >
                    {status}
                  </span>
                </div>
                <p className={styles.tierDesc}>{description}</p>
                <ul className={styles.tierList}>
                  {features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="trust-title">
          <p className={styles.sectionKicker}>Values</p>
          <h2 id="trust-title" className={styles.sectionTitle}>
            Built With Trust
          </h2>
          <p className={styles.sectionLead}>
            BelizeListings values quality over quantity. The platform is designed to earn confidence
            through steady, transparent work — not exaggerated promises.
          </p>
          <div className={styles.trustGrid}>
            {TRUST_VALUES.map((value) => (
              <div key={value} className={styles.trustPill}>
                {value}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="together-title">
          <p className={styles.sectionKicker}>Community</p>
          <h2 id="together-title" className={styles.sectionTitle}>
            Building Belize&apos;s Property Marketplace Together
          </h2>
          <div className={`${styles.glassCard} ${styles.closingNote}`}>
            <p>BelizeListings is still growing.</p>
            <p>
              Every listing, every piece of feedback, and every new member helps shape the future of
              the platform.
            </p>
            <p>Thank you for being part of that journey.</p>
          </div>
        </section>

        <section className={styles.finalCta} aria-label="Get started">
          <div className={styles.heroInner}>
            <h2 className={styles.heroTitle}>Ready to explore?</h2>
            <p className={styles.heroCopy}>
              Create a free account or start with the map — Belize property discovery, unified.
            </p>
            <CtaPair />
          </div>
        </section>
      </div>
    </div>
  );
}
