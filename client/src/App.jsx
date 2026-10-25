import React, { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, Bell, BookOpen, Check, ChevronLeft, CircleHelp, ClipboardList, Clock3, FileText, Home, LogIn, LogOut, Menu, Plus, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const categories = [
  { id: 'compras', title: 'Compras e entregas', subtitle: 'Pedido atrasado, produto com defeito', emoji: '📦' },
  { id: 'cobrancas', title: 'Contas e cobranças', subtitle: 'Cobrança inesperada ou duplicada', emoji: '💳' },
  { id: 'servicos', title: 'Serviços contratados', subtitle: 'Internet, assinatura ou atendimento', emoji: '🧾' },
  { id: 'outros', title: 'Outro problema', subtitle: 'Conte o que aconteceu', emoji: '💬' }
];

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir. Tente novamente.');
  return body;
}

function getSaved(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('rt_token'));
  const [user, setUser] = useState(() => getSaved('rt_user'));
  const [page, setPage] = useState('home');
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [auth, setAuth] = useState({ name: '', email: '', password: '' });
  const [problem, setProblem] = useState({ title: '', description: '', category: 'compras' });
  const [solution, setSolution] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token) return;
    api('/api/cases', { token }).then(data => setCases(data.cases)).catch(() => {
      localStorage.removeItem('rt_token'); localStorage.removeItem('rt_user');
      setToken(null); setUser(null);
    });
  }, [token]);

  function persistSession(data) {
    localStorage.setItem('rt_token', data.token);
    localStorage.setItem('rt_user', JSON.stringify(data.user));
    setToken(data.token); setUser(data.user);
  }

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify(auth) });
      persistSession(data); setPage('home'); setNotice('Você entrou com sucesso.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function generateSolution(e) {
    e.preventDefault(); setBusy(true); setError(''); setSolution(null);
    try {
      const created = await api('/api/cases', { method: 'POST', token, body: JSON.stringify(problem) });
      setCases(old => [created.case, ...old]);
      setSelected(created.case);
      const solved = await api('/api/ai/solve', {
        method: 'POST', token,
        body: JSON.stringify({ ...problem, caseId: created.case.id })
      });
      setSolution(solved);
      setPage('solution');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function openCase(item) {
    setBusy(true); setError('');
    try {
      const data = await api(`/api/cases/${item.id}`, { token });
      setSelected(data.case); setSolution({
        guidance: data.case.ai_guidance || 'Abra novamente a solução para gerar orientações.',
        complaintMessage: data.case.complaint_message || '',
        links: data.case.official_links || [],
        mode: 'saved'
      });
      setPage('detail');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function updateStatus(status) {
    if (!selected) return;
    try {
      const data = await api(`/api/cases/${selected.id}/status`, { method: 'PATCH', token, body: JSON.stringify({ status }) });
      setSelected({ ...selected, status: data.case.status });
      setCases(old => old.map(c => c.id === selected.id ? { ...c, status: data.case.status } : c));
      setNotice('Status atualizado.');
    } catch (err) { setError(err.message); }
  }

  function logout() {
    localStorage.removeItem('rt_token'); localStorage.removeItem('rt_user');
    setToken(null); setUser(null); setCases([]); setPage('home'); setNotice('Você saiu da conta.');
  }

  const nav = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'cases', label: 'Meus casos', icon: ClipboardList },
    { id: 'help', label: 'Como funciona', icon: CircleHelp }
  ];

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setPage('home')} aria-label="Ir para início">
        <span className="brand-mark"><Sparkles size={21}/></span>
        <span>resolve<span className="brand-light">tudo</span><small>Seu próximo passo começa aqui</small></span>
      </button>
      <div className="top-actions">
        {user ? <><span className="user-greeting">Olá, {user.name.split(' ')[0]}</span><button className="icon-button" title="Sair" onClick={logout}><LogOut size={18}/></button></> : <button className="button button-outline button-small" onClick={() => { setPage('auth'); setAuthMode('login'); }}>Entrar <LogIn size={16}/></button>}
      </div>
    </header>

    <div className="layout">
      <aside className="sidebar">
        <div className="side-label">MENU</div>
        {nav.map(item => <button key={item.id} className={`nav-item ${page === item.id || (page === 'detail' && item.id === 'cases') ? 'active' : ''}`} onClick={() => setPage(item.id)}><item.icon size={18}/>{item.label}</button>)}
        <div className="sidebar-help"><ShieldCheck size={21}/><strong>Seus dados protegidos</strong><p>Seus casos são privados e vinculados à sua conta.</p></div>
        {user && <button className="nav-item logout-link" onClick={logout}><LogOut size={18}/> Sair da conta</button>}
      </aside>

      <main className="main-content">
        {error && <div className="alert alert-error"><span>{error}</span><button onClick={() => setError('')}><X size={16}/></button></div>}
        {notice && <div className="alert alert-success"><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}

        {page === 'home' && <HomePage user={user} cases={cases} onStart={() => { setProblem({ title: '', description: '', category: 'compras' }); setSolution(null); setPage(token ? 'new' : 'auth'); }} onAuth={() => setPage('auth')} onOpenCase={openCase} />}
        {page === 'auth' && <section className="auth-card">
          <div className="eyebrow"><Sparkles size={15}/> RESOLVE TUDO</div>
          <h1>{authMode === 'login' ? 'Que bom ter você de volta.' : 'Crie sua conta grátis.'}</h1>
          <p className="muted">Organize seus problemas e encontre os próximos passos.</p>
          <form onSubmit={submitAuth} className="form-stack">
            {authMode === 'register' && <label>Seu nome<input required minLength="2" maxLength="100" value={auth.name} onChange={e => setAuth({ ...auth, name: e.target.value })} placeholder="Como podemos te chamar?"/></label>}
            <label>E-mail<input type="email" required value={auth.email} onChange={e => setAuth({ ...auth, email: e.target.value })} placeholder="voce@email.com" autoComplete="email"/></label>
            <label>Senha<input type="password" required minLength={authMode === 'register' ? 10 : 1} value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} placeholder={authMode === 'register' ? 'Pelo menos 10 caracteres' : 'Sua senha'} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}/></label>
            <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Aguarde…' : authMode === 'login' ? 'Entrar na minha conta' : 'Criar conta grátis'} <ArrowRight size={17}/></button>
          </form>
          <p className="auth-switch">{authMode === 'login' ? 'Ainda não tem conta?' : 'Já tem uma conta?'} <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }}>{authMode === 'login' ? 'Criar conta' : 'Fazer login'}</button></p>
          <p className="fine-print">Não use senhas bancárias nem envie dados completos de cartão. Ao continuar, use o app apenas para orientação informativa.</p>
        </section>}

        {page === 'new' && <section className="content-narrow">
          <button className="back-button" onClick={() => setPage('home')}><ChevronLeft size={17}/> Voltar</button>
          <div className="eyebrow"><Sparkles size={15}/> VAMOS RESOLVER</div>
          <h1>O que aconteceu?</h1><p className="muted">Conte os detalhes que você conhece. Vamos organizar os próximos passos.</p>
          <form className="problem-form panel" onSubmit={generateSolution}>
            <label>Qual é o assunto?</label>
            <div className="category-grid">
              {categories.map(cat => <button type="button" key={cat.id} className={`category-option ${problem.category === cat.id ? 'chosen' : ''}`} onClick={() => setProblem({ ...problem, category: cat.id })}><span className="category-emoji">{cat.emoji}</span><span><strong>{cat.title}</strong><small>{cat.subtitle}</small></span>{problem.category === cat.id && <Check size={16}/>}</button>)}
            </div>
            <label htmlFor="title">Dê um título ao problema</label>
            <input id="title" required minLength="3" maxLength="160" value={problem.title} onChange={e => setProblem({ ...problem, title: e.target.value })} placeholder="Ex.: Meu pedido está atrasado"/>
            <label htmlFor="description">Conte o que aconteceu</label>
            <textarea id="description" required minLength="10" maxLength="10000" rows="5" value={problem.description} onChange={e => setProblem({ ...problem, description: e.target.value })} placeholder="Quando aconteceu? O que a empresa informou? O que você já tentou? Não inclua senhas ou dados bancários."/>
            <div className="privacy-note"><ShieldCheck size={18}/><span>Evite informar CPF, endereço completo, senhas ou dados de cartão. O envio de imagens será adicionado numa próxima versão.</span></div>
            <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Preparando orientação…' : 'Encontrar próximos passos'} <Sparkles size={17}/></button>
          </form>
        </section>}

        {(page === 'solution' || page === 'detail') && solution && <SolutionPage solution={solution} selected={selected} busy={busy} onBack={() => setPage('cases')} onStatus={updateStatus} />}
        {page === 'cases' && <section><div className="page-heading"><div><div className="eyebrow">SEU HISTÓRICO</div><h1>Meus casos</h1><p className="muted">Tudo o que você já organizou em um só lugar.</p></div><button className="button button-primary" onClick={() => token ? setPage('new') : setPage('auth')}><Plus size={17}/> Novo caso</button></div>
          {!token ? <EmptyState title="Entre para ver seus casos" text="Crie uma conta gratuita para salvar e acompanhar seus problemas." onClick={() => setPage('auth')}/> : cases.length === 0 ? <EmptyState title="Você ainda não tem casos" text="Comece descrevendo um problema e receba próximos passos organizados." onClick={() => setPage('new')}/> : <div className="case-list">{cases.map(c => <button className="case-row" key={c.id} onClick={() => openCase(c)}><span className="case-icon">{categories.find(x => x.id === c.category)?.emoji || '💬'}</span><span className="case-main"><strong>{c.title}</strong><small>{new Date(c.created_at).toLocaleDateString('pt-BR')} · {categories.find(x => x.id === c.category)?.title || 'Outro problema'}</small></span><StatusPill status={c.status}/><ArrowRight size={17}/></button>)}</div>}
        </section>}
        {page === 'help' && <section className="content-narrow"><div className="eyebrow">SIMPLES E DIRETO</div><h1>Como funciona</h1><p className="muted">O Resolve Tudo ajuda você a organizar um problema cotidiano e preparar o próximo passo.</p><div className="steps-list">{[['01','Conte o que aconteceu','Descreva o problema sem incluir dados sensíveis.'],['02','Receba orientação','O app organiza possíveis ações e uma mensagem que você pode copiar.'],['03','Guarde o histórico','Consulte seus casos e atualize o status conforme avançar.']].map(([n,t,d]) => <div className="step-card" key={n}><span>{n}</span><div><strong>{t}</strong><p>{d}</p></div></div>)}</div><div className="disclaimer"><BookOpen size={20}/><p>O aplicativo oferece informação geral, não garante solução e não substitui orientação profissional. Confirme direitos e prazos nos canais oficiais.</p></div></section>}
      </main>
    </div>
    <footer className="footer"><span>© {new Date().getFullYear()} Resolve Tudo</span><span>Feito para simplificar o dia a dia no Brasil</span></footer>
    <nav className="mobile-nav">{nav.map(item => <button key={item.id} className={page === item.id ? 'selected' : ''} onClick={() => setPage(item.id)}><item.icon size={20}/><span>{item.label}</span></button>)}</nav>
  </div>;
}

function HomePage({ user, cases, onStart, onAuth, onOpenCase }) {
  return <section>
    <div className="hero">
      <div className="hero-copy"><div className="eyebrow"><span className="live-dot"></span> MENOS CONFUSÃO, MAIS SOLUÇÃO</div><h1>Problemas acontecem.<br/><span>Resolver pode ser simples.</span></h1><p>Organize o que aconteceu, descubra seus próximos passos e tenha uma mensagem pronta para agir.</p><button className="button button-primary hero-button" onClick={onStart}>Resolver meu problema <ArrowRight size={18}/></button><div className="hero-trust"><ShieldCheck size={16}/> Orientações claras, no seu ritmo.</div></div>
      <div className="hero-visual"><div className="floating-bubble bubble-one"><span>📦</span><div><strong>Pedido atrasado?</strong><small>Vamos organizar os próximos passos</small></div><Check size={17}/></div><div className="solution-preview"><div className="preview-top"><span className="preview-spark"><Sparkles size={19}/></span><div><strong>Seu plano de ação</strong><small>Passo a passo personalizado</small></div><span className="preview-dots">•••</span></div><div className="preview-step"><span>1</span><div><strong>Separe os comprovantes</strong><small>Pedido, pagamento e conversas</small></div><Check size={16}/></div><div className="preview-step"><span>2</span><div><strong>Entre em contato</strong><small>Use uma mensagem clara e objetiva</small></div></div><div className="preview-message"><FileText size={17}/><span>Mensagem pronta para copiar</span><ArrowRight size={15}/></div></div><div className="floating-bubble bubble-two"><span>✨</span><div><strong>Próximo passo claro</strong><small>Sem complicação</small></div></div></div>
    </div>
    <div className="section-heading"><div><div className="eyebrow">POR ONDE COMEÇAR?</div><h2>Qual problema você quer resolver?</h2><p>Escolha uma categoria para começar.</p></div></div>
    <div className="home-categories">{categories.map(cat => <button className="home-category" key={cat.id} onClick={onStart}><span className="home-category-emoji">{cat.emoji}</span><strong>{cat.title}</strong><small>{cat.subtitle}</small><span className="category-arrow"><ArrowRight size={17}/></span></button>)}</div>
    <div className="benefit-strip"><div><span><ShieldCheck size={20}/></span><div><strong>Seu histórico organizado</strong><small>Consulte seus casos quando precisar.</small></div></div><div><span><Clock3 size={20}/></span><div><strong>Próximos passos claros</strong><small>Entenda o que fazer primeiro.</small></div></div><div><span><BadgeCheck size={20}/></span><div><strong>Você no controle</strong><small>Decida como e quando agir.</small></div></div></div>
    {user && <div className="recent-section"><div className="section-heading"><div><div className="eyebrow">CONTINUE DE ONDE PAROU</div><h2>Seus casos recentes</h2></div></div>{cases.slice(0,3).map(c => <button className="case-row" key={c.id} onClick={() => onOpenCase(c)}><span className="case-icon">🗂️</span><span className="case-main"><strong>{c.title}</strong><small>{new Date(c.created_at).toLocaleDateString('pt-BR')}</small></span><StatusPill status={c.status}/><ArrowRight size={17}/></button>)}</div>}
    {!user && <div className="signup-banner"><div><h2>Pronto para dar o primeiro passo?</h2><p>Crie sua conta gratuita para guardar seus casos e acompanhar o que já fez.</p></div><button className="button button-primary" onClick={onAuth}>Criar conta grátis <ArrowRight size={17}/></button></div>}
  </section>;
}

function SolutionPage({ solution, selected, busy, onBack, onStatus }) {
  const [copied, setCopied] = useState(false);
  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(solution.complaintMessage || ''); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  return <section className="content-narrow"><button className="back-button" onClick={onBack}><ChevronLeft size={17}/> Voltar aos meus casos</button><div className="eyebrow"><Sparkles size={15}/> SEU PLANO DE AÇÃO</div><h1>Vamos por partes.</h1><p className="muted">Aqui estão próximos passos possíveis para o caso: <strong>{selected?.title}</strong></p>
    <div className="panel solution-panel"><div className="solution-heading"><span className="solution-icon"><Sparkles size={21}/></span><div><strong>Orientação inicial</strong><small>{solution.mode === 'demo' ? 'Modo de demonstração' : 'Assistente Resolve Tudo'}</small></div></div><p className="guidance-text">{solution.guidance}</p><div className="info-note"><ShieldCheck size={18}/><span>Confira as informações e os prazos em fontes oficiais. A orientação não garante resultado nem substitui aconselhamento profissional.</span></div></div>
    {solution.complaintMessage && <div className="panel message-panel"><div className="panel-title"><FileText size={19}/><h3>Mensagem pronta para usar</h3></div><p className="message-content">{solution.complaintMessage}</p><button className="button button-outline button-wide" onClick={copyMessage}>{copied ? <><Check size={17}/> Copiado!</> : <><ClipboardList size={17}/> Copiar mensagem</>}</button></div>}
    {solution.links?.length > 0 && <div className="panel links-panel"><div className="panel-title"><ShieldCheck size={19}/><h3>Canais para consultar</h3></div>{solution.links.map((link, i) => <a key={i} href={link.url} target="_blank" rel="noreferrer" className="official-link"><span><strong>{link.label}</strong><small>Abra o site em uma nova aba</small></span><ArrowRight size={17}/></a>)}</div>}
    {selected && <div className="panel status-panel"><div className="panel-title"><ClipboardList size={19}/><h3>Acompanhar este caso</h3></div><label htmlFor="case-status">Status</label><select id="case-status" value={selected.status} disabled={busy} onChange={e => onStatus(e.target.value)}><option value="em_andamento">Em andamento</option><option value="aguardando_resposta">Aguardando resposta</option><option value="resolvido">Resolvido</option><option value="arquivado">Arquivado</option></select></div>}
  </section>;
}

function StatusPill({ status }) {
  const map = { em_andamento: ['Em andamento','status-progress'], aguardando_resposta: ['Aguardando resposta','status-wait'], resolvido: ['Resolvido','status-done'], arquivado: ['Arquivado','status-muted'] };
  const [label, cls] = map[status] || map.em_andamento;
  return <span className={`status-pill ${cls}`}>{label}</span>;
}

function EmptyState({ title, text, onClick }) {
  return <div className="empty-state"><span><ClipboardList size={25}/></span><h3>{title}</h3><p>{text}</p><button className="button button-primary" onClick={onClick}>Começar agora <ArrowRight size={17}/></button></div>;
}
