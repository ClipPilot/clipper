import { createClient } from '@deepgram/sdk';
import { ENV } from './env';

export const deepgram = createClient(ENV.DEEPGRAM_API_KEY);