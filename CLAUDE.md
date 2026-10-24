# Kỳ Này — Hướng dẫn làm việc cho Claude Code và Agent

> **Status:** draft / M0–M2 implementation present; app/release gates pending
> **Owner:** Tech Lead  
> **Last reviewed:** 2026-10-20
> **Source of truth:** các tài liệu trong `docs/`; bản brief chỉ là nguồn đầu vào ban đầu.
> **Related docs:** [docs index](docs/README.md), [Agent workflow](.claude/AGENT_WORKFLOW.md)

## 1. Bối cảnh

Kỳ Này (tên làm việc, chưa chốt thương hiệu) là web app/PWA giúp sinh viên UET xếp thời khóa biểu từ dữ liệu trường phát hành. MVP tập trung UET, chạy tốt trên điện thoại nhưng không bỏ qua desktop. Repository hiện có foundation, parser và M2 domain engine packages; chưa có mã nguồn ứng dụng web/PWA.

Mốc kinh doanh/kỹ thuật cần ưu tiên là khi trường công bố TKB học kỳ II năm học 2026–2027, dự kiến tuần **09–15/11/2026**. Nếu không kịp, cắt scope theo [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md), không âm thầm hạ chất lượng parser hoặc privacy.

## 2. Thứ tự đọc bắt buộc

1. [docs/README.md](docs/README.md) — bản đồ tài liệu và trạng thái quyết định.
2. [docs/PRD.md](docs/PRD.md) — scope, người dùng, acceptance criteria.
3. [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — phase, gate, dependency.
4. [docs/TECH_STACK.md](docs/TECH_STACK.md) và [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — boundary kỹ thuật.
5. [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) và [docs/PARSER_SPEC.md](docs/PARSER_SPEC.md) — dữ liệu lõi.
6. [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md) và [docs/QA_TEST_PLAN.md](docs/QA_TEST_PLAN.md) — các gate không được bỏ qua.
7. Role contract tương ứng trong `.claude/agents/` và [`.claude/AGENT_WORKFLOW.md`](.claude/AGENT_WORKFLOW.md).

Bản brief gốc là `Kế hoạch sản phẩm – Tool xếp TKB cho sinh viên VNU.md`; đọc khi cần kiểm chứng nguồn, không sửa file này trong một task triển khai thông thường. SHA-256 tại thời điểm dựng bộ docs: `295BB158F14D9C3C23F920A0CFF7A5DBDC1B76FC88885AFE9992FBA55D650B1E`.

## 3. Nguyên tắc bất biến

- **MVP UET-first:** không mở rộng sang trường khác trước khi parser, dữ liệu và vận hành UET ổn định.
- **Mobile-first, desktop-capable:** thiết kế từ viewport 360px; desktop phải có workflow hiệu quả, không chỉ phóng to giao diện.
- **Local-first:** file kết quả đăng ký (`.doc`/HTML đổi đuôi) được parse trên máy người dùng. Không upload file, họ tên, ngày sinh, mã sinh viên hay mật khẩu cổng trường.
- **Không tự động đăng ký:** không xin hoặc xử lý credential cổng sinh viên, không cào dữ liệu sau đăng nhập, không thay người dùng đăng ký.
- **Deterministic-first:** regex, schema, bảng từ đồng nghĩa và validator chạy trước. LLM chỉ là fallback ở luồng admin, đầu ra là bản nháp có schema và cần duyệt.
- **Period là đơn vị gốc:** ca chỉ là nhóm tiết; conflict tính theo `day × period × overlapping weeks`.
- **Provenance bắt buộc:** mọi dataset công khai phải có source document, hash, parser version, imported/reviewed time và trạng thái dự kiến/chính thức.
- **Không giả dạng chính thức:** không dùng logo/tên thương hiệu của VNU/UET; UI phải ghi công cụ độc lập của sinh viên, không phải sản phẩm của nhà trường.
- **Fail closed với dữ liệu nghi ngờ:** parser không chắc thì đưa vào review/quarantine, không tự publish.
- **Không silent scope change:** thay đổi P0, contract hoặc privacy boundary phải ghi decision/ADR và cập nhật traceability.

## 4. Quy tắc thay đổi tài liệu

1. Mỗi task bắt đầu bằng việc chỉ rõ tài liệu/section làm source of truth.
2. Thay đổi yêu cầu: cập nhật PRD trước, sau đó cập nhật spec, test và implementation plan.
3. Thay đổi domain/API/privacy: tạo hoặc cập nhật ADR, nêu migration/backward compatibility.
4. Không sửa chéo contract trong lúc code mà không báo ở handoff.
5. Mọi tài liệu mới phải có metadata envelope gồm `Trạng thái/Status`, `Owner`, `Last reviewed`, `Related docs`; report/template phải link Evidence Envelope khi có gate.
6. Link nội bộ dùng relative path; không chèn secret, PII, file thật của sinh viên hoặc token.

## 5. Priority, severity và Definition of Ready / Done

### Hai trục không được dùng lẫn

- **P0/P1/P2 = product priority:** mức quan trọng/phạm vi tính năng. P0 là committed MVP scope; P1/P2 là sau MVP hoặc có thể hoãn.
- **S0/S1/S2/S3 = defect severity:** mức độ tác hại của lỗi đã phát hiện. S0/S1 luôn block release; S2/S3 chỉ được tiếp tục khi có risk acceptance, owner, mitigation và due/expiry.

Quy tắc release: mọi P0 đã commit phải có requirement/AC, test/evidence và owner; thiếu coverage P0 là `no-go`. Không được gọi một P1 “blocker” chỉ vì nó là P1, và không được bỏ qua S0/S1 chỉ vì lỗi nằm ngoài P0.

### Definition of Ready

Một task chỉ vào implementation sau khi đạt **G0 Scope/spec** và, nếu có thay đổi kỹ thuật/data, **G1 Design/contracts**. Task phải có:

- outcome và non-goals;
- acceptance criteria kiểm thử được;
- input/output hoặc schema liên quan;
- owner role và dependency;
- privacy/security impact;
- fixture hoặc cách tạo dữ liệu test an toàn;
- quyết định/giả định được đánh dấu rõ;
- source docs/section + version/hash và requirement/P0 traceability.

### Definition of Done

Một task chỉ hoàn thành khi đạt gate tương ứng trong [Agent workflow](.claude/AGENT_WORKFLOW.md):

- G2 có immutable change/build/run evidence và handoff được nhận;
- G3a QA, G3b Security (khi áp dụng), G3c Independent Review có decision riêng;
- mọi P0 committed có evidence; không có S0/S1 mở;
- S2/S3 còn lại có owner, mitigation, due/expiry và Release Manager chấp thuận;
- parser/domain/API contract không lệch docs;
- accessibility, responsive, offline và privacy gate đã xét nếu task liên quan;
- docs, changelog, rollback/monitoring và handoff được cập nhật;
- không dùng dữ liệu thật trong CI hoặc log.

Các tài liệu sản phẩm vẫn ở `draft`/`proposed`; M1 parser và M2 domain packages có local test/evidence nhưng G0–G5 chưa đạt cho tới khi có actor/date/evidence độc lập theo từng gate. Không điền giả trạng thái app build/test/release.

## 6. Quy tắc cho Agent

- Đọc role contract trước khi làm và chỉ tạo artefact thuộc role.
- Trả kết quả theo template trong `.claude/templates/`, nêu file đã đọc và giả định.
- Mọi handoff phải có [Evidence Envelope](.claude/templates/EVIDENCE_ENVELOPE.md); nếu chưa chạy code ghi `N/A — docs-only` và lý do, không bịa run ID.
- Nếu thiếu thông tin, dừng ở trạng thái `blocked` và nêu câu hỏi; không tự bịa dữ liệu trường.
- Nếu phát hiện lỗi ngoài scope, tạo finding có severity, evidence, impact, recommendation; không sửa lan sang module khác.
- Agent có thể chạy song song khi không ghi cùng file hoặc cùng contract. Các thay đổi schema/ADR phải nối tiếp sau Tech Lead.
- Reviewer không tự sửa finding trừ khi được giao `--fix`; Coder không tự approve code của mình.

## 7. Kiểm tra trước khi bàn giao

- Kiểm tra link và tên file.
- Đối chiếu P0 trong PRD với implementation plan, parser spec và QA matrix; coverage P0 thiếu là no-go.
- Kiểm tra invariants: period, weeks, override precedence, PII boundary, dataset version.
- Chạy test/lint phù hợp; không tuyên bố app build xanh khi dự án chưa có mã nguồn ứng dụng.
- Ghi rõ những gì chưa chạy, chưa chốt hoặc cần người dùng quyết định.
- Khi contract/schema/privacy/data/parser rule đổi, reopen gate sớm nhất bị ảnh hưởng theo [Agent workflow](.claude/AGENT_WORKFLOW.md).
