type GtagCommand = 'config' | 'event' | 'js' | 'set';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Gtag = (command: GtagCommand, ...args: any[]) => void;

declare global {
  interface Window {
    gtag: Gtag;
    dataLayer: unknown[];
  }
}

export {};
