import { SetupFlow } from '../features/setup/SetupFlow';

/** First run: the brief's profile, targets and programme pre-filled, all editable. */
export default function Onboarding() {
  // Saving the profile flips the root gate to "ready", which moves the user to the tabs.
  return <SetupFlow mode="onboarding" profile={null} targets={null} programme={null} onDone={() => undefined} />;
}
