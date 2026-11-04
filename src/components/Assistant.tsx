import { useEffect, useRef, useState, type FormEvent } from 'react';
import { aiReply, greeting, localReply, suggestions, type Action, type Reply } from '../data/assistant';
import type { PanelId } from '../data/content';
import glyph from '../assets/glyph-dark.png';

interface Msg { id: number; role: 'user' | 'assistant'; text: string; actions?: Action[]; typing?: boolean }

let nextId = 1;

// Corner web drawn behind the conversation.
function CornerWeb() {
  const spokes = Array.from({ length: 9 }, (_, i) => (i / 8) * 90);
  const rings = [60, 120, 185, 255, 330];
  const pt = (r: number, a: number) => [Math.cos((a * Math.PI) / 180) * r, Math.sin((a * Math.PI) / 180) * r];
  return (
    <svg className="corner-web" viewBox="0 0 340 340" aria-hidden="true">
      {spokes.map(a => { const [x, y] = pt(340, a); return <line key={a} x1="0" y1="0" x2={x} y2={y} />; })}
      {rings.map(r => (
        <path key={r} d={spokes.map((a, i) => { const [x, y] = pt(r, a); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ')} />
      ))}
    </svg>
  );
}

export default function Assistant({ onOpen }: { onOpen: (id: PanelId) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Reveal assistant replies word by word.
  const say = (reply: Reply) => {
    const id = nextId++;
    const words = reply.text.split(' ');
    setMsgs(m => [...m, { id, role: 'assistant', text: '', typing: true }]);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setMsgs(m => m.map(x => (x.id === id ? { ...x, text: words.slice(0, i).join(' ') } : x)));
      if (i >= words.length) {
        clearInterval(timer);
        setMsgs(m => m.map(x => (x.id === id ? { ...x, typing: false, actions: reply.actions } : x)));
      }
    }, 26);
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = setTimeout(() => say(greeting), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [msgs, thinking]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setInput('');
    const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant')?.text;
    const history = [...msgs, { role: 'user' as const, text: q }].map(m => ({ role: m.role, content: m.text }));
    setMsgs(m => [...m, { id: nextId++, role: 'user', text: q }]);
    setThinking(true);
    const local = localReply(q, lastAssistant);
    const [ai] = await Promise.all([aiReply(history), new Promise(r => setTimeout(r, 600))]);
    setThinking(false);
    say(ai ? { text: ai, actions: local.actions } : local);
  };

  const act = (a: Action) => {
    if (a.panel) onOpen(a.panel);
    else if (a.href) window.open(a.href, a.href.startsWith('mailto:') ? '_self' : '_blank', 'noopener');
    else ask(a.label);
  };

  const submit = (e: FormEvent) => { e.preventDefault(); ask(input); };
  const busy = thinking || msgs.some(m => m.typing);

  return (
    <section className="silk" aria-label="Ask Ämblik">
      <CornerWeb />
      <div className="silk-inner">
        <div className="silk-head">
          <span className={`silk-mark ${busy ? 'is-busy' : ''}`} aria-hidden="true"><img src={glyph} alt="" /></span>
          <div>
            <p className="silk-title">Ask Ämblik</p>
            <p className="silk-status">{thinking ? 'Spinning up an answer…' : 'Questions about your pipeline, answered'}</p>
          </div>
        </div>

        <div className="thread" ref={listRef} aria-live="polite">
          {msgs.map(m => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.role === 'assistant' && <span className="knot" aria-hidden="true" />}
              <p>{m.text}{m.typing && <span className="caret" />}</p>
              {m.actions && m.actions.length > 0 && (
                <div className="msg-actions">
                  {m.actions.map(a => (
                    <button key={a.label} type="button" onClick={() => act(a)}>{a.label}<span aria-hidden="true">→</span></button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {thinking && <div className="msg assistant"><span className="knot" aria-hidden="true" /><p className="dots"><i /><i /><i /></p></div>}
        </div>

        <div className="suggestions" aria-label="Suggested questions">
          {suggestions.map(s => (
            <button key={s} type="button" onClick={() => ask(s)} disabled={busy}>{s}</button>
          ))}
        </div>

        <form className="ask" onSubmit={submit}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about outreach, leads, your CRM…" aria-label="Your question" maxLength={500} />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      </div>
    </section>
  );
}
