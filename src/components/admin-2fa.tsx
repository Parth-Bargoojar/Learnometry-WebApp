"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { enrollAdminTotpAction, verifyAdminTotpAction } from "@/app/(auth)/security/2fa/actions";
import { Field, input } from "./auth-forms";
import { btn } from "./ui";

/*
  Admin two-step check (K1, BE-D26). Minimal on purpose: enrol an authenticator app once, then
  enter a 6-digit code at every sign-in and again after 12 hours. The console itself answers
  404 until this succeeds.
*/
export function AdminTwoFactor({ factorId, next }: { factorId: string | null; next: string }) {
  const router = useRouter();
  const [enrol, setEnrol] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = enrol?.factorId ?? factorId;

  const start = async () => {
    setPending(true);
    setError(null);
    const res = await enrollAdminTotpAction();
    setPending(false);
    if (res.ok) setEnrol(res.data);
    else setError(res.error.message);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!active) return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    setPending(true);
    setError(null);
    const res = await verifyAdminTotpAction({ factorId: active, code });
    if (res.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    setPending(false);
    setError(res.error.fields?.code ?? res.error.fields?.form ?? res.error.message);
  };

  return (
    <>
      <span className="flex size-12 items-center justify-center rounded-card-sm border border-line bg-primary/15">
        <ShieldCheck aria-hidden="true" className="size-6 text-ink" />
      </span>
      <h1 className="mt-5 font-display text-2xl text-ink sm:text-[28px]">Two-step check</h1>

      {!active ? (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            The operator console needs a second step at every sign-in. Set up an authenticator app (1Password, Google Authenticator, Authy) to continue.
          </p>
          <button type="button" onClick={start} disabled={pending} className={btn("primary", "md", "mt-6 w-full")}>
            {pending ? "Setting up…" : "Set up authenticator"}
          </button>
        </>
      ) : (
        <form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-4">
          {enrol ? (
            <div>
              <p className="text-[15px] leading-relaxed text-muted">Scan this code with your authenticator app, then enter the 6 digits it shows.</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URI from the auth server */}
              <img src={enrol.qr} alt="QR code for your authenticator app" width={176} height={176} className="mx-auto mt-4 rounded-card-sm border border-border-subtle bg-white p-2" />
              <p className="mt-3 text-center text-xs text-muted">
                Can&apos;t scan? Enter this key: <span className="break-all font-mono text-ink">{enrol.secret}</span>
              </p>
            </div>
          ) : (
            <p className="text-[15px] leading-relaxed text-muted">Enter the 6-digit code from your authenticator app.</p>
          )}
          <Field id="code" label="6-digit code" error={error ?? undefined}>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              aria-invalid={!!error}
              aria-describedby={error ? "code-err" : undefined}
              className={`${input} tracking-[0.3em] tabular-nums ${error ? "border-danger" : "border-border-subtle"}`}
            />
          </Field>
          <button type="submit" disabled={pending} className={btn("primary", "md", "w-full")}>
            {pending ? "Checking…" : "Continue"}
          </button>
        </form>
      )}
      {!active && error ? (
        <p role="alert" className="mt-3 text-sm text-danger-text">
          {error}
        </p>
      ) : null}
    </>
  );
}
