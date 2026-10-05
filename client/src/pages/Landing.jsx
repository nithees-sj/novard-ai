import React, { useEffect } from "react";
import { Navigation } from "../components/navigation";
import { useAuth } from "../AuthContext";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import AgentAvatar from "../components/agent/AgentAvatar";
import mainlogo from "../images/mainlogo.png";

const TOOLS = [
  { icon: 'summary', name: 'Notes & Quiz', text: 'Upload a PDF of your notes, ask it questions, read a summary and quiz yourself on it.' },
  { icon: 'doubt', name: 'Doubt Clearance', text: 'Explain what you are stuck on in your own words and work through it step by step.' },
  { icon: 'play', name: 'Video Summarizer', text: 'Paste a YouTube link to chat about the video, summarise it and take a quiz.' },
  { icon: 'library', name: 'Video Library', text: 'Ask for videos on a topic and get a curated list to keep for later.' },
  { icon: 'plan', name: 'Skill Plans', text: 'A day-by-day plan for one skill, with a video for each day and a quiz at the end.' },
  { icon: 'roadmap', name: 'Smart Roadmap', text: 'A stage-by-stage route to a role, sized to the hours you actually have.' },
  { icon: 'target', name: 'Skill Gap Analysis', text: 'Compare your skills with what a role asks for and see what to learn first.' },
  { icon: 'forum', name: 'Forum', text: 'Ask other students, share what you made, and get a first answer from the AI.' },
  { icon: 'bot', name: 'Novard Agent', text: 'One assistant that can open any of these for you and remembers how you learn.' },
];

const STEPS = [
  { title: 'Bring what you are studying', text: 'Your notes, a video, a doubt, or the role you are aiming for.' },
  { title: 'Work through it with the AI', text: 'Chat, summaries and diagrams grounded in your own material.' },
  { title: 'Check it stuck', text: 'Quizzes, progress and a profile that shows where to practise next.' },
];

/** A still of the product (an illustration, not data): Notes & Quiz with an open conversation. */
function ProductStill() {
  const row = (title, meta, active) => (
    <div className={`rounded-lg px-3 py-2 ${active ? 'bg-accent-soft' : ''}`}>
      <p className={`truncate text-small font-medium ${active ? 'text-accent-fg' : 'text-fg'}`}>{title}</p>
      <p className="text-caption text-fg-subtle">{meta}</p>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-xl bg-raised shadow-modal ring-1 ring-line-subtle" aria-hidden="true">
      <div className="flex h-9 items-center gap-1.5 border-b border-line-subtle bg-sunken px-3">
        {[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-line-strong" />)}
        <span className="ml-3 text-caption text-fg-subtle">Doubts &amp; Notes › Notes &amp; Quiz</span>
      </div>
      <div className="flex">
        <div className="hidden w-48 shrink-0 space-y-1 border-r border-line-subtle bg-canvas/60 p-2 sm:block">
          <p className="px-3 pb-1 pt-2 text-caption font-medium text-fg">Your notes</p>
          {row('Operating systems, unit 3', '12 Sept · 2 quizzes', true)}
          {row('DBMS normalisation', '9 Sept · summary')}
          {row('Computer networks', '2 Sept')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="border-b border-line-subtle px-4 pt-3">
            <p className="text-body font-semibold text-fg">Operating systems, unit 3</p>
            <div className="mt-2 flex gap-4 text-small">
              <span className="border-b-2 border-accent pb-2 font-medium text-fg">Chat</span>
              <span className="pb-2 text-fg-subtle">Summary</span>
              <span className="pb-2 text-fg-subtle">Quiz</span>
            </div>
          </div>
          <div className="space-y-4 px-4 py-4">
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-xl rounded-br-sm bg-accent px-3 py-2 text-small text-on-accent">Why does a page fault not always mean a crash?</p>
            </div>
            <div className="flex gap-2.5">
              <AgentAvatar size="h-6 w-6" />
              <div className="min-w-0 space-y-1.5 text-small text-fg-muted">
                <p>A page fault only means the page is not in RAM <span className="text-fg">yet</span>. The OS loads it from disk and the program carries on.</p>
                <p>It is a crash only when the address is invalid (a <span className="font-mono text-caption text-fg">segfault</span>).</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-inset ring-line">
              <span className="text-small text-fg-subtle">Ask a question about your notes…</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-on-accent"><Icon name="arrowUp" className="h-3.5 w-3.5" /></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Landing = () => {
  const { signIn, signingIn, authError } = useAuth();
  const handleSignIn = () => signIn();

  useEffect(() => { document.title = 'NOVARD-AI · Study with an AI that knows your material'; }, []);

  const cta = (
    <Button size="lg" onClick={handleSignIn} loading={signingIn} loadingLabel="Signing in…" iconRight="arrowRight">
      Continue with Google
    </Button>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <Navigation />

      {/* Hero */}
      <section className="px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <p className="text-small font-medium text-accent-fg">For students learning to build software</p>
            <h1 className="mt-3 text-display font-semibold text-fg sm:text-hero">
              Study with an assistant that knows what you are learning.
            </h1>
            <p className="mt-5 max-w-xl text-lead text-fg-muted">
              Upload your notes, paste a lecture video or describe a doubt. Novard-AI answers from your own material,
              turns it into quizzes and plans, and shows you where to practise next.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {cta}
              <span className="text-small text-fg-subtle">Free. Sign in with your Google account.</span>
            </div>
            {authError && <p role="alert" className="mt-4 text-body text-danger-fg">{authError}</p>}
          </div>
          <ProductStill />
        </div>
      </section>

      {/* What you can do */}
      <section id="features" className="scroll-mt-16 border-t border-line-subtle bg-raised px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-display font-semibold text-fg">Everything you study, in one place</h2>
          <p className="mt-2 max-w-2xl text-lead text-fg-muted">Each tool works on your own material and keeps what you make, so you can come back to it.</p>
          <ul className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <li key={t.name}>
                <h3 className="flex items-center gap-2.5 text-body font-semibold text-fg">
                  <Icon name={t.icon} className="h-4 w-4 text-accent-fg" />
                  {t.name}
                </h3>
                <p className="mt-1.5 text-body text-fg-muted">{t.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="about" className="scroll-mt-16 border-t border-line-subtle px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-display font-semibold text-fg">How it works</h2>
          <ol className="mt-10 grid gap-8 border-t border-line-subtle pt-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="num text-title font-medium text-fg-subtle">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-2 text-lead font-semibold text-fg">{s.title}</h3>
                <p className="mt-1 text-body text-fg-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 flex flex-col items-start gap-4 rounded-xl bg-sunken px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lead font-semibold text-fg">Start with whatever you are studying today.</p>
              <p className="mt-0.5 text-body text-fg-muted">It takes one click with your Google account.</p>
            </div>
            {cta}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="scroll-mt-16 border-t border-line-subtle px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <img src={mainlogo} alt="" className="h-6 w-6 rounded-md dark:invert" />
            <span className="font-display text-body font-bold tracking-tight text-fg">NOVARD-AI</span>
          </div>
          <p className="text-small text-fg-subtle">© {new Date().getFullYear()} Novard-AI. Questions or problems? Sign in and use “Report a problem”.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
