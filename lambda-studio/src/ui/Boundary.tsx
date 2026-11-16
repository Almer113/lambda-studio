import { Component, type ReactNode } from 'react';
import { useStore, currentTerm } from './store';

interface Props { name: string; resetKey: unknown; children: ReactNode; compact?: boolean }
interface State { error: Error | null; key: unknown }

/**
 * Keeps one panel's failure (typically a stack overflow on an extremely deep term) from blanking
 * the whole app. The panel comes back when the current term changes, or with Try again.
 */
class Boundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) { return { error }; }
  static getDerivedStateFromProps(p: Props, s: State): Partial<State> | null {
    return p.resetKey !== s.key ? { error: null, key: p.resetKey } : null;
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const deep = error instanceof RangeError;
    const retry = <button type="button" onClick={() => this.setState({ error: null })}>Try again</button>;
    // header, dialogs and drawers: a one-line notice rather than a panel
    if (this.props.compact) return <div className="panel-error compact" role="status">{this.props.name} failed: {error.message} {retry}</div>;
    return (
      <div className="panel panel-error" role="status">
        <div className="panel-head"><h2>{this.props.name}</h2></div>
        <p className="muted">
          {deep ? 'This term is nested too deeply for this view to show.' : `This view failed: ${error.message}`}
          {' '}The rest of the app still works; step back or change the term to bring it back.
        </p>
        <div className="buttons">{retry}</div>
      </div>
    );
  }
}

/** Error boundary that resets whenever the current term changes. */
export function Guard({ name, children, compact }: { name: string; children: ReactNode; compact?: boolean }) {
  const term = useStore(currentTerm);
  return <Boundary name={name} resetKey={term} compact={compact}>{children}</Boundary>;
}
