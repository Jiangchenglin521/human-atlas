import {flushSync} from 'react-dom';
import {registerAtlasTools} from './agent-tools';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Activity,ArrowUpRight,ChevronRight,Focus,Info,Layers3,Pause,RotateCcw,RotateCw,Search,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import AnatomyScene from './scene';
import {DEFAULT_VISIBLE,SYSTEMS,EXPLANATIONS,explanation,type Atlas,type Concept,type SceneState,type SystemId,type View} from './anatomy';
import {COPY,translateError,type Lang} from './copy';
import {SYSTEM_ZH,explanationZh,toZh} from './anatomy-zh';
import {publicUrl} from './public-url';

const initial: SceneState = {explode: 0, visible: DEFAULT_VISIBLE, selected: [], isolate: false, view: 'three-quarter', rotate: false, reset: 0};
const VESSELS: SystemId[] = ['arterial', 'venous'];
const ORGANS: SystemId[] = ['cardiac', 'sensory', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive'];
type Tab = 'all' | 'vessels' | 'organs';
const TAB_IDS: Record<Exclude<Tab, 'all'>, SystemId[]> = {vessels: VESSELS, organs: ORGANS};

function readLang(): Lang {
  try {
    const saved = localStorage.getItem('human-atlas-lang');
    if (saved === 'en' || saved === 'zh') return saved;
  } catch { /* private mode */ }
  return 'zh';
}

export default function Home() {
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [state, setState] = useState(initial);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'layers' | 'search' | null>(null);
  const [details, setDetails] = useState(false);
  const [about, setAbout] = useState(false);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Concept | null>(null);
  const [lang, setLang] = useState<Lang>(readLang);
  const [tab, setTab] = useState<Tab>('all');
  const t = COPY[lang];
  const nameOf = (name: string) => lang === 'zh' ? toZh(name) : name;
  const systemName = (id: SystemId, english: string) => lang === 'zh' ? SYSTEM_ZH[id] : english;

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = lang === 'zh' ? '人体图谱 3D' : 'Human Atlas';
    try { localStorage.setItem('human-atlas-lang', lang); } catch { /* ignore */ }
  }, [lang]);

  useEffect(() => {
    const abort = new AbortController();
    setProgress(0);
    setError('');
    setAtlas(null);
    setChosen(null);
    setDetails(false);
    setState({...initial, visible: DEFAULT_VISIBLE});
    fetch(publicUrl('/models/atlas.json'), {signal: abort.signal}).then(response => {
      if (!response.ok) throw new Error('The anatomy catalogue could not be loaded.');
      return response.json();
    }).then(data => setAtlas(data as Atlas)).catch(reason => {
      if (reason.name !== 'AbortError') setError(reason.message);
    });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        setPanel('search');
        setDetails(false);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const parts = useMemo(() => new Map(atlas?.parts.map(part => [part.id, part])), [atlas]);
  const counts = useMemo(() => Object.fromEntries(SYSTEMS.map(system => [system.id, atlas?.parts.filter(part => part.system === system.id).length ?? 0])), [atlas]);
  const activeSystems = SYSTEMS.filter(system => counts[system.id] > 0);
  const listedSystems = activeSystems.filter(system => tab === 'all' || TAB_IDS[tab].includes(system.id));
  const selectedParts = state.selected.map(id => parts.get(id)).filter(part => !!part);
  const selected = selectedParts[0];
  const system = SYSTEMS.find(item => item.id === selected?.system);
  const visibleCount = atlas?.parts.filter(part => state.isolate ? state.selected.includes(part.id) : state.visible.includes(part.system) || state.selected.includes(part.id)).length ?? 0;
  const results = useMemo(() => {
    if (!atlas) return [];
    const term = query.toLowerCase().trim();
    const suggestions = ['heart', 'brain', 'liver', 'stomach', 'spleen', 'pancreas', 'urinary bladder', 'trachea']
      .map(name => atlas.concepts.find(concept => concept.name.toLowerCase() === name))
      .filter((concept): concept is Concept => !!concept);
    if (!term) return suggestions;
    return atlas.concepts.filter(concept => {
      const zh = toZh(concept.name).toLowerCase();
      return concept.name.toLowerCase().includes(term) || zh.includes(term) || concept.id.toLowerCase().includes(term);
    }).sort((a, b) => a.name.length - b.name.length).slice(0, 80);
  }, [atlas, query]);

  const choose = (concept: Concept) => {
    setChosen(concept);
    setState(current => ({...current, selected: concept.elements, isolate: false, rotate: false}));
    setDetails(true);
    setPanel(null);
  };
  useEffect(() => {
    if (!atlas) return;
    return registerAtlasTools(atlas, concept => flushSync(() => choose(concept)));
  }, [atlas]);
  const choosePart = (id: string) => {
    const part = parts.get(id);
    if (!part) return;
    setChosen({id: part.conceptId, name: part.name, elements: [id]});
    setState(current => ({...current, selected: [id], isolate: false, rotate: false}));
    setDetails(true);
    setPanel(null);
  };
  const toggle = (id: SystemId) => {
    setDetails(false);
    setState(current => ({...current, selected: [], isolate: false, visible: current.visible.includes(id) ? current.visible.filter(item => item !== id) : [...current.visible, id]}));
  };
  const reset = () => {
    setState(current => ({...initial, visible: DEFAULT_VISIBLE, reset: current.reset + 1}));
    setChosen(null);
    setDetails(false);
    setPanel(null);
    setTab('all');
  };
  const resetView = () => setState(current => ({...current, view: 'three-quarter', rotate: false, reset: current.reset + 1}));
  const openPanel = (next: 'layers' | 'search') => {
    setDetails(false);
    setPanel(current => current === next ? null : next);
  };
  const showTab = (next: Tab) => {
    setTab(next);
    setDetails(false);
    setState(current => ({
      ...current,
      selected: [],
      isolate: false,
      visible: next === 'all' ? (activeSystems.length ? activeSystems.map(item => item.id) : [...DEFAULT_VISIBLE]) : [...TAB_IDS[next]],
    }));
  };
  const pieceLabel = (count: number) => lang === 'zh' ? `${count} 个部件` : `${count} ${count === 1 ? 'piece' : 'pieces'}`;

  return <main className="studio">
    {atlas && <AnatomyScene atlas={atlas} state={{...state, inspectorOpen: details && selectedParts.length > 0}} onSelect={choosePart} label={nameOf} onProgress={value => { setProgress(value); if (value === 100) setError(''); }} onError={setError} />}
    <div className="vignette" />
    <header className="identity">
      <div className="eyebrow"><span className="status-dot" /> {t.eyebrow}</div>
      <h1>{t.title}<Badge variant="outline" className="edition">{t.edition}</Badge></h1>
      <div className="identity-meta">{t.meta(atlas ? atlas.parts.length.toLocaleString('en-US') : '2,234')}</div>
    </header>
    <nav className="top-actions" aria-label={t.searchLabel}>
      <Button variant="ghost" className={panel === 'search' ? 'active' : ''} onClick={() => openPanel('search')} aria-label={t.searchLabel}><Search size={18} /><span>{t.search}</span><kbd>/</kbd></Button>
      <div className="lang-switch" role="group" aria-label={t.langLabel}>
        <button type="button" className={lang === 'en' ? 'active' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
        <button type="button" className={lang === 'zh' ? 'active' : ''} aria-pressed={lang === 'zh'} onClick={() => setLang('zh')}>中文</button>
      </div>
      <Button variant="ghost" className="icon-button" aria-label={t.about} onClick={() => { setDetails(false); setPanel(null); setAbout(true); }}><Info size={18} /></Button>
    </nav>
    <section className={`layers-panel glass ${panel === 'layers' ? 'mobile-open' : ''}`} aria-label={t.systems}>
      <div className="panel-heading"><span>{t.systems}</span><Button variant="ghost" className="mobile-only icon-button" onClick={() => setPanel(null)} aria-label={t.closeSystems}><X size={18} /></Button><Badge variant="secondary" className="desktop-only small-number">{listedSystems.length}</Badge></div>
      <div className="layer-presets">
        <Button variant="ghost" aria-pressed={tab === 'all'} onClick={() => showTab('all')}>{t.tabAll}</Button>
        <Button variant="ghost" aria-pressed={tab === 'vessels'} onClick={() => showTab('vessels')}>{t.tabVessels}</Button>
        <Button variant="ghost" aria-pressed={tab === 'organs'} onClick={() => showTab('organs')}>{t.tabOrgans}</Button>
      </div>
      <div className="system-list">{listedSystems.map(item => <div className={`system-row ${state.visible.includes(item.id) ? 'enabled' : ''}`} key={item.id}><Button variant="ghost" className="system-name" title={t.onlySystem(systemName(item.id, item.name))} onClick={() => setState(current => ({...current, visible: [item.id], isolate: false, selected: []}))}><span className="system-dot" style={{background: item.color}} />{systemName(item.id, item.name)}<span className="system-count">{counts[item.id]}</span></Button><Switch checked={state.visible.includes(item.id)} onCheckedChange={() => toggle(item.id)} aria-label={t.showSystem(systemName(item.id, item.name))} /></div>)}</div>
      <div className="panel-foot"><span>{t.visible(visibleCount.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US'))}</span><Button variant="ghost" onClick={() => setState(current => ({...current, visible: [], selected: [], isolate: false}))}>{t.hideAll}</Button></div>
    </section>
    {panel === 'search' && <section className="search-panel glass" aria-label={t.search}>
      <div className="panel-heading"><span>{t.search}</span><Button variant="ghost" className="icon-button" onClick={() => setPanel(null)} aria-label={t.closeSearch}><X size={18} /></Button></div>
      <Combobox<Concept> items={results} value={null} onValueChange={value => { if (value) choose(value); }} inputValue={query} onInputValueChange={setQuery} itemToStringLabel={concept => nameOf(concept.name)} filter={null} open onOpenChange={open => { if (!open) setPanel(null); }}>
        <ComboboxInput autoFocus placeholder={t.placeholder} aria-label={t.searchLabel} showTrigger={false} />
        <ComboboxContent className="anatomy-search-results">
          <ComboboxEmpty>{t.noMatch}</ComboboxEmpty>
          <ComboboxList>{(concept: Concept) => <ComboboxItem key={concept.id} value={concept}><span className="search-result-name">{nameOf(concept.name)}</span><span className="small-number">{pieceLabel(concept.elements.length)}</span></ComboboxItem>}</ComboboxList>
        </ComboboxContent>
      </Combobox>
      <p className="search-note">{query ? t.searchNoteQuery : t.searchNoteEmpty}</p>
    </section>}
    <nav className="view-controls glass" aria-label={lang === 'zh' ? '视角' : 'Camera controls'}>
      {(['three-quarter', 'front', 'side', 'back'] as View[]).map(view => {
        const viewLabel = lang === 'zh' ? { 'three-quarter': '斜视', front: '正面', side: '侧面', back: '背面' }[view] : view;
        return <Button variant="ghost" key={view} className={state.view === view ? 'active' : ''} aria-pressed={state.view === view} disabled={state.explode > .8 && view !== 'front'} onClick={() => setState(current => ({...current, view, reset: current.reset + 1, rotate: false}))} title={viewLabel} aria-label={viewLabel}><span>{t.views[view]}</span></Button>;
      })}
      <i />
      <Button variant="ghost" disabled={state.explode >= .4} aria-label={state.rotate ? t.pause : t.rotate} title={t.rotate} className={state.rotate ? 'active' : ''} onClick={() => setState(current => ({...current, rotate: !current.rotate}))}>{state.rotate ? <Pause size={17} /> : <RotateCw size={18} />}</Button>
      <Button variant="ghost" aria-label={t.resetView} title={t.resetView} onClick={resetView}><RotateCcw size={17} /></Button>
    </nav>
    <div className="scene-caption"><span className="caption-line" /><span>{state.isolate ? (chosen ? nameOf(chosen.name) : t.captionIsolate) : state.explode > .95 ? t.captionInventory : state.explode > .05 ? t.captionSeparated : t.captionBody}</span><span className="caption-line" /></div>
    <div className="bottom-dock glass">
      <Button variant="ghost" className="mobile-only dock-layers" onClick={() => openPanel('layers')} aria-label={t.systems}><Layers3 size={20} /><span>{t.systems}</span></Button>
      <div className="explode-control">
        <div className="explode-label"><label id="explode-label">{t.explode}</label><output>{Math.round(state.explode * 100)}<span>%</span></output></div>
        <Slider aria-labelledby="explode-label" min={0} max={100} step={1} value={[state.explode * 100]} onValueChange={value => setState(current => ({...current, explode: (Array.isArray(value) ? value[0] : value) / 100, view: (Array.isArray(value) ? value[0] : value) > 80 ? 'front' : current.view, rotate: false}))} />
        <div className="slider-endpoints"><span>{t.assembled}</span><span>{t.everyPiece}</span></div>
      </div>
      <Button variant="ghost" className="dock-reset" onClick={reset} aria-label={t.reset}><RotateCcw size={18} /><span>{t.reset}</span></Button>
    </div>
    <footer className="studio-footer">
      <span>{state.explode > .8 ? t.footerPan : t.footerOrbit}</span>
      <Button variant="ghost" onClick={() => { setDetails(false); setPanel(null); setAbout(true); }}>{t.credits} <ArrowUpRight size={12} /></Button>
    </footer>
    {progress < 100 && !error && <div className="loading glass" role="status"><Activity size={18} /><div><strong>{t.loadingTitle}</strong><span>{t.loadingBody(atlas?.parts.length.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US') ?? '2,234', progress)}</span><div className="loading-track"><i style={{width: `${progress}%`}} /></div></div></div>}
    {error && <div className="loading glass error" role="alert"><p>{translateError(error, lang)}</p><Button variant="ghost" onClick={() => location.reload()}>{t.reload}</Button></div>}
    <Sheet open={details && selectedParts.length > 0} modal={false} disablePointerDismissal onOpenChange={setDetails}>
      <SheetContent initialFocus={detailTitle} className={`detail-sheet glass ${state.isolate ? 'is-isolated' : ''}`} showCloseButton={true}>
        <div className="detail-header"><div className="detail-accent" style={{background: system?.color}} /><div className="eyebrow">{system ? systemName(system.id, system.name) : (lang === 'zh' ? '解剖' : 'ANATOMY')}</div><SheetTitle ref={detailTitle} tabIndex={-1} className="structure-title">{chosen ? nameOf(chosen.name) : ''}</SheetTitle></div>
        <div className="detail-scroll" key={`${chosen?.id}-${state.isolate}`}>
          <SheetDescription className="structure-description">{chosen && selected ? (lang === 'zh' ? explanationZh(chosen.name, selected.system) : explanation(chosen.name, selected.system)) : ''}</SheetDescription>
          {chosen && !EXPLANATIONS[chosen.name.toLowerCase()] && <span className="context-note">{t.contextNote}</span>}
          <div className="structure-meta"><span>{t.atlasRef}<strong>{chosen?.id}</strong></span><span>{t.selectedPieces}<strong>{state.selected.length.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}</strong></span></div>
          {selectedParts.length > 1 && <div className="member-list"><h3>{t.included}</h3>{selectedParts.slice(0, 50).map(part => <Button variant="ghost" key={part.id} onClick={() => choosePart(part.id)}><span>{nameOf(part.name)}</span><ChevronRight size={14} /></Button>)}{selectedParts.length > 50 && <p>{t.morePieces(selectedParts.length - 50)}</p>}</div>}
          <a className="source-link" href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noreferrer">{t.sourceLink} <ArrowUpRight size={14} /></a>
        </div>
        <div className="detail-actions">
          <Button className={`primary-action ${state.isolate ? 'active' : ''}`} onClick={() => setState(current => ({...current, isolate: !current.isolate, explode: 0}))}><Focus size={18} />{state.isolate ? t.showSurrounding : t.isolate}<ChevronRight size={16} /></Button>
          <Button variant="ghost" className="secondary-action" onClick={() => { setState(current => ({...current, selected: [], isolate: false})); setDetails(false); }}>{t.clear}</Button>
        </div>
      </SheetContent>
    </Sheet>
    <Sheet open={about} onOpenChange={setAbout}>
      <SheetContent className="about-sheet glass">
        {lang === 'zh' ? <>
          <div className="eyebrow">来源与范围</div>
          <SheetTitle className="structure-title">一个被拆解的人体。</SheetTitle>
          <SheetDescription>基于 BodyParts3D 成年男性参考解剖数据，进行三维探索。</SheetDescription>
          <div className="about-copy">
            <p><strong>男性 · BodyParts3D</strong><br />来自成年男性参考解剖的 2,234 个独立网格与 3,432 个命名概念。</p>
            <p>该参考数据不包含人体的全部结构或变异。一个命名概念可能包含多个部件；每个源网格仅渲染一次。</p>
            <p>配色与系统分组为便于探索而设计。几何数据为适配网页做了简化，简要说明仅提供一般性教育背景。本图谱是解剖参考，不用于诊断或手术。</p>
            <h3>数据来源</h3>
            <p>BodyParts3D，© 生命科学数据库中心（DBCLS），依 CC 署名 4.0 国际许可协议授权。</p>
            <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">数据集许可 <ArrowUpRight size={14} /></a>
            <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">原始几何与元数据 <ArrowUpRight size={14} /></a>
            <a href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752" target="_blank" rel="noreferrer">阅读原始论文 <ArrowUpRight size={14} /></a>
          </div>
        </> : <>
          <div className="eyebrow">SOURCE & SCOPE</div>
          <SheetTitle className="structure-title">A body, revealed.</SheetTitle>
          <SheetDescription>Explore the adult male reference anatomy from BodyParts3D.</SheetDescription>
          <div className="about-copy">
            <p><strong>Male · BodyParts3D</strong><br />2,234 individual meshes and 3,432 named concepts from an adult male reference anatomy.</p>
            <p>This reference does not contain every human structure or variation. Named concepts can contain multiple pieces; each source mesh is rendered once.</p>
            <p>Colors and system groupings are designed for exploration. The geometry is simplified for the web, and short explanations provide general educational context. This is an anatomical reference, not a diagnostic or surgical tool.</p>
            <h3>Source</h3>
            <p>BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.</p>
            <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">Dataset license <ArrowUpRight size={14} /></a>
            <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">Original geometry & metadata <ArrowUpRight size={14} /></a>
            <a href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752" target="_blank" rel="noreferrer">Read the source publication <ArrowUpRight size={14} /></a>
          </div>
        </>}
      </SheetContent>
    </Sheet>
  </main>;
}
