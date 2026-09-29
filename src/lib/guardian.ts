/**
 * Minors and guardians — decisions D4 and D5 (Web App Structure §1, §8.18). The rules live
 * in `src/domains/guardian/rules.ts` (BE-0.4); this module binds them to the sample "today"
 * and the sample learner so the UI keeps its call shape until BE-2/BE-11.
 */
import * as rules from "@/domains/guardian/rules";
import { TODAY, learner } from "./data";

export {
  ADULT_AGE,
  APPROVAL_DAYS,
  CONSENT,
  CONSENT_TERMS,
  GUARDIAN_CANNOT_SEE,
  GUARDIAN_CAN_SEE,
  MIN_AGE,
  PREVIEW_CONSENT_TOKEN,
  SIGNUP_KEY,
  addBusinessDays,
  addDays,
  adultOn,
  isEmail,
  isIndianMobile,
  maskContact,
} from "@/domains/guardian/rules";
export type { ConsentRequest, SignupDraft } from "@/domains/guardian/rules";

export const ageOn = (dateOfBirth: string, onIso = TODAY) => rules.ageOn(dateOfBirth, onIso);
export const isMinor = (dateOfBirth: string, onIso = TODAY) => rules.isMinor(dateOfBirth, onIso);

/**
 * The signed-in learner is a minor with verified guardian consent, so every purchase
 * becomes an approval request (D5). Lives here, not in a client module, so server
 * pages read the real boolean.
 */
export const needsApproval = isMinor(learner.dateOfBirth) && learner.guardian?.consentStatus === "verified";
