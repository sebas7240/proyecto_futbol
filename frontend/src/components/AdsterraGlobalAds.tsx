import { useEffect } from 'react';

const POPUNDER_SCRIPT_ID = 'adsterra-popunder-script';
const SOCIAL_BAR_SCRIPT_ID = 'adsterra-social-bar-script';

const POPUNDER_SRC = 'https://formssternlystately.com/48/55/30/4855307709cec8a1c8e8fb76904f8b4f.js';
const SOCIAL_BAR_SRC = 'https://formssternlystately.com/cf/9e/02/cf9e028de5f7926ff59da190e8f7f25b.js';

function appendScript(id: string, src: string, parent: HTMLElement) {
  if (document.getElementById(id)) return;

  const script = document.createElement('script');
  script.id = id;
  script.src = src;
  script.async = true;
  parent.appendChild(script);
}

const AdsterraGlobalAds = () => {
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const hasLoadedGlobalAds = sessionStorage.getItem('golea_global_ads_loaded') === 'true';

    if (hasLoadedGlobalAds) return;

    const timer = window.setTimeout(() => {
      appendScript(POPUNDER_SCRIPT_ID, POPUNDER_SRC, document.head);
      appendScript(SOCIAL_BAR_SCRIPT_ID, SOCIAL_BAR_SRC, document.body);
      sessionStorage.setItem('golea_global_ads_loaded', 'true');
    }, isMobile ? 12000 : 3000);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
};

export default AdsterraGlobalAds;
