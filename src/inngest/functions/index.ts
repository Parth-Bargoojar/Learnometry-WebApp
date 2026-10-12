import { contentValidateLlm } from "./content";
import { accountErase, accountEraseDue, accountUnverifiedCleanup } from "./account";

/** Every function the app serves. Add new jobs here (ARCHITECTURE §5 lists the full catalogue). */
export const functions = [accountErase, accountEraseDue, accountUnverifiedCleanup, contentValidateLlm];
