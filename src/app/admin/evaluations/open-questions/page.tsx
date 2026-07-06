import { EvaluationsLayout } from '../EvaluationsLayout';
import { OpenQuestionsClient } from './OpenQuestionsClient';

export const dynamic = 'force-dynamic';

export default function OpenQuestionsPage() {
  return (
    <EvaluationsLayout active="open_questions">
      <OpenQuestionsClient />
    </EvaluationsLayout>
  );
}
