/**
 * One-time hints (DESIGN-M6-001 §9, AC-M6-12). Each id is remembered in `Settings.seenHints` once the user taps
 * "Đã hiểu" or performs the hinted action; at most one hint shows at a time. One sentence each.
 */
export const HINT_IDS = ["week-swipe", "block-tap", "add-filter", "plan-import"] as const;
export type HintId = (typeof HINT_IDS)[number];

export const HINT_TEXT: Record<HintId, string> = {
  "week-swipe": "Vuốt sang trái hoặc phải để đổi tuần.",
  "block-tap": "Chạm vào một lớp để xem chi tiết và đổi màu.",
  "add-filter": "Bật “Không trùng lịch” để chỉ thấy lớp xếp vừa.",
  "plan-import": "Đăng ký xong thì nhập file kết quả ĐKMH để xem lịch chính thức.",
};

export function isHintId(value: unknown): value is HintId {
  return typeof value === "string" && (HINT_IDS as readonly string[]).includes(value);
}
