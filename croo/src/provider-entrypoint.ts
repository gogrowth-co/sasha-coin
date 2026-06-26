import 'dotenv/config';
import { runProvider } from './provider.js';

runProvider().catch(err => {
  console.error('[provider] fatal:', err);
  process.exit(1);
});
