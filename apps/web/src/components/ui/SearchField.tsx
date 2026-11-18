/**
 * DESIGN-M6-001 §6: the course search box. The accessible label stays "Mã hoặc tên môn" (e2e locators), visually
 * hidden; `ref` reaches the input for the Ctrl/⌘ K shortcut (F4).
 */
import type { Ref } from "react";
import { IconSearch } from "../icons.js";

export const SEARCH_LABEL = "Mã hoặc tên môn";

export function SearchField(props: { id: string; value: string; onChange: (value: string) => void; placeholder?: string; label?: string; ref?: Ref<HTMLInputElement> }) {
  return (
    <div className="search">
      <label className="visually-hidden" htmlFor={props.id}>{props.label ?? SEARCH_LABEL}</label>
      <IconSearch />
      <input
        ref={props.ref}
        id={props.id}
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={props.value}
        placeholder={props.placeholder ?? "Tìm mã hoặc tên môn"}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  );
}
