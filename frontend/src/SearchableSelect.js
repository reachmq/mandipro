import { useState, useRef, useEffect } from "react";

const SearchableSelect = ({ options, value, onChange, placeholder = "Search...", disabled = false, testId = "" }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const optionsRef = useRef(null);

  const selected = options.find(o => o.value === value);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIdx(0);
  }, [search]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (open && optionsRef.current) {
      const el = optionsRef.current.children[highlightIdx];
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx, open]);

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setSearch("");
    setHighlightIdx(0);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

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

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      // Any printable char, Enter, Space, or ArrowDown opens the dropdown
      if (e.key.length === 1 || e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
        // If it's a printable character, seed the search
        if (e.key.length === 1) {
          setSearch(e.key);
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
              // Move cursor to end
              inputRef.current.selectionStart = inputRef.current.selectionEnd = 1;
            }
          }, 30);
        }
      }
      return;
    }

    // Dropdown is open — handle navigation
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx(prev => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIdx]) {
          handleSelect(filtered[highlightIdx].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch("");
        break;
      case 'Tab':
        // Select current highlight and close, let Tab move focus naturally
        if (filtered[highlightIdx]) {
          handleSelect(filtered[highlightIdx].value);
        } else {
          setOpen(false);
          setSearch("");
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="ss-wrap" ref={wrapRef} data-testid={testId}>
      <div
        className={`ss-trigger ${disabled ? "ss-disabled" : ""} ${open ? "ss-open" : ""}`}
        tabIndex={disabled ? -1 : 0}
        onClick={openDropdown}
        onKeyDown={handleKeyDown}
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
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="ss-options" ref={optionsRef}>
            {filtered.length === 0 ? (
              <div className="ss-no-result">No match</div>
            ) : (
              filtered.map((o, idx) => (
                <div
                  key={o.value}
                  className={`ss-option ${o.value === value ? "ss-selected" : ""} ${idx === highlightIdx ? "ss-highlighted" : ""}`}
                  onClick={() => handleSelect(o.value)}
                  onMouseEnter={() => setHighlightIdx(idx)}
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
