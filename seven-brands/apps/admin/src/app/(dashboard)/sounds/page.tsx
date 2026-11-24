import { brandsWith, can, canAny } from "@sb/core";
import { getDb, listBrands, listSounds, SOUND_SOURCES } from "@sb/db";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Table, Textarea } from "@sb/ui";
import { ActionForm } from "@/components/action-form";
import { getStorage, requirePageStaff } from "@/lib/server";
import { retireSoundAction, uploadSoundAction } from "./actions";

export const metadata = { title: "Sound library" };

const select = "w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm";

export default async function SoundsPage() {
  const staff = await requirePageStaff("asset.read");
  const db = getDb();
  const scope = brandsWith(staff.grants, "asset.read");
  const [rows, brands] = await Promise.all([listSounds(db, scope, { includeRetired: true }), listBrands(db, brandsWith(staff.grants, "asset.write"))]);
  const storage = getStorage();
  const urls = new Map(await Promise.all(rows.map(async (r) => [r.sound.id, await storage.createDownloadUrl(r.sound.storageKey, { expiresInSeconds: 900, filename: `${r.sound.id}.wav` })] as const)));
  const canUpload = canAny(staff.grants, "asset.write");
  return (
    <>
      <PageHeader title="Sound library" description="Recorded or licensed sounds that assets can use instead of synthesized ones. Every sound keeps its source and license with it; uploads are converted to mono 48 kHz WAV at −16 LUFS." />
      {canUpload && (
        <Card title="Add a sound" className="mb-6">
          <ActionForm action={uploadSoundAction} submit="Upload sound">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="WAV file (16-bit PCM, up to 10 s)" htmlFor="file"><input id="file" name="file" type="file" accept=".wav,audio/wav" required className="text-sm" /></Field>
              <Field label="Name" htmlFor="name"><Input id="name" name="name" required maxLength={80} /></Field>
              <Field label="Brand" htmlFor="brandId">
                <select id="brandId" name="brandId" className={select}>
                  {can(staff.grants, "asset.write") && <option value="">Shared (all brands)</option>}
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Source" htmlFor="source">
                <select id="source" name="source" className={select}>{SOUND_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </Field>
              <Field label="Author" htmlFor="author"><Input id="author" name="author" required /></Field>
              <Field label="License or source" htmlFor="licenseRef" hint="e.g. Own recording, CC0 1.0 + URL, purchased library + invoice no."><Input id="licenseRef" name="licenseRef" required minLength={3} /></Field>
            </div>
            <Field label="License notes" htmlFor="licenseNotes"><Textarea id="licenseNotes" name="licenseNotes" rows={2} /></Field>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="rights" className="mt-1" /> I confirm we may use this sound in products we sell, and that the license above is accurate.</label>
          </ActionForm>
        </Card>
      )}
      <Card title={`Sounds (${rows.length})`}>
        {rows.length === 0 ? <EmptyState title="No stored sounds yet">Assets use synthesized sounds until you add some.</EmptyState> : (
          <Table head={["Sound", "Brand", "Source / license", "Length", "Loudness", "Listen", ""]}>
            {rows.map(({ sound: s, brandSlug }) => (
              <tr key={s.id}>
                <td className="px-4 py-2"><div className="font-medium">{s.name}</div><div className="font-mono text-xs text-[var(--color-muted-text)]">{s.id}</div></td>
                <td className="px-4 py-2">{brandSlug ?? "shared"}</td>
                <td className="px-4 py-2 text-xs">{s.source} · {s.author}<br />{s.licenseRef}</td>
                <td className="px-4 py-2">{(s.durationMs / 1000).toFixed(1)} s</td>
                <td className="px-4 py-2 font-mono text-xs">{s.loudnessLufs ?? "—"} LUFS</td>
                <td className="px-4 py-2"><audio controls preload="none" src={urls.get(s.id)} className="h-8 w-48" /></td>
                <td className="px-4 py-2">{s.retiredAt ? <Badge>retired</Badge> : canUpload && <ActionForm action={retireSoundAction.bind(null, s.id)} submit="Retire" variant="secondary" className="flex" />}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
