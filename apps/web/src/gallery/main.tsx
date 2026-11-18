/**
 * Component gallery (DESIGN-M6-001 §12, AC-M6-16): every F1b primitive, icon and course colour on one page, for axe
 * (e2e/gallery.spec.ts) and screenshot baselines. Built only with KY_NAY_GALLERY=1 (e2e build); never in production.
 * The theme picker here only sets data-theme; nothing is stored.
 */
import { StrictMode, useState, type ReactElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { warmFonts } from "../app/fonts.js";
import { applyTheme, type ThemePreference } from "../app/theme.js";
import { ThemePicker } from "../components/AboutPanel.js";
import * as Icons from "../components/icons.js";
import { Button } from "../components/ui/Button.js";
import { Chip, ChipRadio, StatusChip } from "../components/ui/Chip.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ListRow } from "../components/ui/ListRow.js";
import { SearchField } from "../components/ui/SearchField.js";
import { SegmentedControl } from "../components/ui/SegmentedControl.js";
import { Sheet } from "../components/ui/Sheet.js";
import { StatCard } from "../components/ui/StatCard.js";
import { ToastRegion, useToast } from "../components/ui/Toast.js";
import { COURSE_COLOR_LABELS, COURSE_PALETTE, courseColor, courseColorStyle } from "../model/palette.js";
import "../styles/index.css";
// Gallery-only layout; never part of the production CSS.
import "./gallery.css";

const ICONS = Object.entries(Icons).filter(([name]) => name.startsWith("Icon")) as [string, (props: Icons.IconProps) => ReactElement][];

function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="gallery-section" aria-labelledby={`g-${props.title}`}>
      <h2 id={`g-${props.title}`}>{props.title}</h2>
      <div className="gallery-row">{props.children}</div>
    </section>
  );
}

function ToastDemo() {
  const toast = useToast();
  return (
    <>
      <Button onClick={() => toast.show("Đã thêm INT2213 vào lịch.")}>Hiện thông báo</Button>
      <Button variant="danger" onClick={() => toast.show("Không lưu được phương án.", { tone: "error" })}>Hiện lỗi</Button>
    </>
  );
}

function Gallery() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [pressed, setPressed] = useState(true);
  const [group, setGroup] = useState("1");
  const [view, setView] = useState<"week" | "day">("week");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <ToastRegion>
      <main className="gallery">
        <h1>Trang mẫu thành phần</h1>
        <Section title="Giao diện">
          <ThemePicker theme={theme} onChange={(next) => { setTheme(next); applyTheme(next); }} />
        </Section>
        <Section title="Nút">
          <Button variant="primary" icon={<Icons.IconPlus />}>Thêm vào lịch</Button>
          <Button>Đổi nhóm</Button>
          <Button variant="danger">Vẫn thêm lớp này</Button>
          <Button variant="ghost">Bỏ lớp này</Button>
          <Button variant="primary" disabled>Chọn nhóm trước</Button>
          <Button size="sm">Nhỏ</Button>
          <Button label="Tuần sau" icon={<Icons.IconChevronRight />} />
        </Section>
        <Section title="Chip">
          <Chip pressed={pressed} onPressedChange={setPressed}>Không trùng lịch</Chip>
          <fieldset className="chip-group">
            <legend>Nhóm thực hành</legend>
            {["1", "2", "3"].map((value) => (
              <ChipRadio key={value} name="gallery-group" value={value} checked={group === value} onChange={setGroup}>Nhóm {value}</ChipRadio>
            ))}
          </fieldset>
          <StatusChip tone="warning" icon={<Icons.IconWarning size={16} />}>Bản thử</StatusChip>
          <StatusChip tone="danger" icon={<Icons.IconWarning size={16} />} onClick={() => undefined}>1 trùng lịch</StatusChip>
          <StatusChip tone="info" icon={<Icons.IconOffline size={16} />}>Ngoại tuyến</StatusChip>
          <StatusChip tone="success" icon={<Icons.IconCheck size={16} />}>Chính thức</StatusChip>
        </Section>
        <Section title="Chọn chế độ">
          <SegmentedControl label="Chế độ xem" options={[{ value: "week", label: "Tuần" }, { value: "day", label: "Ngày", count: 3 }]} value={view} onChange={setView} />
        </Section>
        <Section title="Tìm kiếm">
          <SearchField id="gallery-search" value={query} onChange={setQuery} />
        </Section>
        <Section title="Thẻ số">
          <StatCard label="Tín chỉ" value="18" meta="6 môn" />
          <StatCard label="Trùng lịch" value="1" />
        </Section>
        <Section title="Danh sách">
          <ul className="list gallery-wide">
            <ListRow title="INT2213 · Mạng máy tính" meta="Thứ 4, tiết 4–6 · 404-A" color={courseColor("violet")} trailing={<Icons.IconChevronRight />} onClick={() => undefined} />
            <ListRow title="EMA3071E · Không có giờ cố định" meta="Học trực tuyến" color={courseColor("teal")} />
          </ul>
        </Section>
        <Section title="Màu môn">
          {COURSE_PALETTE.map((color) => (
            <span key={color.id} className="course-chip course-color" style={courseColorStyle(color)}>{COURSE_COLOR_LABELS[color.id]}</span>
          ))}
        </Section>
        <Section title="Biểu tượng">
          {ICONS.map(([name, Icon]) => <Icon key={name} label={name.slice(4)} size={24} />)}
        </Section>
        <Section title="Trạng thái rỗng">
          <EmptyState icon={<Icons.IconCalendar size={28} />} title="Lịch còn trống" action={<Button variant="primary" icon={<Icons.IconPlus />}>Thêm lớp</Button>} />
        </Section>
        <Section title="Sheet và thông báo">
          <Button onClick={() => setSheetOpen(true)}>Mở sheet</Button>
          <ToastDemo />
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="INT2213 · Mạng máy tính">
            <p>Thứ 4, tiết 4–6 (9:00–11:50), phòng 404-A.</p>
            <Button variant="primary" onClick={() => setSheetOpen(false)}>Xong</Button>
          </Sheet>
        </Section>
      </main>
    </ToastRegion>
  );
}

createRoot(document.getElementById("gallery")!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
void warmFonts();
