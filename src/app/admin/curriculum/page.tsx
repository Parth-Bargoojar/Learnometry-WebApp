import type { Metadata } from "next";
import { concepts } from "@/lib/data";
import { LAUNCH_CHAPTERS, curriculumTree, questionMeta, trackWeights, tracks, type TrackCode } from "@/lib/admin-data";
import { AdminHeader, Panel, TabLinks } from "@/components/admin-ui";
import { CurriculumEdges } from "@/components/admin-content";

export const metadata: Metadata = { title: "Curriculum" };

/**
 * Curriculum manager — §8.19, TRD §5.2 (K7). One concept graph per subject, cloned per
 * exam track; each track keeps its own exam weights. Edits go to a draft version.
 */
export default async function AdminCurriculumPage(props: PageProps<"/admin/curriculum">) {
  const { track: raw } = await props.searchParams;
  const track = tracks.find((t) => t.code === raw) ?? tracks[0];
  const weights = trackWeights[track.code as TrackCode];
  const published = (conceptId: string) => questionMeta.filter((m) => m.conceptId === conceptId && m.status === "published").length;

  return (
    <div>
      <AdminHeader title="Curriculum" meta={`Physics · Class 11 Mechanics · sample graph holds ${curriculumTree.length} of ${LAUNCH_CHAPTERS} launch chapters`} />
      <TabLinks
        label="Exam track"
        active={track.code}
        tabs={tracks.map((t) => ({ key: t.code, label: t.name, href: t.code === "jee_main" ? "/admin/curriculum" : `/admin/curriculum?track=${t.code}` }))}
      />
      <div className="grid grid-cols-12 gap-6">
        <Panel
          title={`${track.name} tree`}
          meta={track.source ? `Cloned from ${track.source}; weights are this track's own.` : "Source graph for the other tracks."}
          className="col-span-12 xl:col-span-6"
        >
          <ul className="flex flex-col gap-5">
            {curriculumTree.map((ch) => (
              <li key={ch.id}>
                <p className="font-semibold text-ink">{ch.name}</p>
                <p className="text-xs text-muted">{ch.ncert}</p>
                <ul className="mt-2 flex flex-col gap-2 border-l border-border-subtle pl-4">
                  {ch.topics.map((t) => (
                    <li key={t.name}>
                      <p className="text-sm font-semibold text-muted">{t.name}</p>
                      <ul className="mt-1 flex flex-col">
                        {t.concepts.map((c) => {
                          const n = published(c.id);
                          return (
                            <li key={c.id} className="grid min-h-9 grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border-subtle text-sm last:border-b-0">
                              <span className="text-ink">{c.name}</span>
                              <span className="tabular-nums text-muted" title="Exam weight on this track">
                                w {weights[c.id]?.toFixed(2)}
                              </span>
                              <span className="tabular-nums text-muted">{c.estimatedMinutes} min</span>
                              <span className={`w-20 text-right tabular-nums ${n < 12 ? "text-warning-text" : "text-muted"}`} title="Published questions (launch gate G5 needs 12)">
                                {n} / 12 Qs
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            “w” is exam weight (0–1). Launch gate G5 needs 12 validated items per assessed concept per track. Concepts that have questions or learner history can be deactivated, never deleted.
          </p>
        </Panel>
        <div className="col-span-12 xl:col-span-6">
          <CurriculumEdges concepts={concepts.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
      </div>
    </div>
  );
}
