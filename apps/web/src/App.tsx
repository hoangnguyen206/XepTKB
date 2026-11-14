import { useEffect, useMemo, useState } from "react";
import { createPlan } from "@ky-nay/domain";
import { readBuildInfo } from "./app/build-info.js";
import { useAppController } from "./app/controller.js";
import { useOnline, usePendingUpdate } from "./app/sw-client.js";
import { AboutSheet } from "./components/AboutPanel.js";
import { AppBar } from "./components/AppBar.js";
import { BottomNav, type AppView } from "./components/BottomNav.js";
import { Notice, useMediaQuery } from "./components/common.js";
import { DataSourceSheet } from "./components/DataSourceSheet.js";
import { Onboarding, type Week1Choice } from "./components/Onboarding.js";
import { ReportIssueProvider } from "./components/ReportIssue.js";
import { StatusChips } from "./components/StatusChips.js";
import { ToastRegion, type PinnedToast } from "./components/ui/Toast.js";
import { Workspace } from "./components/Workspace.js";
import { ERROR_TEXT, datasetStatuses } from "./model/dataset-status.js";
import { INDEPENDENCE_NOTE } from "./model/labels.js";

export function App() {
  const controller = useAppController();
  const [sourceOpen, setSourceOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [view, setView] = useState<AppView>("week");
  const desktop = useMediaQuery("(min-width: 1200px)");
  const build = useMemo(() => readBuildInfo(), []);
  const pendingUpdate = usePendingUpdate();
  const online = useOnline();
  const state = controller.state;
  const ready = state.status === "ready" ? state : undefined;
  const termId = ready?.catalog.term.id;
  const draftPlan = ready && termId ? ready.plans.find((item) => item.term === termId && item.planKind === "draft") : undefined;
  const finalPlan = ready && termId ? ready.plans.find((item) => item.term === termId && item.planKind === "final") : undefined;
  const preferredSlot = ready && termId ? ready.activeSlots[termId] : undefined;
  const activeSlot: "draft" | "final" = preferredSlot === "final" && finalPlan ? "final" : !draftPlan && finalPlan ? "final" : "draft";
  const activePlan = activeSlot === "final" && finalPlan ? finalPlan : draftPlan ?? finalPlan;
  const baseDraftPlan = draftPlan ?? finalPlan;
  const hasWorkspace = Boolean(ready && activePlan && baseDraftPlan);

  // AC-M6-04: the M5 banners' conditions and sentences, shown as chips; the sheet carries the full text.
  const statuses = useMemo(
    () => (ready ? datasetStatuses({ entry: ready.dataset.entry, cachedAt: ready.dataset.cachedAt, ...(ready.cached ? { cached: ready.cached } : {}), online }) : []),
    [ready, online],
  );
  // A new term starts on the calendar again.
  useEffect(() => setView("week"), [termId]);

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
    setView("week");
  };

  // The service-worker update and the controller's storage notices stay until the user acts (DESIGN-M6-001 §6).
  const pinned: PinnedToast[] = [
    ...(pendingUpdate ? [{ id: "update", tone: "info" as const, title: "Có phiên bản mới của ứng dụng", text: "Phương án của bạn vẫn được giữ nguyên.", action: { label: "Tải lại", onClick: pendingUpdate } }] : []),
    ...controller.notices.map((notice, index) => ({ id: notice.text, tone: notice.kind, text: notice.text, onClose: () => controller.dismissNotice(index) })),
  ];

  const nav = hasWorkspace ? <BottomNav view={view} onChange={setView} placement={desktop ? "bar" : "bottom"} {...(activePlan ? { planCount: activePlan.picks.length } : {})} /> : null;

  return (
    <ReportIssueProvider build={build} {...(ready ? { dataset: ready.dataset.entry } : {})}>
      <ToastRegion pinned={pinned}>
        <a href="#main" className="skip-link">Bỏ qua tới nội dung chính</a>
        <AppBar
          {...(ready ? { entry: ready.dataset.entry } : {})}
          onOpenSource={() => setSourceOpen(true)}
          onOpenAbout={() => setAboutOpen(true)}
          chips={<StatusChips statuses={statuses} onOpen={() => setSourceOpen(true)} {...(ready ? { baselineKey: ready.dataset.entry.datasetVersion } : {})} />}
          nav={desktop ? nav : null}
        />
        <main id="main" tabIndex={-1} className={hasWorkspace && !desktop ? "has-bottom-nav" : undefined}>
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
              <p className="independence-note">{INDEPENDENCE_NOTE}</p>
            </div>
          ) : null}
          {ready && !activePlan ? (
            <>
              <Onboarding key={ready.catalog.term.id} terms={ready.terms} term={ready.catalog.term} loadingTerm={false} onSwitchTerm={(term) => void controller.switchTerm(term)} onCreate={create} />
              {/* A-M6-1: the independence sentence on the start screen (F5 moves it into Onboarding). */}
              <p className="independence-note">{INDEPENDENCE_NOTE}</p>
            </>
          ) : null}
          {ready && activePlan && baseDraftPlan ? (
            <Workspace
              key={ready.catalog.term.id}
              plan={activePlan}
              draftPlan={baseDraftPlan}
              {...(finalPlan ? { finalPlan } : {})}
              activeSlot={activeSlot}
              {...(ready.registrationNotes[ready.catalog.term.id] ? { registrationNotes: ready.registrationNotes[ready.catalog.term.id]! } : {})}
              catalog={ready.catalog}
              view={view}
              onViewChange={setView}
              onPlanChange={(next) => void controller.persistPlan(next)}
              onSelectSlot={(slot) => void controller.selectSlot(ready.catalog.term.id, slot)}
              onConfirmRegistration={(nextFinal, notes) => void controller.applyRegistrationImport(nextFinal, notes)}
              {...(finalPlan ? { onDeleteFinalPlan: () => void controller.removeFinalPlan(finalPlan.id, ready.catalog.term.id) } : {})}
              courseColors={ready.courseColors}
              onCourseColor={(code, color) => void controller.setCourseColor(code, color)}
            />
          ) : null}
        </main>
        {!desktop ? nav : null}
        {ready ? (
          <DataSourceSheet
            open={sourceOpen}
            onClose={() => setSourceOpen(false)}
            entry={ready.dataset.entry}
            cachedAt={ready.dataset.cachedAt}
            offline={!online || ready.cached?.reason === "offline"}
            statuses={statuses}
            terms={ready.terms}
            onSwitchTerm={(term) => void controller.switchTerm(term)}
          />
        ) : null}
        <AboutSheet
          open={aboutOpen}
          onClose={() => setAboutOpen(false)}
          build={build}
          {...(ready ? { entry: ready.dataset.entry } : {})}
          theme={controller.theme}
          onThemeChange={(theme) => void controller.setTheme(theme)}
          {...(controller.db() ? { db: controller.db()! } : {})}
          wipeGeneration={controller.wipeGeneration}
          onWipe={controller.wipe}
        />
      </ToastRegion>
    </ReportIssueProvider>
  );
}
