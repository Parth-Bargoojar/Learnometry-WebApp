import type { Metadata } from "next";
import { curriculumForAdmin } from "@/domains/curriculum/service";
import { G5_TARGET } from "@/domains/curriculum/rules";
import { AdminHeader, Panel, TabLinks } from "@/components/admin-ui";
import { CurriculumEdges } from "@/components/admin-content";

export const metadata: Metadata = { title: "Curriculum" };

const TRACKS = [
  { code: "jee_main", name: "JEE Main" },
  { code: "neet", name: "NEET" },
  { code: "cbse_11", name: "CBSE Class 11" },
] as const;

/**
 * Curriculum manager — §8.19, TRD §5.2 (K7). Each exam track owns its concept graph (cloned from
 * JEE Main at launch, BE-D70) and its own exam weights. Edits go to a draft version.
 */
export default async function AdminCurriculumPage(props: PageProps<"/admin/curriculum">) {
  const { track: raw } = await props.searchParams;
  const track = TRACKS.find((t) => t.code === raw) ?? TRACKS[0];
  const view = await curriculumForAdmin(track.code);
  const concepts = view.chapters.flatMap((ch) => ch.topics.flatMap((t) => t.concepts.map((c) => ({ id: c.code, name: c.name }))));
  const total = concepts.length;

  return (
    <div>
      <AdminHeader title="Curriculum" meta={`Physics · Class 11 Mechanics · ${view.chapters.length} chapters, ${total} concepts · published v${view.publishedVersion}`} />
      <TabLinks
        label="Exam track"
        active={track.code}
        tabs={TRACKS.map((t) => ({ key: t.code, label: t.name, href: t.code === "jee_main" ? "/admin/curriculum" : `/admin/curriculum?track=${t.code}` }))}
      />
      <div className="grid grid-cols-12 gap-6">
        <Panel
          title={`${track.name} tree`}
          meta={track.code === "jee_main" ? "Source graph for the other tracks." : "Cloned from JEE Main at launch; its graph and weights are this track's own."}
          className="col-span-12 xl:col-span-6"
        >
          <ul className="flex flex-col gap-5">
            {view.chapters.map((ch) => (
              <li key={ch.id}>
                <p className="font-semibold text-ink">{ch.name}</p>
                {ch.ncert ? <p className="text-xs text-muted">{ch.ncert}</p> : null}
                <ul className="mt-2 flex flex-col gap-2 border-l border-border-subtle pl-4">
                  {ch.topics.map((t) => (
                    <li key={t.name}>
                      <p className="text-sm font-semibold text-muted">{t.name}</p>
                      <ul className="mt-1 flex flex-col">
                        {t.concepts.map((c) => (
                          <li key={c.code} className="grid min-h-9 grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border-subtle text-sm last:border-b-0">
                            <span className={c.active ? "text-ink" : "text-muted line-through"}>{c.name}</span>
                            <span className="tabular-nums text-muted" title="Exam weight on this track">
                              w {c.weight.toFixed(2)}
                            </span>
                            <span className="tabular-nums text-muted">{c.minutes} min</span>
                            <span
                              className={`w-24 text-right tabular-nums ${c.published < G5_TARGET ? "text-warning-text" : "text-muted"}`}
                              title={`Published questions on this track (launch gate G5 needs ${G5_TARGET})`}
                            >
                              {c.published} / {G5_TARGET} Qs
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            “w” is exam weight (0–1). Launch gate G5 needs {G5_TARGET} validated items per assessed concept per track. Concepts that have questions or learner history can be deactivated, never deleted.
          </p>
        </Panel>
        <div className="col-span-12 xl:col-span-6">
          {/* Keyed by track and version so switching tracks or publishing starts from the stored state. */}
          <CurriculumEdges
            key={`${view.examCode}-${view.publishedVersion}-${view.draft ? "draft" : "none"}`}
            examCode={view.examCode}
            version={view.publishedVersion}
            published={view.edges}
            draft={view.draft}
            concepts={concepts}
            publishedAt={view.publishedAt}
            publishedBy={view.publishedBy}
          />
        </div>
      </div>
    </div>
  );
}
