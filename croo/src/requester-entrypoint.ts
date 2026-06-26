// Usage: node dist/requester-entrypoint.js <serviceId> '<requirementsJson>'
import 'dotenv/config';
import { placeOrder } from './requester.js';

const [,, serviceId, requirementsRaw] = process.argv;
if (!serviceId || !requirementsRaw) {
  console.error("Usage: node dist/requester-entrypoint.js <serviceId> '<requirementsJson>'");
  process.exit(1);
}

placeOrder({
  serviceId,
  requirements: JSON.parse(requirementsRaw),
}).then(result => {
  console.log('\n=== DELIVERY ===');
  console.log(result);
}).catch(err => {
  console.error('[requester] error:', err);
  process.exit(1);
});
