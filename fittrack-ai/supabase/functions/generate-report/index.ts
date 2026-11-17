import { serve } from '../_shared/deno/serve.ts';
import { generateReport } from '../_shared/handlers/generateReport.ts';

serve(generateReport);
