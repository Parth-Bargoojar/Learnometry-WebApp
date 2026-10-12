import "server-only";
import { system } from "@/lib/db/system";
import type { Edge } from "@/domains/admin/rules";
import { discardDraft, getCurriculum, publishDraft, saveDraft } from "./admin";

/* Entry points for the admin curriculum screen (BE-3.5). Callers have passed requireAdmin / requireActionAdmin. */
type Actor = { userId: string; role: string };

export const curriculumForAdmin = (examCode: string) => system((tx) => getCurriculum(tx, examCode));
export const saveCurriculumDraft = (actor: Actor, examCode: string, edges: Edge[]) => system((tx) => saveDraft(tx, actor, examCode, edges));
export const discardCurriculumDraft = (examCode: string) => system((tx) => discardDraft(tx, examCode));
export const publishCurriculum = (actor: Actor, examCode: string, reason: string) => system((tx) => publishDraft(tx, actor, examCode, reason));
