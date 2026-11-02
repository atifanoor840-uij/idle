"use client";
import Select, { type StylesConfig } from "react-select";
import { countries } from "country-flag-icons";
import * as Flags from "country-flag-icons/react/3x2";

type Option = { code: string; label: string };

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

// Every ISO country the flag set covers, named in English and sorted A–Z.
const OPTIONS: Option[] = countries
  .map((code) => ({ code, label: regionNames.of(code) || code }))
  .filter((o) => o.label !== o.code)
  .sort((a, b) => a.label.localeCompare(b.label));

function Flag({ code }: { code: string }) {
  const Svg = (Flags as Record<string, Flags.FlagComponent>)[code];
  return Svg ? <Svg title="" style={{ width: 22, height: 15, borderRadius: 2, flexShrink: 0 }} /> : null;
}

// Matches the dark .auth-field inputs.
const styles: StylesConfig<Option, false> = {
  control: (base, s) => ({
    ...base,
    minHeight: 0,
    padding: "0.42rem 0.4rem",
    borderRadius: "0.5rem",
    border: `1.33px solid ${s.isFocused ? "var(--green)" : "rgba(255, 255, 255, 0.12)"}`,
    background: s.isFocused ? "rgba(255, 255, 255, 0.07)" : "rgba(255, 255, 255, 0.04)",
    boxShadow: s.isFocused ? "0 0 0 3px rgba(46, 251, 10, 0.2)" : "none",
    "&:hover": { borderColor: s.isFocused ? "var(--green)" : "rgba(255, 255, 255, 0.2)" },
    cursor: "pointer",
  }),
  valueContainer: (base) => ({ ...base, padding: "0 0.4rem" }),
  singleValue: (base) => ({ ...base, color: "#ffffff" }),
  input: (base) => ({ ...base, color: "#ffffff", margin: 0, padding: 0 }),
  placeholder: (base) => ({ ...base, color: "rgba(255, 255, 255, 0.3)" }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, padding: "0 0.3rem", color: "rgba(255, 255, 255, 0.45)" }),
  menu: (base) => ({
    ...base,
    background: "#141414",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "0.5rem",
    overflow: "hidden",
    zIndex: 20,
  }),
  option: (base, s) => ({
    ...base,
    fontSize: "0.9rem",
    fontWeight: 400,
    color: "#ffffff",
    background: s.isSelected ? "rgba(46, 251, 10, 0.18)" : s.isFocused ? "rgba(255, 255, 255, 0.07)" : "transparent",
    cursor: "pointer",
  }),
  noOptionsMessage: (base) => ({ ...base, color: "rgba(255, 255, 255, 0.5)" }),
};

/** Searchable country picker with flags; value is the country's English name. */
export default function CountrySelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <Select<Option, false>
      instanceId="signup-country"
      inputId="signup-country"
      options={OPTIONS}
      value={OPTIONS.find((o) => o.label === value) ?? null}
      onChange={(o) => onChange(o?.label ?? "")}
      getOptionValue={(o) => o.code}
      formatOptionLabel={(o) => (
        <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Flag code={o.code} />
          {o.label}
        </span>
      )}
      placeholder="Select country"
      required
      styles={styles}
    />
  );
}
