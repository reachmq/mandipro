import { useState, useRef, useEffect } from "react";

const SearchableSelect = ({ options, value, onChange, placeholder = "Search...", disabled = false, testId = "" }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Find current label
  const selected = options.find(o => o.value === value);

  // Filter options
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  return (
    <div className="ss-wrap" ref={wrapRef} data-testid={testId}>
      <div
        className={`ss-trigger ${disabled ? "ss-disabled" : ""} ${open ? "ss-open" : ""}`}
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); } }}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) { e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); } }}
      >
        <span className={selected ? "ss-value" : "ss-placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        {value && !disabled && (
          <span className="ss-clear" onClick={handleClear}>&times;</span>
        )}
        <span className="ss-chevron">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="ss-dropdown">
          <input
            ref={inputRef}
            className="ss-search"
            type="text"
            placeholder="Type to search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="ss-options">
            {filtered.length === 0 ? (
              <div className="ss-no-result">No match</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.value}
                  className={`ss-option ${o.value === value ? "ss-selected" : ""}`}
                  onClick={() => handleSelect(o.value)}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
