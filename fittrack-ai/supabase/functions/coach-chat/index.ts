import { serve } from '../_shared/deno/serve.ts';
import { coachChat } from '../_shared/handlers/coachChat.ts';

serve(coachChat);
