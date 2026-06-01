import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Zap,
  Video,
  Calendar,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Instagram,
  Linkedin,
  Facebook,
  Youtube,
  Twitter,
  Menu,
  X,
  Sparkles,
  Send,
  Play,
} from "lucide-react";

const navItems = [
  { label: "Features", target: "features" },
  { label: "How it works", target: "how-it-works" },
  { label: "Pricing", target: "pricing" },
];

const scrollToSection = (target) => {
  document.getElementById(target)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

const FloatingIcon = ({ children, delay, x, y }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{
      opacity: 1,
      scale: 1,
      y: [0, -20, 0],
    }}
    transition={{
      delay,
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
    }}
    className="absolute hidden p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl lg:block"
    style={{ left: x, top: y }}
  >
    {children}
  </motion.div>
);

const headlineWords = ["Automate", "Your", "Socials"];

const campaignPosts = [
  {
    platform: "Instagram",
    time: "09:30",
    title: "Launch reel",
    color: "from-pink-500 to-amber-400",
    icon: <Instagram size={18} />,
  },
  {
    platform: "LinkedIn",
    time: "12:00",
    title: "Founder post",
    color: "from-sky-500 to-blue-700",
    icon: <Linkedin size={18} />,
  },
  {
    platform: "YouTube",
    time: "18:45",
    title: "Short teaser",
    color: "from-red-500 to-rose-700",
    icon: <Youtube size={18} />,
  },
];

const stats = [
  { label: "Users", value: 10, suffix: "K+" },
  { label: "Posts Generated", value: 500, suffix: "K+" },
  { label: "Videos Created", value: 50, suffix: "K+" },
  { label: "Time Saved", value: 80, suffix: "%" },
];

const StatsCounter = ({ value, suffix, delay = 0 }) => {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const counterRef = useRef(null);
  const frameRef = useRef();

  useEffect(() => {
    const node = counterRef.current;
    if (!node) return undefined;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const runCounter = () => {
      if (hasAnimated) return;

      if (prefersReducedMotion) {
        setCount(value);
        setHasAnimated(true);
        return;
      }

      const duration = 1300;
      const startTime = performance.now() + delay;

      const animate = (now) => {
        if (now < startTime) {
          frameRef.current = requestAnimationFrame(animate);
          return;
        }

        const progress = Math.min((now - startTime) / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        setCount(Math.round(value * easedProgress));

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        } else {
          setHasAnimated(true);
        }
      };

      frameRef.current = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          runCounter();
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.45 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [delay, hasAnimated, value]);

  return (
    <span ref={counterRef}>
      {count}
      {suffix}
    </span>
  );
};

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavClick = (target) => {
    scrollToSection(target);
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0B14] text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="relative z-40 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-600/20">
            S
          </div>
          <span className="text-xl font-bold tracking-tight">
            Socialoraa
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-gray-400 font-medium">
          {navItems.map((item) => (
            <button
              key={item.target}
              type="button"
              onClick={() => handleNavClick(item.target)}
              className="group relative py-2 hover:text-white transition-colors"
            >
              {item.label}
              <span className="absolute inset-x-0 -bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-blue-400 transition-transform duration-300 group-hover:scale-x-100" />
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-4">
          <a
            href="/account/signin"
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Login
          </a>
          <a
            href="/account/signup"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-full font-semibold transition-all shadow-lg shadow-blue-600/20"
          >
            Get Started
          </a>
        </div>
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="md:hidden w-11 h-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white transition-colors hover:bg-white/10"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isMenuOpen ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <X size={22} />
              </motion.span>
            ) : (
              <motion.span
                key="menu"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Menu size={22} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute left-4 right-4 top-[86px] md:hidden rounded-2xl border border-white/10 bg-[#10111d]/95 p-3 shadow-2xl shadow-blue-950/40 backdrop-blur-xl"
            >
              {navItems.map((item, index) => (
                <motion.button
                  key={item.target}
                  type="button"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06 }}
                  onClick={() => handleNavClick(item.target)}
                  className="w-full rounded-xl px-4 py-3 text-left font-semibold text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </motion.button>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <a
                  href="/account/signin"
                  className="rounded-xl px-4 py-3 text-center font-semibold text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Login
                </a>
                <a
                  href="/account/signup"
                  className="rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
                >
                  Start
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="hero-aurora relative px-6 pb-32 pt-20 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="hero-grid absolute inset-0 opacity-40" />
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <div className="hero-orb hero-orb-three" />
          <div className="hero-scanline" />
        </div>

        <motion.div
          className="relative z-10 mx-auto max-w-7xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.span
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-sm font-medium bg-blue-500/10 text-blue-300 rounded-full border border-blue-500/20 shadow-lg shadow-blue-500/10 backdrop-blur"
          >
            <Sparkles size={16} className="text-cyan-300" />
            Powered by GPT-4 & Gemini Pro
          </motion.span>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            <span className="inline-flex flex-wrap justify-center gap-x-4 gap-y-1">
              {headlineWords.map((word, index) => (
                <motion.span
                  key={word}
                  initial={{ opacity: 0, y: 34, filter: "blur(12px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{
                    delay: 0.1 + index * 0.12,
                    duration: 0.7,
                    ease: "easeOut",
                  }}
                  className="inline-block"
                >
                  {word}
                </motion.span>
              ))}
            </span>
            <br />
            <motion.span
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.8, ease: "easeOut" }}
              className="hero-gradient-text inline-block text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400"
            >
              With AI Intelligence
            </motion.span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.62, duration: 0.65 }}
            className="text-xl text-gray-300/85 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            The all-in-one SaaS platform to generate, schedule, and analyze your
            social media content. Build your brand 10x faster with AI.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.78, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="/account/signup"
              className="group w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30"
            >
              Start Building Now
              <ArrowRight
                size={20}
                className="transition-transform group-hover:translate-x-1"
              />
            </a>
            <button className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 rounded-full font-bold text-lg transition-all border border-white/10 backdrop-blur-sm">
              Watch Demo
            </button>
          </motion.div>
        </motion.div>

        {/* Floating Icons Visualization */}
        <div className="relative z-10 mx-auto mt-20 h-[560px] max-w-7xl lg:block">
          <FloatingIcon delay={0} x="10%" y="10%">
            <Instagram className="text-pink-500" />
          </FloatingIcon>
          <FloatingIcon delay={0.5} x="85%" y="15%">
            <Linkedin className="text-blue-500" />
          </FloatingIcon>
          <FloatingIcon delay={1} x="20%" y="60%">
            <Facebook className="text-blue-600" />
          </FloatingIcon>
          <FloatingIcon delay={1.5} x="75%" y="65%">
            <Youtube className="text-red-500" />
          </FloatingIcon>
          <FloatingIcon delay={2} x="45%" y="40%">
            <Twitter className="text-blue-400" />
          </FloatingIcon>

          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 34 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
            whileHover={{ y: -10, rotateX: 2, rotateY: -2 }}
            className="w-full max-w-5xl mx-auto bg-gradient-to-b from-white/20 to-blue-500/10 p-[1px] rounded-3xl"
          >
            <div className="preview-stage bg-[#0A0B14] rounded-[23px] overflow-hidden shadow-2xl shadow-blue-950/40 border border-white/5 h-[500px] relative">
              <img
                src="/social-platform-preview.png"
                alt="Social media platform preview"
                className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-screen"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.26),transparent_32%),radial-gradient(circle_at_70%_35%,rgba(236,72,153,0.24),transparent_34%),linear-gradient(135deg,rgba(5,7,18,0.82),rgba(10,11,20,0.54)_48%,rgba(5,7,18,0.88))]" />
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.82, duration: 0.7, ease: "easeOut" }}
                className="absolute bottom-6 right-8 z-30 hidden w-[260px] overflow-hidden rounded-[1.5rem] border border-white/15 bg-black/45 p-2.5 text-left shadow-2xl shadow-blue-950/40 backdrop-blur-lg lg:block"
              >
                <div className="relative aspect-video overflow-hidden rounded-[1.45rem] bg-gradient-to-br from-slate-950 via-blue-950 to-fuchsia-950">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(255,255,255,0.2),transparent_28%),radial-gradient(circle_at_70%_70%,rgba(34,211,238,0.22),transparent_34%)]" />
                  <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-xs font-bold text-white/85 backdrop-blur">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    Reel preview
                  </div>
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-red-600 shadow-2xl shadow-red-500/25">
                      <Play fill="currentColor" size={24} />
                    </div>
                  </div>
                </div>
                <div className="px-2 pt-3">
                  <div className="text-sm font-bold text-white">
                    Summer launch campaign
                  </div>
                  <div className="mt-1 text-xs text-blue-100/65">
                    3 channels scheduled from one AI brief
                  </div>
                </div>
              </motion.div>
              <div className="relative z-10 h-full p-8">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <div className="rounded-full border border-white/15 bg-black/30 px-4 py-1 text-xs font-semibold text-blue-100 backdrop-blur">
                    Live campaign studio
                  </div>
                </div>
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.95, duration: 0.65 }}
                  className="absolute right-8 top-16 hidden w-[250px] rounded-3xl border border-white/15 bg-black/45 p-4 text-left shadow-2xl shadow-black/25 backdrop-blur-md lg:block"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">
                        Channel mix
                      </div>
                      <div className="text-xs text-blue-100/60">
                        This week
                      </div>
                    </div>
                    <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-100">
                      +32%
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      ["Instagram", "78%"],
                      ["LinkedIn", "62%"],
                      ["YouTube", "54%"],
                    ].map(([label, width]) => (
                      <div key={label}>
                        <div className="mb-1 flex justify-between text-xs text-blue-100/70">
                          <span>{label}</span>
                          <span>{width}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width }}
                            transition={{ delay: 1.1, duration: 0.9 }}
                            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.05, duration: 0.65 }}
                  className="mt-8 w-full rounded-2xl border border-white/15 bg-black/50 p-5 text-left shadow-2xl shadow-black/30 backdrop-blur-md lg:absolute lg:bottom-8 lg:left-[300px] lg:mt-0 lg:w-[420px]"
                >
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-100">
                    <Sparkles size={18} className="text-blue-300" />
                    AI has drafted your next 7-day launch calendar.
                  </div>
                  <div className="mb-4 h-2 w-full rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: "18%" }}
                      animate={{ width: "84%" }}
                      transition={{
                        delay: 1.25,
                        duration: 1.2,
                        ease: "easeOut",
                      }}
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-fuchsia-400"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-300">
                      Instagram, YouTube, LinkedIn and TikTok ready to publish
                    </span>
                    <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-transform hover:scale-105">
                      <Send size={17} />
                    </button>
                  </div>
                </motion.div>
              </div>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.95, duration: 0.65 }}
                className="absolute left-8 top-24 z-30 hidden w-56 rounded-3xl border border-white/15 bg-black/45 p-4 text-left shadow-2xl shadow-black/25 backdrop-blur-md lg:block"
              >
                <div className="mb-4 text-sm font-bold text-white">
                  Today&apos;s queue
                </div>
                <div className="space-y-3">
                  {campaignPosts.map((post, index) => (
                    <motion.div
                      key={post.platform}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.1 + index * 0.1 }}
                      className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5"
                    >
                      <div
                        className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${post.color}`}
                      >
                        {post.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {post.title}
                        </div>
                        <div className="text-xs text-blue-100/55">
                          {post.platform}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-blue-100/70">
                        {post.time}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
              <motion.div
                className="absolute left-[46%] top-[210px] z-30 hidden rounded-full border border-white/15 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-50 shadow-xl shadow-fuchsia-500/15 backdrop-blur-md lg:block"
                animate={{ y: [0, 10, 0] }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                +32% growth
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.55 }}
              transition={{ delay: i * 0.1, duration: 0.45, ease: "easeOut" }}
            >
              <div className="text-3xl font-bold text-white mb-1">
                <StatsCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  delay={i * 120}
                />
              </div>
              <div className="text-gray-500 text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-4">
            Powerful Features for Creators
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Everything you need to automate your social presence from scratch.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Zap className="text-yellow-400" />,
              title: "AI Post Generator",
              desc: "Generate multi-platform content from just a topic. Tone-optimized for LinkedIn, IG, and more.",
            },
            {
              icon: <Video className="text-blue-400" />,
              title: "Video to Shorts",
              desc: "Turn long videos into viral vertical shorts with AI captions and smart trimming.",
            },
            {
              icon: <Calendar className="text-green-400" />,
              title: "Post Scheduler",
              desc: "Plan your entire week in minutes. Schedule posts across all platforms from one dashboard.",
            },
            {
              icon: <MessageSquare className="text-purple-400" />,
              title: "Auto-Reply AI",
              desc: "Never miss an engagement. AI handles comments and replies with your brand voice.",
            },
            {
              icon: <BarChart3 className="text-red-400" />,
              title: "Deep Analytics",
              desc: "Track performance across platforms with unified charts and growth metrics.",
            },
            {
              icon: <CheckCircle2 className="text-emerald-400" />,
              title: "Brand Kit",
              desc: "Set your brand tone and voice once, and AI will stick to it across all tools.",
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -10 }}
              className="p-8 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all"
            >
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="py-32 px-6 border-y border-white/5 bg-white/[0.02]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">From Idea to Published</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Create campaigns, tune the voice, and ship posts across every
              channel in one fast flow.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Drop in an idea",
                desc: "Give AI a topic, product, or campaign goal and it builds the content direction.",
              },
              {
                step: "02",
                title: "Choose your channels",
                desc: "Generate platform-ready copy, hooks, captions, and short-form video angles.",
              },
              {
                step: "03",
                title: "Schedule with confidence",
                desc: "Preview your calendar, approve the best posts, and keep the brand moving.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ delay: index * 0.12, duration: 0.55 }}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-8"
              >
                <div className="mb-8 text-sm font-bold text-blue-300">
                  {item.step}
                </div>
                <h3 className="mb-3 text-2xl font-bold">{item.title}</h3>
                <p className="leading-relaxed text-gray-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 px-6 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-gray-400">
              Scale your social presence without breaking the bank.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "Free",
                features: [
                  "30 AI Posts/month",
                  "Basic Analytics",
                  "1 Social Account",
                  "Video to Shorts (10/mo)",
                  "Auto comment reply (5/mo)",
                ],
              },
              {
                name: "Pro",
                price: "$7",
                features: [
                  "Unlimited AI Posts",
                  "Video to Shorts (30/mo)",
                  "All Social Accounts",
                  "All Access",
                ],
                highlighted: true,
              },
              {
                name: "Agency",
                price: "$30",
                features: [
                  "Everything in Pro",
                  "Unlimited Shorts",
                  "Team Collaboration",
                  "Custom Brand Voices",
                ],
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`p-8 rounded-3xl border ${plan.highlighted ? "border-blue-500 bg-blue-500/5 shadow-2xl shadow-blue-500/10" : "border-white/10 bg-white/5"} flex flex-col`}
              >
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="text-4xl font-bold">{plan.price}</div>
                  <div className="text-gray-500 text-sm mt-1">
                    {plan.price === "Free" ? "Forever" : "per month"}
                  </div>
                </div>
                <div className="space-y-4 mb-8 flex-1">
                  {plan.features.map((f, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-3 text-gray-400"
                    >
                      <CheckCircle2 size={16} className="text-blue-500" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={`/account/signup?plan=${plan.name.toLowerCase()}`}
                  className={`block w-full py-4 rounded-xl text-center font-bold transition-all ${plan.highlighted ? "bg-blue-600 hover:bg-blue-700" : "bg-white/10 hover:bg-white/20"}`}
                >
                  Choose {plan.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10 text-center md:text-left">
          <div>
            <div className="flex items-center gap-2 mb-4 justify-center md:justify-start">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
                S
              </div>
              <span className="text-xl font-bold">Socialoraa</span>
            </div>
            <p className="text-gray-500 max-w-xs">
              Built for the next generation of digital creators and businesses.
            </p>
          </div>
          <div className="flex gap-12 text-sm text-gray-400">
            <div className="flex flex-col gap-3">
              <span className="text-white font-bold mb-1">Product</span>
              <a href="#" className="hover:text-white">
                Features
              </a>
              <a href="#" className="hover:text-white">
                Pricing
              </a>
              <a href="#" className="hover:text-white">
                API
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-white font-bold mb-1">Company</span>
              <a href="#" className="hover:text-white">
                About
              </a>
              <a href="#" className="hover:text-white">
                Contact
              </a>
              <a href="#" className="hover:text-white">
                Privacy
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-500 text-sm">
          <span>&copy; 2026 Socialoraa. All rights reserved.</span>
          <div className="flex gap-6">
            <Instagram size={20} className="hover:text-white cursor-pointer" />
            <Linkedin size={20} className="hover:text-white cursor-pointer" />
            <Youtube size={20} className="hover:text-white cursor-pointer" />
          </div>
        </div>
      </footer>
    </div>
  );
}
