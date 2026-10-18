"use client";
import { useState } from "react";
import { crm } from "@/lib/crmApi";
import type { User } from "@/lib/propApi";
import { useSessionUser } from "@/components/portal/SessionContext";
import { Card, cx, LoadState } from "@/components/portal/ui";
import { Badge, inputCls, PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";
import { ConfirmAction, dangerLink, fmtDateTime, linkBtn, matches, Person, SearchBox, useAdmin } from "@/components/crm/kit";

type Filter = "trader" | "staff" | "blocked" | "all";
const ROLES: User["role"][] = ["trader", "affiliate", "support", "admin"];
const STATUSES: User["status"][] = ["active", "suspended", "banned"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Pending =
  | { kind: "role"; u: User; value: User["role"] }
  | { kind: "status"; u: User; value: User["status"] }
  | { kind: "password"; u: User }
  | { kind: "impersonate"; u: User };

export default function UsersDesk() {
  const me = useSessionUser();
  const { data, error, loading, reload } = useAdmin(() => crm.users.list());
  const [filter, setFilter] = useState<Filter>("trader");
  const [q, setQ] = useState("");
  const [act, setAct] = useState<Pending | null>(null);

  const users = data?.users ?? [];
  const inTab = (u: User, f: Filter) =>
    f === "all" ? true : f === "staff" ? u.role === "admin" || u.role === "support" : f === "blocked" ? u.status !== "active" : u.role === "trader" || u.role === "affiliate";
  const list = users.filter((u) => inTab(u, filter) && matches(q, u.name, u.email, u.id, u.country, u.phone));

  const title =
    act?.kind === "role"
      ? `Make ${act.u.name} ${act.value === "admin" ? "an" : "a"} ${act.value}?`
      : act?.kind === "status"
        ? `${act.value === "active" ? "Reactivate" : cap(act.value === "banned" ? "ban" : "suspend")} ${act.u.name}?`
        : act?.kind === "password"
          ? `Set a new password for ${act.u.name}`
          : `Sign in as ${act?.u.name}?`;

  return (
    <div className="space-y-5">
      <PageHeader title="Users" sub="Traders and staff accounts." />
      <Card>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<Filter>
            tabs={(
              [
                ["trader", "Traders"],
                ["staff", "Staff"],
                ["blocked", "Suspended / banned"],
                ["all", "All"],
              ] as [Filter, string][]
            ).map(([key, label]) => ({ key, label, count: users.filter((u) => inTab(u, key)).length }))}
            value={filter}
            onChange={setFilter}
          />
          <SearchBox value={q} onChange={setQ} placeholder="Search name, email, country…" />
        </div>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error && (
          <div className={tableWrap}>
            <table className="w-full min-w-[1000px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>User</th>
                  <th className={thCls}>Country</th>
                  <th className={thCls}>Joined</th>
                  <th className={thCls}>Email</th>
                  <th className={thCls}>Role</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 300).map((u) => {
                  const self = u.id === me.id;
                  return (
                    <tr key={u.id} className={trCls}>
                      <td className={cx(tdCls, "max-w-[260px]")}>
                        <Person name={u.name} email={u.email} />
                      </td>
                      <td className={tdCls}>{u.country || "—"}</td>
                      <td className={cx(tdCls, "text-[12.5px] text-muted")}>{fmtDateTime(u.createdAt)}</td>
                      <td className={tdCls}>
                        <Badge tone={u.emailVerified === false ? "warning" : "success"}>{u.emailVerified === false ? "Unverified" : "Verified"}</Badge>
                      </td>
                      <td className={tdCls}>
                        <select
                          aria-label={`Role of ${u.name}`}
                          disabled={self}
                          className={cx(inputCls, "h-9 w-32 py-0 text-[13px]")}
                          value={u.role}
                          onChange={(e) => setAct({ kind: "role", u, value: e.target.value as User["role"] })}
                        >
                          {[...new Set([u.role, ...ROLES])].map((r) => (
                            <option key={r} value={r}>
                              {cap(r)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={tdCls}>
                        <select
                          aria-label={`Status of ${u.name}`}
                          disabled={self}
                          className={cx(inputCls, "h-9 w-32 py-0 text-[13px]")}
                          value={u.status}
                          onChange={(e) => setAct({ kind: "status", u, value: e.target.value as User["status"] })}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {cap(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => setAct({ kind: "password", u })} className={linkBtn}>
                            Reset password
                          </button>
                          {!self && u.role !== "admin" && u.role !== "support" && (
                            <button type="button" onClick={() => setAct({ kind: "impersonate", u })} className={dangerLink}>
                              Sign in as
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!list.length && (
                  <tr>
                    <td colSpan={7} className={cx(tdCls, "py-10 text-center text-muted")}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {list.length > 300 && <p className="border-t border-line px-4 py-3 text-[13px] text-muted">Showing 300 of {list.length}. Search to narrow down.</p>}
          </div>
        )}
      </Card>

      <ConfirmAction
        open={!!act}
        danger={act?.kind === "impersonate" || (act?.kind === "status" && act.value !== "active") || (act?.kind === "role" && act.value === "admin")}
        title={title}
        body={
          act?.kind === "role" ? (
            act.value === "admin" ? "Admins can see every trader, change orders, deliver accounts and approve payouts." : `Role changes from ${act.u.role} to ${act.value}.`
          ) : act?.kind === "status" ? (
            act.value === "active" ? "The user can sign in again." : "The user is signed out of the portal and cannot sign in."
          ) : act?.kind === "password" ? (
            "Share the new password with the user through a secure channel. At least 8 characters."
          ) : (
            "Your browser session switches to this trader. You will be signed out of the CRM and need to sign in again to come back. This is recorded in the audit log."
          )
        }
        withNote={act?.kind === "password" ? "New password" : undefined}
        confirmLabel={act?.kind === "impersonate" ? "Sign in as trader" : "Confirm"}
        onCancel={() => setAct(null)}
        onConfirm={async (note) => {
          const a = act!;
          if (a.kind === "role") await crm.users.update({ userId: a.u.id, role: a.value });
          else if (a.kind === "status") await crm.users.update({ userId: a.u.id, status: a.value });
          else if (a.kind === "password") {
            if (note.length < 8) throw new Error("Password must be at least 8 characters.");
            await crm.users.update({ userId: a.u.id, newPassword: note });
          } else {
            await crm.users.impersonate(a.u.id);
            window.location.href = "/dashboard";
            return;
          }
          setAct(null);
          reload();
        }}
      />
    </div>
  );
}
