import { useEffect, useState } from 'react';
import { useStore } from './store';

export function useIsDark(): boolean {
  const theme = useStore((s) => s.settings.theme);
  const [sys, setSys] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const f = () => setSys(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return theme === 'dark' || (theme === 'system' && sys);
}

export function useApplyTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
}
