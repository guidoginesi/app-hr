import { EvaluationsShell } from '../EvaluationsShell';
import { OpenQuestionsClient } from './OpenQuestionsClient';

export const dynamic = 'force-dynamic';

export default function OpenQuestionsPage() {
  return (
    <EvaluationsShell active="open_questions">
      <OpenQuestionsClient />
    </EvaluationsShell>
  );
}
