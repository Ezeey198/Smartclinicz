// The table-and-form engine. Every role page configures it with its own columns, fields, tabs and actions.
import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import api, { errMsg } from "../api";
import { useAuth } from "../auth";
import { Empty, Notice, PageHead, Pill, Spinner, fmtDate, fmtDateTime, label, money } from "./ui";
import FormModal from "./FormModal";

function cell(col, row) {
  if (col.render) return col.render(row);
  const v = row[col.key];
  if (col.pill) return <Pill value={v} />;
  if (col.type === "date") return fmtDate(v);
  if (col.type === "stamp") return fmtDateTime(v);
  if (col.type === "datetime") return v ? String(v).replace("T", " ") : "";
  if (col.type === "money") return money(v);
  return col.strong ? <b>{v}</b> : v;
}

export default function DataPage({ module, endpoint, title, sub, single, empty, columns, fields, tabs, statuses, canCreate = true,
  readOnly = false, noEdit = false, createLabel, defaults, rowActions }) {
  const { user } = useAuth();
  const level = user.modules?.[module];
  const canWrite = level === "write" && !readOnly;
  const [rows, setRows] = useState(null);
  const [lists, setLists] = useState({ patients: [], doctors: [], staff: [] });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [tab, setTab] = useState(tabs?.[0]?.key);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => api.get(endpoint || `/${module}`).then((r) => setRows(r.data)).catch((e) => setMsg({ tone: "error", text: errMsg(e) }));
  useEffect(() => {
    load();
    const types = new Set((fields || []).map((f) => f.type));
    const fill = (key, url) => api.get(url).then((r) => setLists((l) => ({ ...l, [key]: r.data }))).catch(() => {});
    if (types.has("patient")) fill("patients", "/patients");
    if (types.has("doctor")) fill("doctors", "/clinic/staff?role=doctor");
    if (types.has("staff")) fill("staff", "/hr/staff");
  }, []);

  const patch = async (row, body, ok = "Updated.") => {
    try { await api.patch(`/${module}/${row.id}`, body); setMsg({ tone: "success", text: ok }); load(); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
  };
  const ctx = { patch, edit: setEdit, reload: load, notify: setMsg, user };
  const activeTab = tabs?.find((t) => t.key === tab);
  const shown = useMemo(() => (rows || []).filter((r) => (!activeTab || activeTab.filter(r, user)) && (status === "all" || r.status === status)
    && JSON.stringify(Object.values(r)).toLowerCase().includes(q.toLowerCase())), [rows, q, status, tab]);

  if (!level) return <Notice tone="error">Your role cannot open this page.</Notice>;

  return (
    <>
      <PageHead title={title} sub={sub}>
        {canWrite && canCreate && <button className="btn primary" onClick={() => setEdit({})}><Plus size={16} />{createLabel || `New ${single}`}</button>}
      </PageHead>
      {!canWrite && !readOnly && <Notice>Your role can view this page but not change it.</Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {tabs && (
        <div className="tabs-line">{tabs.map((t) => (
          <button key={t.key} className={t.key === tab ? "on" : ""} onClick={() => setTab(t.key)}>
            {t.label}{rows && <span>{rows.filter((r) => t.filter(r, user)).length}</span>}
          </button>))}
        </div>
      )}
      <div className="toolbar">
        <input className="input search" placeholder={`Search ${title.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} />
        {statuses && <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>}
      </div>
      <div className="panel">
        {!rows ? <Spinner /> : shown.length === 0 ? <Empty text={rows.length ? "Nothing matches here." : empty} /> : (
          <div className="scroll"><table className="table">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => <td key={c.key}>{cell(c, r)}</td>)}
                <td className="row-actions">
                  {(rowActions?.(r, ctx) || []).filter(Boolean).map((a) => <button key={a.label} className={`btn sm ${a.tone || "ghost"}`} onClick={a.onClick}>{a.label}</button>)}
                  {fields && <button className="icon-btn" title={canWrite && !noEdit ? "Edit" : "View"} onClick={() => setEdit(r)}>{canWrite && !noEdit ? <Pencil size={16} /> : <Eye size={16} />}</button>}
                  {user.role === "admin" && !readOnly && <button className="icon-btn danger" title="Delete"
                    onClick={() => window.confirm(`Delete this ${single}?`) && api.delete(`/${module}/${r.id}`).then(load).catch((e) => setMsg({ tone: "error", text: errMsg(e) }))}><Trash2 size={16} /></button>}
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
      {edit && fields && <FormModal module={module} single={single} fields={fields} defaults={defaults} row={edit} readOnly={!canWrite || (noEdit && !!edit.id)} lists={lists}
        onClose={() => setEdit(null)} onDone={() => { setEdit(null); setMsg({ tone: "success", text: "Saved." }); load(); }} />}
    </>
  );
}
