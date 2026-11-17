import { PhasePlaceholder } from '../../features/PhasePlaceholder';

export default function Progress() {
  return <PhasePlaceholder title="Progress" phase={5} icon="stats-chart-outline" items={['Weekly averages and logging streak', 'Weight and waist trends', 'Workout heatmap and macro split']} />;
}
