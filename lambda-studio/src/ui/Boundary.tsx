import { Component, type ReactNode } from 'react';
import { useStore, currentTerm } from './store';

interface Props { name: string; resetKey: unknown; children: ReactNode }
interface State { error: Error | null; key: unknown }

/**
 * Keeps one panel's failure (typically a stack overflow on an extremely deep term) from blanking
 * the whole app. The panel comes back when the current term changes.
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
    return (
      <div className="panel panel-error" role="status">
        <div className="panel-head"><h2>{this.props.name}</h2></div>
        <p className="muted">
          {deep ? 'This term is nested too deeply for this view to show.' : `This view failed: ${error.message}`}
          {' '}The rest of the app still works; step back or change the term to bring it back.
        </p>
      </div>
    );
  }
}

/** Error boundary that resets whenever the current term changes. */
export function Guard({ name, children }: { name: string; children: ReactNode }) {
  const term = useStore(currentTerm);
  return <Boundary name={name} resetKey={term}>{children}</Boundary>;
}
