import { useLayoutEffect, useRef, useState } from 'react';
import { Code, ChevronRight, FileText, Info } from 'lucide-react';
import { ABOUT_DOCUMENTS, type AboutDocument } from '../data/about';
import { SubPageHeader } from '../components/SubPageHeader';
import { PageSurface } from '../components/PageSurface';
import { ProfileVoiceSlot } from '../components/profile/ProfileVoice';
import '../styles/about.css';

const LINKS = [
  { id: 'app', icon: Info },
  { id: 'terms', icon: FileText },
  { id: 'notes', icon: Code },
] as const;

export function AboutView({ onBack }: { onBack: () => void }) {
  const [document, setDocument] = useState<AboutDocument | null>(null);
  const previous = useRef<AboutDocument | null>(null);
  const content = document ? ABOUT_DOCUMENTS[document] : null;
  const scope = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    scope.current?.closest('main')?.scrollTo({ top: 0 });
    if (document || !previous.current) {
      const heading = scope.current?.querySelector<HTMLElement>('h1');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
    }
    else if (previous.current) scope.current?.querySelector<HTMLElement>(`[data-about-link="${previous.current}"]`)?.focus({ preventScroll: true });
    previous.current = document;
  }, [document]);

  return <PageSurface ref={scope} direction="forward" className="profile-scope about-scope">
    <div className="about-header"><SubPageHeader title={content?.title ?? '關於'} onBack={() => document ? setDocument(null) : onBack()} trailing={<ProfileVoiceSlot id={`about:${document ?? 'overview'}`} />} /></div>
    <div className="about-content">
      {content ? <article className="profile-section about-document" aria-label={content.title}>
        <p className="about-intro">{content.intro}{document === 'notes' && ` · ${__APP_VERSION__}`}</p>
        {content.sections.map(section => <section key={section.title}>
          <h2 className="profile-label">{section.title}</h2>
          <p>{section.text}</p>
        </section>)}
      </article> : <>
        <section className="profile-identity about-identity" aria-label="應用程式資料">
          <span className="profile-directory-icon" aria-hidden="true"><Info width={32} height={32} strokeWidth={1.8} /></span>
          <div><h2 className="profile-name">糖友導航</h2><p className="profile-help">DiaGuide HK</p></div>
        </section>
        <div className="profile-directory about-directory" aria-label="關於糖友導航">
          {LINKS.map(({id,icon:Icon}) => <button key={id} type="button" data-about-link={id} className="profile-directory-row" onClick={() => setDocument(id)}>
            <span className="profile-directory-icon" aria-hidden="true"><Icon width={26} height={26} strokeWidth={1.8} /></span>
            <span className="profile-label">{ABOUT_DOCUMENTS[id].title}</span>
            <ChevronRight width={22} height={22} aria-hidden="true" />
          </button>)}
        </div>
          <dl className="profile-section about-metadata">
            <div><dt>版本</dt><dd>{__APP_VERSION__}</dd></div>
            <div><dt>開發者團隊</dt><dd /></div>
          </dl>
      </>}
    </div>
  </PageSurface>;
}
