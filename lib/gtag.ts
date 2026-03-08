export const GA_ID = 'G-1JHEHJCLXN';

let _isMaster = false;

export const setGtagMaster = (value: boolean) => {
  _isMaster = value;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pageview = (url: string, pageTitle?: string) => {
  if (_isMaster || typeof window.gtag === 'undefined') return;
  window.gtag('config', GA_ID, {
    page_path: url,
    page_title: pageTitle || document.title,
  });
};

type GTagEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

export const event = ({ action, category, label, value }: GTagEvent) => {
  if (_isMaster || typeof window.gtag === 'undefined') return;
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
};
