import { useId, useState, type ChangeEvent } from "react";
import type { Plan } from "@ky-nay/domain";
import { MAX_REGISTRATION_BYTES } from "@ky-nay/parser/registration";
import type { AppCatalog } from "../model/catalog.js";
import { buildRegistrationPreview, type RegistrationImportPreview } from "../model/registration.js";
import type { TermRegistrationNotes } from "../storage/local-data.js";
import { Notice } from "./common.js";
import { isInAppBrowser } from "./ExportPanel.js";

function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error("Không đọc được file."));
    reader.readAsArrayBuffer(file);
  });
}

export function RegistrationImportPanel(props: {
  catalog: AppCatalog;
  draftPlan: Plan;
  existingFinalPlan?: Plan;
  onConfirm: (finalPlan: Plan, notes: TermRegistrationNotes) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [preview, setPreview] = useState<RegistrationImportPreview | undefined>(undefined);
  const [readingError, setReadingError] = useState<string | undefined>(undefined);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const inputEl = event.currentTarget;
    const file = inputEl.files?.[0];
    if (!file) return;
    setReadingError(undefined);

    // Check size before allocating memory for oversized files; clear the input value so the filename is not retained in DOM.
    const size = file.size;
    if (size === 0) {
      inputEl.value = "";
      setPreview({
        ok: false,
        fatalError: "File rỗng. Hãy chọn file Kết quả đăng ký môn học (.doc hoặc .html) tải từ cổng đào tạo.",
        isUpdate: props.existingFinalPlan !== undefined,
        matched: [],
        overrides: [],
        unmatched: [],
        warnings: [],
      });
      return;
    }
    if (size > MAX_REGISTRATION_BYTES) {
      inputEl.value = "";
      setPreview({
        ok: false,
        fatalError: "File vượt quá giới hạn 2 MB. File Kết quả đăng ký môn học từ cổng đào tạo thường chỉ vài chục KB.",
        isUpdate: props.existingFinalPlan !== undefined,
        matched: [],
        overrides: [],
        unmatched: [],
        warnings: [],
      });
      return;
    }

    try {
      const bytes = await readFileBytes(file);
      inputEl.value = "";
      const result = buildRegistrationPreview({
        bytes,
        catalog: props.catalog,
        draftPlan: props.draftPlan,
        ...(props.existingFinalPlan ? { existingFinalPlan: props.existingFinalPlan } : {}),
      });
      setPreview(result);
    } catch {
      inputEl.value = "";
      setPreview(undefined);
      setReadingError("Không đọc được file đã chọn. Hãy thử lại.");
    }
  };

  return (
    <section className="card registration-import" aria-labelledby={`${id}-heading`}>
      <div className="section-head">
        <h3 id={`${id}-heading`}>Nhập kết quả đăng ký môn học (ĐKMH)</h3>
        <button type="button" className="button secondary small" onClick={props.onClose}>Đóng</button>
      </div>
      {isInAppBrowser() ? (
        <Notice tone="warning" title="Bạn đang mở trong ứng dụng (Facebook/Messenger/Zalo…)">
          Trình duyệt trong ứng dụng có thể chặn chọn file từ máy. Hãy chọn “Mở bằng trình duyệt” trong menu rồi thử lại.
        </Notice>
      ) : null}
      <p className="muted">
        Chỉ xử lý ngay trên thiết bị này: ứng dụng chỉ lấy mã lớp, thứ, tiết, phòng học để đối chiếu với thời khóa biểu. Họ tên, mã sinh viên, ngày sinh, học phí và tên file được loại bỏ hoàn toàn, không lưu và không gửi đi đâu.
      </p>
      <div className="field">
        <label htmlFor={`${id}-file`}>Chọn file Kết quả đăng ký môn học (.doc, .htm, .html)</label>
        <input
          id={`${id}-file`}
          type="file"
          accept=".doc,.htm,.html,text/html,application/msword"
          onChange={(event) => void onFileChange(event)}
        />
        <span className="field-hint">Tải file “Kết quả đăng ký môn học” (.doc dạng HTML) từ cổng đào tạo rồi chọn tại đây. Phương án nháp của bạn luôn được giữ nguyên.</span>
      </div>

      {readingError ? <Notice tone="error">{readingError}</Notice> : null}

      {preview && !preview.ok ? (
        <Notice tone="error" title="Không đọc được file kết quả đăng ký">
          {preview.fatalError}
        </Notice>
      ) : null}

      {preview && preview.ok && preview.plan ? (
        <div className="registration-preview" role="region" aria-labelledby={`${id}-preview-heading`}>
          <h4 id={`${id}-preview-heading`}>
            Xem trước trước khi lưu: {preview.matched.length} lớp khớp TKB
            {preview.overrides.length > 0 ? ` · ${preview.overrides.length} thay đổi phòng/giờ/tuần` : ""}
            {preview.unmatched.length > 0 ? ` · ${preview.unmatched.length} lớp không khớp` : ""}
          </h4>

          {preview.matched.length === 0 ? (
            <Notice tone="warning" title="Không có lớp nào khớp với thời khóa biểu đang dùng">
              Các lớp trong file không tìm thấy trong dữ liệu {props.catalog.term.name} ({props.catalog.entry.datasetVersion}). Hãy kiểm tra xem bạn đã chọn đúng học kỳ chưa.
            </Notice>
          ) : null}

          {preview.overrides.length > 0 ? (
            <div className="preview-block">
              <h5>Thay đổi phát hiện từ kết quả ĐKMH ({preview.overrides.length})</h5>
              <ul className="override-preview-list">
                {preview.overrides.map((item) => (
                  <li key={`${item.sectionId}|${item.sessionId}|${item.field}`}>
                    <span className="badge badge-override">{item.badge}</span>{" "}
                    <strong>{item.sectionId}</strong> ({item.courseName}) — {item.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="ok-text">✓ Phòng học và giờ học trong file ĐKMH khớp với thời khóa biểu đã công bố.</p>
          )}

          {preview.matched.length > 0 ? (
            <div className="preview-block">
              <h5>Lớp học phần sẽ đưa vào Phương án chính thức ({preview.matched.length})</h5>
              <ul className="matched-preview-list">
                {preview.matched.map((item) => {
                  const uniqueBadges = [...new Set(item.overrides.map((ov) => ov.badge))];
                  return (
                    <li key={item.sectionId}>
                      <div>
                        <strong>{item.sectionId}</strong> — {item.courseName}
                        {item.group ? ` · nhóm ${item.group}` : ""}
                        {item.credits !== undefined ? ` · ${item.credits} TC` : " · chưa rõ tín chỉ"}
                        <div className="badges">
                          {uniqueBadges.map((badge) => (
                            <span key={badge} className="badge badge-override">{badge}</span>
                          ))}
                          {item.needsGroup ? (
                            <span className="badge badge-conflict">⚠ Cần chọn nhóm sau khi lưu</span>
                          ) : null}
                          {item.defaultedWeeks ? (
                            <span className="badge badge-override">Tuần TH mặc định (2–{props.catalog.term.teachingWeeks})</span>
                          ) : null}
                        </div>
                        <div className="muted">{item.sessionsSummary.join(" | ")}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {preview.unmatched.length > 0 ? (
            <Notice tone="warning" title={`Có ${preview.unmatched.length} lớp trong file ĐKMH không khớp dữ liệu TKB`}>
              <p>Các lớp dưới đây không có (hoặc bị trùng mã) trong dữ liệu thời khóa biểu đang dùng nên không được thêm tự động vào Phương án chính thức:</p>
              <ul>
                {preview.unmatched.map((item) => (
                  <li key={item.sectionId}>
                    <strong>{item.sectionId}</strong> (môn {item.courseCode}): {item.sessionsSummary.join("; ")}{" "}
                    ({item.reason === "ambiguous" ? "khớp nhiều lớp trên TKB" : "không có trong TKB"})
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}

          {preview.warnings.length > 0 ? (
            <Notice tone="info" title="Lưu ý khi đối chiếu file ĐKMH">
              <ul>
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          <div className="actions">
            <button
              type="button"
              className="button primary"
              onClick={() => props.onConfirm(preview.plan!, { unmatched: preview.unmatched, warnings: preview.warnings })}
            >
              {preview.isUpdate ? "Xác nhận cập nhật Phương án chính thức" : "Áp dụng vào Phương án chính thức"}
            </button>
            <button type="button" className="button secondary" onClick={props.onClose}>
              Hủy
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
