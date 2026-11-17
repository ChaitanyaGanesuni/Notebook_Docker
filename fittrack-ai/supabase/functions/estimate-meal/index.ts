import { serve } from '../_shared/deno/serve.ts';
import { estimateMeal } from '../_shared/handlers/estimateMeal.ts';

serve(estimateMeal);
