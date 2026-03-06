#!/usr/bin/env node

import { networkInterfaces } from 'os';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const ENV_FILES = ['.env.local', 'apps/parakeet/.env.local'];
const ENV_KEY = 'EXPO_PUBLIC_SUPABASE_URL_ANDROID';
const SUPABASE_PORT = 54321;

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function rankInterfaceName(name) {
  if (/^(wlan|wifi|wl)/i.test(name)) return 1;
  if (/^(en|eth)/i.test(name)) return 2;
  return 3;
}

function detectLanIp() {
  try {
    const entries = Object.entries(networkInterfaces()).flatMap(([name, addrs]) =>
      (addrs ?? [])
        .filter((a) => a.family === 'IPv4' && !a.internal && isPrivateIpv4(a.address))
        .map((a) => ({ name, ip: a.address }))
    );

    if (entries.length) {
      entries.sort((a, b) => {
        const byIface = rankInterfaceName(a.name) - rankInterfaceName(b.name);
        if (byIface !== 0) return byIface;
        return a.name.localeCompare(b.name);
      });
      return entries[0].ip;
    }
  } catch {
    // Fall back to shell-based detection below.
  }

  try {
    const route = execSync('ip route get 1.1.1.1 2>/dev/null', { encoding: 'utf8' });
    const viaRoute = route.match(/\bsrc\s+(\d+\.\d+\.\d+\.\d+)/)?.[1];
    if (viaRoute && isPrivateIpv4(viaRoute)) return viaRoute;
  } catch {
    // Continue fallback chain.
  }

  try {
    const hostIps = execSync('hostname -I 2>/dev/null', { encoding: 'utf8' })
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const firstPrivate = hostIps.find(isPrivateIpv4);
    if (firstPrivate) return firstPrivate;
  } catch {
    // No more fallbacks.
  }

  return null;
}

function getCliIp() {
  const value = process.argv.find((arg) => arg.startsWith('--ip='))?.slice('--ip='.length);
  if (!value) return null;
  if (!isPrivateIpv4(value)) {
    console.error(`Invalid private IPv4 passed via --ip: ${value}`);
    process.exit(1);
  }
  return value;
}

function upsertEnvVar(filePath, key, value) {
  const line = `${key}=${value}`;
  const original = readFileSync(filePath, 'utf8');
  const regex = new RegExp(`^\\s*#?\\s*${key}=.*$`, 'm');

  let next;
  if (regex.test(original)) {
    next = original.replace(regex, line);
  } else {
    const separator = original.endsWith('\n') ? '' : '\n';
    next = `${original}${separator}${line}\n`;
  }

  if (next !== original) {
    writeFileSync(filePath, next);
    return true;
  }
  return false;
}

const ip = getCliIp() ?? detectLanIp();
if (!ip) {
  console.error('Could not auto-detect a private IPv4 address. Pass one explicitly: --ip=192.168.x.y');
  process.exit(1);
}

const value = `http://${ip}:${SUPABASE_PORT}`;
const changed = [];

for (const envFile of ENV_FILES) {
  const abs = resolve(envFile);
  if (upsertEnvVar(abs, ENV_KEY, value)) changed.push(envFile);
}

console.log(`Set ${ENV_KEY}=${value}`);
if (changed.length) {
  console.log(`Updated: ${changed.join(', ')}`);
} else {
  console.log('No file changes were needed.');
}
