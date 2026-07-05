import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { OrderLogEntry } from './types.js';

let __dirname = '';
try { __dirname = path.dirname(fileURLToPath(import.meta.url)); } catch {}
const DEFAULT_LOG = process.env.CROO_ORDERS_LOG
  ?? path.resolve(__dirname, '../../state/croo-orders.json');

export function readOrders(logPath = DEFAULT_LOG): OrderLogEntry[] {
  if (!existsSync(logPath)) return [];
  try {
    return JSON.parse(readFileSync(logPath, 'utf8')) as OrderLogEntry[];
  } catch {
    return [];
  }
}

export function appendOrder(entry: OrderLogEntry, logPath = DEFAULT_LOG): void {
  const existing = readOrders(logPath);
  existing.push(entry);
  writeFileSync(logPath, JSON.stringify(existing, null, 2), 'utf8');
}
