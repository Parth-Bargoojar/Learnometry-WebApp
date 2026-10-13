import { contentValidateLlm } from "./content";
import { creditsBalanceAudit, creditsDailyRefill, creditsExpire, creditsMonthlyRefill, creditsReservationSweeper } from "./credits";
import { accountErase, accountEraseDue, accountUnverifiedCleanup } from "./account";

/** Every function the app serves. Add new jobs here (ARCHITECTURE §5 lists the full catalogue). */
export const functions = [accountErase, accountEraseDue, accountUnverifiedCleanup, contentValidateLlm, creditsMonthlyRefill, creditsDailyRefill, creditsExpire, creditsReservationSweeper, creditsBalanceAudit];
