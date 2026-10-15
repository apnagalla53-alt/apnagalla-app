import { ui, useUiLanguage } from "../../i18n";
import StitchHeader from '../design/StitchHeader';
import { useEffect, useState, useRef } from "react";
import {
  UsersRound,
  ShieldCheck,
  Plus,
  MoreHorizontal,
  Ban,
  CheckCircle,
  LogOut,
  Pencil,
} from "lucide-react";
import { useAuthStore } from "../../shared/store/authStore";
import api, { getApiErrorMessage } from "../../shared/api";
import { useRetailEntitlements } from '../subscription/useRetailEntitlements';
import {
  SearchField,
  Sheet,
  ActionSheet,
  LoadingState,
  EmptyState,
  SelectionSheet,
  SegmentedControl,
} from "./MobileControls";
export default function StaffManager() {
  useUiLanguage();
  const access=useRetailEntitlements();
  const advanced=access.isFeatureEffective('ADVANCED_STAFF');
  const current = useAuthStore((s) => s.user);
  const loadVersion = useRef(0);
  const [showPassword, setShowPassword] = useState(false);
  const [resetStaff, setResetStaff] = useState<any>(null),
    [newPassword, setNewPassword] = useState("");
  const [users, setUsers] = useState<any[]>([]),
    [roles, setRoles] = useState<any[]>([]),
    [permissions, setPermissions] = useState<any[]>([]),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [tab, setTab] = useState("staff"),
    [actions, setActions] = useState<any>(null),
    [edit, setEdit] = useState<any>(null),
    [roleUser, setRoleUser] = useState<any>(null),
    [role, setRole] = useState<any>(null),
    [newRole, setNewRole] = useState(false),
    [roleName, setRoleName] = useState("");
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    password: "",
    phone: "",
    email: "",
  });
  const load = async (position = offset) => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const [u, r] = await Promise.all([
        api.get("/users", {
          params: { q: query, limit: 30, offset: position },
        }),
        api.get("/roles", { params: { limit: 100 } }),
      ]);
      if (version !== loadVersion.current) return;
      setUsers((p) => (position ? [...p, ...u.data] : u.data));
      setMore(u.data.length === 30);
      setRoles(r.data);
    } catch (e) {
      if (version === loadVersion.current) setError(getApiErrorMessage(e));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };
  useEffect(() => {
    loadVersion.current++;
    setLoading(true);
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [query, offset]);
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(message);
      setOffset(0);
      await load(0);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const openRole = async (r: any) => {
    setRole(r);
    setError("");
    try {
      let list: any[] = [];
      for (let position = 0; ; position += 100) {
        const p = await api.get("/permissions", {
          params: { offset: position, limit: 100 },
        });
        list.push(...p.data);
        if (p.data.length < 100) break;
      }
      setPermissions(list);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };
  const groups = Array.from(
    new Set(permissions.map((p) => p.code.split(".")[0])),
  ) as string[];
  return (
    <><StitchHeader><h1>{ui('Staff & Permissions')}</h1></StitchHeader><main className="r-section r-stitch-staff">
      <section className="r-card r-stitch-intro"><span className="r-ledger-icon"><ShieldCheck size={28}/></span><div><h2>{ui('Staff & Permissions')}</h2><p className="r-caption">{ui('Give each team member access to the tools they need in your shop.')}</p></div></section>
      <div className="r-section-heading">
        <button
          className="r-btn r-btn--primary r-w-full"
          onClick={() => {
            setEdit({ create: true });
            setForm({
              display_name: "",
              username: "",
              password: "",
              phone: "",
              email: "",
            });
            setError("");
          }}
        >
          <Plus size={19} />
          Add Staff
        </button>
      </div>
      <p className="r-caption">
        Give each team member access to the tools they need in your shop.
      </p>
      <SegmentedControl
        label="Staff view"
        value={tab}
        onChange={setTab}
        options={[
          { value: "staff", label: "Staff", Icon: UsersRound },
          ...(advanced?[{ value: "roles", label: "Roles & Permissions", Icon: ShieldCheck }]:[]),
        ]}
      />
      {error && (
        <p className="r-state-message" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status" data-tone="success">{notice}</p>}
      {tab === "staff" ? (
        <>
          <SearchField
            label="Search staff"
            placeholder="Name, phone or username"
            value={query}
            onChange={(s) => {
              setQuery(s);
              setOffset(0);
            }}
          />
          {loading ? (
            <LoadingState label="Loading staff…" />
          ) : !users.length ? (
            <EmptyState
              title="No staff found"
              description="Add your team to give each person their own access."
              action="Add Staff"
              onAction={() => setEdit({ create: true })}
            />
          ) : (
            users.map((u) => (
              <article className="r-card" key={u.id}>
                <div className="r-section-heading">
                  <h2>{u.display_name || u.username}</h2>
                  <button
                    className="r-btn r-btn--icon"
                    aria-label={"Actions for " + u.display_name}
                    onClick={() => setActions(u)}
                  >
                    <MoreHorizontal size={22} />
                  </button>
                </div>
                <p className="r-caption">{u.phone || u.email || u.username}</p>
                <p>
                  {(u.roles || [])
                    .map((r: any) => r.name || r.role?.name)
                    .join(", ") || "No role assigned"}
                </p>
                <span className="r-badge">
                  {u.is_active ? "Active" : "Disabled"}
                  {u.is_locked ? " · Locked" : ""}
                </span>
              </article>
            ))
          )}
          {more && (
            <button
              className="r-btn r-w-full"
              onClick={() => setOffset((n) => n + 30)}
            >
              Load More Staff
            </button>
          )}
        </>
      ) : (
        <>
          <button
            className="r-btn r-btn--outline r-w-full"
            onClick={() => {
              setNewRole(true);
              setRoleName("");
            }}
          >
            Create Role
          </button>
          {roles.map((r) => (
            <button
              className="r-card r-sheet-option"
              key={r.id}
              onClick={() => void openRole(r)}
            >
              <ShieldCheck size={23} />
              <span>
                <strong>{r.name}</strong>
                <small>
                  {r.permissions?.length || 0} permissions
                  {r.is_system ? " · Protected role" : ""}
                </small>
              </span>
            </button>
          ))}
        </>
      )}
      <ActionSheet
        open={!!actions}
        onClose={() => setActions(null)}
        title={actions?.display_name || "Staff actions"}
        actions={
          actions
            ? [
                {
                  label: "Edit Details",
                  Icon: Pencil,
                  onAction: () => {
                    setEdit(actions);
                    setForm({
                      display_name: actions.display_name,
                      username: actions.username,
                      password: "",
                      phone: actions.phone || "",
                      email: actions.email || "",
                    });
                  },
                },
                ...(advanced?[{
                  label: "Assign Roles",
                  Icon: ShieldCheck,
                  onAction: () => setRoleUser(actions),
                }]:[]),
                ...(actions.id !== current?.id
                  ? [
                      {
                        label: "Reset Password",
                        tone: 'warning' as const,
                        Icon: ShieldCheck,
                        onAction: () => {
                          setResetStaff(actions);
                          setNewPassword("");
                          setError("");
                        },
                      },
                      ...(actions.is_locked
                        ? [
                            {
                              label: "Unlock Account",
                              tone: 'success' as const,
                              Icon: CheckCircle,
                              onAction: () =>
                                void run(
                                  () =>
                                    api.patch(
                                      "/users/" + actions.id + "/unlock",
                                    ),
                                  "Account unlocked.",
                                ),
                            },
                          ]
                        : []),
                      {
                        label: actions.is_active
                          ? "Disable Access"
                          : "Enable Access",
                        Icon: actions.is_active ? Ban : CheckCircle,
                        tone: actions.is_active ? 'danger' as const : 'success' as const,
                        onAction: () =>
                          void run(
                            () =>
                              api.patch(
                                "/users/" +
                                  actions.id +
                                  "/" +
                                  (actions.is_active ? "disable" : "enable"),
                              ),
                            "Staff access updated.",
                          ),
                      },
                      {
                        label: "Revoke Logged-in Devices",
                        tone: 'danger' as const,
                        Icon: LogOut,
                        onAction: () =>
                          void run(
                            () =>
                              api.post(
                                "/users/" + actions.id + "/sessions/revoke-all",
                              ),
                            "Staff devices revoked.",
                          ),
                      },
                    ]
                  : []),
              ]
            : []
        }
      />
      {edit && (
        <Sheet
          open
          onClose={() => setEdit(null)}
          title={edit.create ? "Add Staff" : "Edit Staff"}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await (edit.create
                  ? api.post("/users", {...form, username:form.phone})
                  : api.patch("/users/" + edit.id, {
                      display_name: form.display_name,
                      phone: form.phone,
                      email: form.email,
                    }));
                setEdit(null);
              }, "Staff details saved.");
            }}
          >
            {[
              "display_name",
              ...(edit.create ? ["password"] : []),
              "phone",
              "email",
            ].map((key) => (
              <div className="r-input-group" key={key}>
                <label htmlFor={"staff-" + key}>
                  {
                    (
                      {
                        display_name: "Full name",
                        username: "Username",
                        password: "Temporary password (8+ characters)",
                        phone: "Staff mobile number / username",
                        email: "Email (optional)",
                      } as any
                    )[key]
                  }
                </label>
                <input
                  id={"staff-" + key}
                  className="r-input"
                  type={
                    key === "password"
                      ? showPassword ? "text" : "password"
                      : key === "phone"
                        ? "tel"
                        : key === "email"
                          ? "email"
                          : "text"
                  }
                  minLength={key === "password" ? 8 : undefined}
                  maxLength={key === "password" ? 72 : key === "phone" ? 20 : 255}
                  autoComplete={key === 'password' ? 'new-password' : key === 'phone' ? 'tel' : undefined}
                  required={["display_name", "phone", "password"].includes(
                    key,
                  )}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            {edit.create && <><label className="r-toggle-row"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/>Show password</label><p className="r-caption">Use at least 8 characters. The staff member signs in with this mobile number and chooses their own password on first login.</p></>}
            {error && <p role="alert">{error}</p>}
            <button className="r-btn r-btn--primary r-w-full" disabled={busy}>
              {busy ? ui("Saving…") : "Save Staff"}
            </button>
          </form>
        </Sheet>
      )}
      <SelectionSheet
        open={!!roleUser}
        onClose={() => setRoleUser(null)}
        title="Assign Staff Roles"
        multiple
        options={roles.map((r) => ({
          value: r.id,
          label: r.name,
          description: r.is_system ? "Protected role" : "Shop role",
          disabled: busy,
          Icon: ShieldCheck,
        }))}
        value={(roleUser?.roles || []).map((r: any) => r.id)}
        onSelect={(id) =>
          void run(async () => {
            const assigned = roleUser.roles.some((r: any) => r.id === id);
            await (assigned
              ? api.delete("/users/" + roleUser.id + "/roles/" + id)
              : api.post(
                  "/users/" + roleUser.id + "/roles",
                  {},
                  { params: { role_id: id } },
                ));
            const r = await api.get("/users/" + roleUser.id);
            setRoleUser(r.data);
          }, "Role assignment saved.")
        }
        error={error || undefined}
      />
      {role && (
        <Sheet
          open
          onClose={() => setRole(null)}
          title={role.name + " Permissions"}
        >
          <p className="r-caption">
            {role.is_system
              ? "This protected role is read-only. Create a shop role for custom access."
              : "Changes apply to everyone with this role."}
          </p>
          {groups.map((group) => (
            <fieldset className="r-fieldset r-card" key={group}>
              <legend>{group.replaceAll("_", " ")}</legend>
              {permissions
                .filter((p) => p.code.startsWith(group + "."))
                .map((p) => (
                  <label className="r-toggle-row" key={p.code}>
                    <span>
                      {p.description || p.code.split(".").slice(1).join(" ")}
                    </span>
                    <input
                      type="checkbox"
                      disabled={role.is_system || busy}
                      checked={role.permissions.some(
                        (rp: any) => rp.code === p.code,
                      )}
                      onChange={(e) => {
                        const enabled = e.target.checked,
                          previous = role;
                        setRole({
                          ...role,
                          permissions: enabled
                            ? [...role.permissions, { id: p.id, code: p.code }]
                            : role.permissions.filter(
                                (rp: any) => rp.code !== p.code,
                              ),
                        });
                        void run(async () => {
                          try {
                            await (enabled
                              ? api.post(
                                  "/roles/" + role.id + "/permissions",
                                  {},
                                  { params: { permission_code: p.code } },
                                )
                              : api.delete(
                                  "/roles/" +
                                    role.id +
                                    "/permissions/" +
                                    encodeURIComponent(p.code),
                                ));
                            const refreshed = (await api.get("/roles/" + previous.id)).data;
                            // A completed save must not reopen a sheet the owner closed.
                            setRole((currentRole: any) => currentRole?.id === previous.id ? refreshed : currentRole);
                          } catch (e) {
                            setRole((currentRole: any) => currentRole?.id === previous.id ? previous : currentRole);
                            throw e;
                          }
                        }, "Permission saved.");
                      }}
                    />
                  </label>
                ))}
            </fieldset>
          ))}
          {error && <p role="alert">{error}</p>}
        </Sheet>
      )}
      <Sheet
        open={newRole}
        onClose={() => setNewRole(false)}
        title="Create Shop Role"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.post("/roles", { name: roleName.trim() });
              setNewRole(false);
            }, "Role created. Open it to choose permissions.");
          }}
        >
          <label htmlFor="staff-role-name">Role name</label>
          <input
            id="staff-role-name"
            className="r-input"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            required
            maxLength={100}
          />
          {error && <p role="alert">{error}</p>}
          <button className="r-btn r-btn--primary r-w-full" disabled={busy}>
            Create Role
          </button>
        </form>
      </Sheet>
      <Sheet
        open={!!resetStaff}
        onClose={() => setResetStaff(null)}
        title="Reset Staff Password"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.patch("/users/" + resetStaff.id + "/reset-password", {
                new_password: newPassword,
              });
              setResetStaff(null);
              setNewPassword("");
            }, "Temporary password reset. Existing sessions were revoked.");
          }}
        >
          <label htmlFor="staff-new-password">
            New temporary password (8+ characters)
          </label>
          <input
            id="staff-new-password"
            className="r-input"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <p className="r-caption">
            Use at least 8 characters. Uppercase letters, numbers and symbols are optional. The staff
            member must change this password when signing in.
          </p>
          <label className="r-toggle-row"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/>Show password</label>
          {error && <p role="alert">{error}</p>}
          <button className="r-btn r-btn--primary r-w-full" disabled={busy}>
            Reset Password
          </button>
        </form>
      </Sheet>
    </main></>
  );
}
