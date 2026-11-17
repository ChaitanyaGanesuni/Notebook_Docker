import { Card, Muted, Screen, StateView, Title } from '../ui/components';

/** A tab whose features arrive in a later phase. Says so plainly instead of showing fake content. */
export function PhasePlaceholder({ title, phase, items }: { title: string; phase: number; items: string[] }) {
  return (
    <Screen>
      <Title>{title}</Title>
      <Card>
        <StateView kind="empty" title="Nothing here yet" message={`This tab is built in phase ${phase}.`} />
        {items.map((i) => <Muted key={i}>• {i}</Muted>)}
      </Card>
    </Screen>
  );
}
