import { useState } from "react";
import { createPlan } from "@ky-nay/domain";
import { useAppController, type Ready } from "./app/controller.js";
import { useOnline, usePendingUpdate } from "./app/sw-client.js";
import { Footer, Header, ProvenancePanel } from "./components/Chrome.js";
import { Notice } from "./components/common.js";
import { Onboarding, type Week1Choice } from "./components/Onboarding.js";
import { Workspace } from "./components/Workspace.js";
import type { ArtifactError } from "./data/contract.js";
import { SYNTHETIC_NOTE, formatInstant, isSynthetic, statusLabel } from "./model/labels.js";

const ERROR_TEXT: Record<ArtifactError["code"], string> = {
  MANIFEST_UNAVAILABLE: "Không kết nối được tới nguồn dữ liệu.",
  INVALID_MANIFEST: "Danh mục dữ liệu không hợp lệ.",
  NO_DATASET: "Chưa có dữ liệu thời khóa biểu được công bố cho kỳ này.",
  INVALID_ARTIFACT: "Dữ liệu tải về không hợp lệ.",
  HASH_MISMATCH: "Dữ liệu tải về không khớp mã kiểm tra (có thể bị hỏng hoặc bị thay đổi).",
  SCHEMA_UNSUPPORTED: "Dữ liệu dùng định dạng mà phiên bản ứng dụng này chưa hỗ trợ.",
  DOMAIN_INVALID: "Dữ liệu vi phạm quy tắc thời khóa biểu nên đã bị từ chối.",
  TOO_LARGE: "Dữ liệu tải về vượt giới hạn kích thước.",
  INSECURE_CONTEXT: "Trình duyệt không kiểm tra được dữ liệu vì trang không được mở qua HTTPS. Hãy mở bằng địa chỉ https://.",
};

function DatasetBanners(props: { ready: Ready; online: boolean }) {
  const { entry } = props.ready.dataset;
  const cached = props.ready.cached;
  return (
    <>
      {isSynthetic(entry) ? <Notice tone="warning" title="Dữ liệu mẫu">{SYNTHETIC_NOTE}</Notice> : null}
      {/* ADR-0010 §2 rule 4: every unpublished dataset says so, synthetic ones included (REV-M3-009d). */}
      {entry.status !== "published" ? (
        <Notice tone="warning" title="Dữ liệu chưa được công bố">Bộ dữ liệu này đang ở trạng thái “{statusLabel(entry.status)}”, chỉ dùng để thử nghiệm.</Notice>
      ) : null}
      {!props.online || cached?.reason === "offline" ? (
        <Notice tone="info" title="Đang ngoại tuyến">Bạn vẫn xem và xuất được phương án. Dữ liệu đang dùng được lưu lúc {formatInstant(props.ready.dataset.cachedAt)}.</Notice>
      ) : null}
      {cached?.reason === "invalid" ? (
        <Notice tone="error" title="Không cập nhật được dữ liệu">{ERROR_TEXT[cached.error.code]} Ứng dụng tiếp tục dùng bản đã lưu lúc {formatInstant(props.ready.dataset.cachedAt)}.</Notice>
      ) : null}
    </>
  );
}

export function App() {
  const controller = useAppController();
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const pendingUpdate = usePendingUpdate();
  const online = useOnline();
  const state = controller.state;
  const ready = state.status === "ready" ? state : undefined;
  const plan = ready?.plans.find((item) => item.term === ready.catalog.term.id && item.planKind === "draft");

  const create = (choice: Week1Choice) => {
    if (!ready) return;
    const now = new Date().toISOString();
    void controller.persistPlan(createPlan({
      id: crypto.randomUUID(),
      term: ready.catalog.term.id,
      datasetVersion: ready.catalog.entry.datasetVersion,
      name: "Phương án nháp",
      planKind: "draft",
      ...(choice.cohort ? { cohort: choice.cohort } : {}),
      ...(choice.week1 ? { week1: choice.week1 } : {}),
    }, now));
  };

  return (
    <>
      <a href="#main" className="skip-link">Bỏ qua tới nội dung chính</a>
      <Header {...(ready ? { entry: ready.dataset.entry } : {})} provenanceOpen={provenanceOpen} onToggleProvenance={() => setProvenanceOpen((open) => !open)} />
      <main id="main" tabIndex={-1}>
        {pendingUpdate ? (
          <Notice tone="info" title="Có phiên bản mới của ứng dụng" action={<button type="button" className="button primary" onClick={pendingUpdate}>Tải lại</button>}>
            Phương án của bạn vẫn được giữ nguyên.
          </Notice>
        ) : null}
        {controller.notices.map((notice, index) => (
          <Notice key={notice.text} tone={notice.kind} action={<button type="button" className="button secondary small" onClick={() => controller.dismissNotice(index)}>Đóng</button>}>{notice.text}</Notice>
        ))}
        {ready ? <DatasetBanners ready={ready} online={online} /> : null}
        {ready && provenanceOpen ? <ProvenancePanel entry={ready.dataset.entry} cachedAt={ready.dataset.cachedAt} offline={!online || ready.cached?.reason === "offline"} /> : null}
        {state.status === "loading" ? <p className="loading" role="status">Đang tải dữ liệu thời khóa biểu…</p> : null}
        {state.status === "unavailable" ? (
          <div className="card">
            <h2>Chưa xem được thời khóa biểu</h2>
            <Notice tone="error">{ERROR_TEXT[state.error.code]}{state.error.code === "MANIFEST_UNAVAILABLE" ? " Lần đầu sử dụng cần có kết nối mạng để tải dữ liệu." : ""}</Notice>
            <div className="actions">
              <button type="button" className="button primary" onClick={() => void controller.retry()}>Thử lại</button>
              {state.terms.map((term) => (
                <button key={term.term} type="button" className="button secondary" onClick={() => void controller.switchTerm(term.term)}>Xem {term.termName}</button>
              ))}
            </div>
          </div>
        ) : null}
        {ready && !plan ? (
          <Onboarding key={ready.catalog.term.id} terms={ready.terms} term={ready.catalog.term} loadingTerm={false} onSwitchTerm={(term) => void controller.switchTerm(term)} onCreate={create} />
        ) : null}
        {ready && plan ? <Workspace key={plan.id} plan={plan} catalog={ready.catalog} onPlanChange={(next) => void controller.persistPlan(next)} /> : null}
        {ready && plan && ready.terms.length > 1 ? (
          <div className="term-switch">
            <label htmlFor="term-switch">Đổi học kỳ</label>
            <select id="term-switch" value={ready.catalog.term.id} onChange={(event) => void controller.switchTerm(event.target.value)}>
              {ready.terms.map((term) => <option key={term.term} value={term.term}>{term.termName}</option>)}
            </select>
          </div>
        ) : null}
      </main>
      <Footer {...(controller.db() ? { db: controller.db()! } : {})} onWipe={controller.wipe} />
    </>
  );
}
