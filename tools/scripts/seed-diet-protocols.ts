/**
 * Seed diet protocol catalog from tools/data/.
 *
 * For each protocol (see PROTOCOLS below) seeds:
 *   - diet_protocols           (slug, name, description_md from <slug>.md)
 *   - diet_foods + diet_protocol_foods (from <slug>.csv)
 *   - diet_supplements         (from <slug>_supplements.csv, optional)
 *
 * Idempotent. Re-run after any CSV/MD edit. Prunes rows removed from the
 * authoring source.
 *
 * Usage:
 *   SUPABASE_URL=http://localhost:54321 \
 *   SUPABASE_SERVICE_KEY=<secret key> \
 *   npx tsx tools/scripts/seed-diet-protocols.ts
 *
 * CSV format (foods):
 *   category,food,status,notes
 *   status ∈ {yes, caution, no}
 *   notes may contain commas; everything after the third comma is notes.
 *
 * CSV format (supplements):
 *   slug,name,tier,dose,rationale,evidence_grade,food_equivalent,
 *   nepal_sourcing,notes,sort_order
 *   Uses standards CSV quoting (double quotes around fields that contain
 *   commas). See tools/data/rad_supplements.csv.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

import {
  parseFoodCsv,
  parseLifestyleCsv,
  parseSupplementCsv,
} from './lib/parse-diet-csv';

interface Protocol {
  slug: string;
  name: string;
}

const PROTOCOLS: Protocol[] = [
  { slug: 'keto', name: 'Ketogenic' },
  { slug: 'rad', name: 'RAD (Rare Adipose Disorders)' },
];

const DATA_DIR = path.resolve(__dirname, '../data');

function canonical(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY required.');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  for (const p of PROTOCOLS) {
    const foodsPath = path.join(DATA_DIR, `${p.slug}.csv`);
    const mdPath = path.join(DATA_DIR, `${p.slug}.md`);
    const supplementsPath = path.join(DATA_DIR, `${p.slug}_supplements.csv`);
    const lifestylePath = path.join(DATA_DIR, `${p.slug}_lifestyle.csv`);

    if (!fs.existsSync(foodsPath)) {
      console.warn(`[skip] ${p.slug}: ${foodsPath} not found`);
      continue;
    }

    const descriptionMd = fs.existsSync(mdPath)
      ? fs.readFileSync(mdPath, 'utf8')
      : null;

    // 1. Upsert protocol (with description_md).
    const { data: protoRow, error: pErr } = await db
      .from('diet_protocols')
      .upsert(
        { slug: p.slug, name: p.name, description_md: descriptionMd },
        { onConflict: 'slug' },
      )
      .select('id')
      .single();
    if (pErr || !protoRow) throw pErr ?? new Error('no protocol row');
    console.log(`[${p.slug}] protocol upserted (md: ${descriptionMd ? 'yes' : 'no'})`);

    // 2. Foods + protocol_foods.
    const foods = parseFoodCsv(fs.readFileSync(foodsPath, 'utf8'));
    console.log(`[${p.slug}] ${foods.length} food rows`);

    const uniqueFoods = new Map<string, { display_name: string; category: string }>();
    for (const r of foods) {
      const canon = canonical(r.food);
      if (!uniqueFoods.has(canon)) {
        uniqueFoods.set(canon, { display_name: r.food, category: r.category });
      }
    }
    const foodUpserts = [...uniqueFoods].map(([canon, v]) => ({
      canonical_name: canon,
      display_name: v.display_name,
      category: v.category,
    }));
    const { data: foodRows, error: fErr } = await db
      .from('diet_foods')
      .upsert(foodUpserts, { onConflict: 'canonical_name' })
      .select('id, canonical_name');
    if (fErr || !foodRows) throw fErr ?? new Error('no food rows');
    const foodIdByCanon = new Map(foodRows.map((r) => [r.canonical_name, r.id]));

    // Dedupe by food_id — a food can appear in the CSV under multiple
    // categories (avocado = fat + fruit; tempeh = protein + fermented),
    // but the junction's (protocol_id, food_id) must be unique. First
    // occurrence wins, consistent with uniqueFoods above. Duplicates
    // with differing status/notes are logged so CSV drift stays visible.
    const pfMap = new Map<string, { status: string; notes: string | null }>();
    let duplicateRowCount = 0;
    for (const r of foods) {
      const foodId = foodIdByCanon.get(canonical(r.food));
      if (!foodId) throw new Error(`missing food id for ${r.food}`);
      const existing = pfMap.get(foodId);
      if (existing) {
        duplicateRowCount++;
        const drift =
          existing.status !== r.status ||
          (existing.notes ?? '') !== (r.notes || '');
        if (drift) {
          console.warn(
            `[${p.slug}] duplicate food "${r.food}" differs from first occurrence — first wins`,
          );
        }
        continue;
      }
      pfMap.set(foodId, {
        status: r.status,
        notes: r.notes || null,
      });
    }
    const pfUpserts = [...pfMap].map(([foodId, v]) => ({
      protocol_id: protoRow.id,
      food_id: foodId,
      status: v.status,
      notes: v.notes,
      updated_at: new Date().toISOString(),
    }));
    const keepFoodIds = pfUpserts.map((u) => u.food_id);
    const { error: pfErr } = await db
      .from('diet_protocol_foods')
      .upsert(pfUpserts, { onConflict: 'protocol_id,food_id' });
    if (pfErr) throw pfErr;

    const { error: pfDelErr } = await db
      .from('diet_protocol_foods')
      .delete()
      .eq('protocol_id', protoRow.id)
      .not('food_id', 'in', `(${keepFoodIds.join(',')})`);
    if (pfDelErr) throw pfDelErr;
    console.log(
      `[${p.slug}] upserted ${pfUpserts.length} protocol_foods (${duplicateRowCount} CSV duplicates collapsed)`,
    );

    // 3. Supplements (optional).
    if (fs.existsSync(supplementsPath)) {
      const supplements = parseSupplementCsv(
        fs.readFileSync(supplementsPath, 'utf8'),
      );
      console.log(`[${p.slug}] ${supplements.length} supplement rows`);
      const supUpserts = supplements.map((s) => ({
        protocol_id: protoRow.id,
        slug: s.slug,
        name: s.name,
        tier: s.tier,
        dose: s.dose,
        rationale: s.rationale,
        evidence_grade: s.evidence_grade,
        food_equivalent: s.food_equivalent,
        nepal_sourcing: s.nepal_sourcing,
        notes: s.notes,
        sort_order: s.sort_order,
        updated_at: new Date().toISOString(),
      }));
      const { error: sErr } = await db
        .from('diet_supplements')
        .upsert(supUpserts, { onConflict: 'protocol_id,slug' });
      if (sErr) throw sErr;

      const keepSlugs = supplements.map((s) => s.slug);
      const { error: sDelErr } = await db
        .from('diet_supplements')
        .delete()
        .eq('protocol_id', protoRow.id)
        .not('slug', 'in', `(${keepSlugs.map((s) => `"${s}"`).join(',')})`);
      if (sDelErr) throw sDelErr;
      console.log(`[${p.slug}] upserted ${supUpserts.length} supplements`);
    } else {
      console.log(`[${p.slug}] no supplements CSV; skipping`);
      // Prune any existing supplements for this protocol if source file removed.
      await db
        .from('diet_supplements')
        .delete()
        .eq('protocol_id', protoRow.id);
    }

    // 4. Lifestyle (optional).
    if (fs.existsSync(lifestylePath)) {
      const lifestyle = parseLifestyleCsv(fs.readFileSync(lifestylePath, 'utf8'));
      console.log(`[${p.slug}] ${lifestyle.length} lifestyle rows`);
      const lsUpserts = lifestyle.map((l) => ({
        protocol_id: protoRow.id,
        slug: l.slug,
        name: l.name,
        category: l.category,
        frequency: l.frequency,
        description: l.description,
        rationale: l.rationale,
        sort_order: l.sort_order,
        updated_at: new Date().toISOString(),
      }));
      const { error: lsErr } = await db
        .from('diet_lifestyle')
        .upsert(lsUpserts, { onConflict: 'protocol_id,slug' });
      if (lsErr) throw lsErr;

      const keepLsSlugs = lifestyle.map((l) => l.slug);
      const { error: lsDelErr } = await db
        .from('diet_lifestyle')
        .delete()
        .eq('protocol_id', protoRow.id)
        .not('slug', 'in', `(${keepLsSlugs.map((s) => `"${s}"`).join(',')})`);
      if (lsDelErr) throw lsDelErr;
      console.log(`[${p.slug}] upserted ${lsUpserts.length} lifestyle items`);
    } else {
      console.log(`[${p.slug}] no lifestyle CSV; skipping`);
      await db
        .from('diet_lifestyle')
        .delete()
        .eq('protocol_id', protoRow.id);
    }
  }

  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
