// A number input that lets the user type freely: values in range are applied as they are typed,
// and the field is clamped only when it loses focus or Enter is pressed (clamping on every
// keystroke turns "1" on the way to "12" into the minimum).

import { useEffect, useState } from 'react';

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(v: number): void;
  'aria-label'?: string;
}

export function NumberField({ value, min, max, step, onChange, ...rest }: Props) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(String(value)); }, [value, editing]);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = () => {
    const n = Number(text);
    const v = text.trim() === '' || !Number.isFinite(n) ? value : clamp(n);
    setText(String(v));
    setEditing(false);
    if (v !== value) onChange(v);
  };
  return (
    <input
      type="number" min={min} max={max} step={step} value={text} {...rest}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        setEditing(true);
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
    />
  );
}
