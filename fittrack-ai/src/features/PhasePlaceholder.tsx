import { View } from 'react-native';
import { Bullet, Card, Eyebrow, Screen, StateView, Title, type IconName } from '../ui/components';
import { Appear } from '../ui/motion';
import { useTheme } from '../ui/theme';

/** A tab whose features arrive in a later phase. Says so plainly instead of showing fake content. */
export function PhasePlaceholder({ title, phase, icon, items }: { title: string; phase: number; icon: IconName; items: string[] }) {
  const { c } = useTheme();
  return (
    <Screen>
      <Appear><Eyebrow>Phase {phase}</Eyebrow><Title>{title}</Title></Appear>
      <Appear index={1}>
        <Card>
          <StateView kind="empty" icon={icon} title="Nothing here yet" message={`This tab is built in phase ${phase}.`} />
          <View style={{ gap: 10 }}>
            {items.map((i) => <Bullet key={i} icon="ellipse-outline" tint={c.muted}>{i}</Bullet>)}
          </View>
        </Card>
      </Appear>
    </Screen>
  );
}
