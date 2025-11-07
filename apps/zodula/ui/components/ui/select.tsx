import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, XIcon } from "lucide-react";
import { Input } from "./input";
import { cn } from "../../lib/utils";
import * as LucideIcons from "lucide-react";

const getIcon = (icon: string) => {
  return LucideIcons[icon as keyof typeof LucideIcons];
};

const getDisplayText = (
  option: SelectOption,
  displayMode: "label" | "value" | "key"
) => {
  switch (displayMode) {
    case "value":
      return option.value;
    case "key":
      return option.value; // In this context, key is the same as value
    case "label":
    default:
      return option.label;
  }
};

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
  icon?: keyof typeof LucideIcons;
}

export interface SelectAction {
  label: string;
  description?: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface SelectProps {
  id?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (option: SelectOption) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  optionClassName?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  searchable?: boolean;
  clearable?: boolean;
  multiple?: boolean;
  maxHeight?: string;
  actions?: SelectAction[];
  onFocus?: () => void;
  onBlur?: () => void;
  allowFreeText?: boolean;
  validate?: boolean;
  displayMode?: "label" | "value" | "key";
}

const Select = ({
  id,
  options,
  value = "",
  onChange,
  onSelect,
  placeholder = "Select an option...",
  disabled = false,
  readOnly = false,
  className,
  inputClassName,
  dropdownClassName,
  optionClassName,
  prefix,
  suffix,
  searchable = false,
  clearable = false,
  multiple = false,
  maxHeight = "200px",
  actions = [],
  onFocus,
  onBlur,
  allowFreeText = false,
  validate = false,
  displayMode = "value",
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: "200px",
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse multiple values from comma-separated string
  const selectedValues =
    multiple && value
      ? value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];

  // Get selected options for display
  const selectedOptions = multiple
    ? options.filter((option) => selectedValues.includes(option.value))
    : [];

  // Function to calculate relevance score for sorting
  const calculateRelevance = (
    option: SelectOption,
    searchTerm: string
  ): number => {
    if (!searchTerm) return 0;

    const searchLower = searchTerm.toLowerCase();
    const labelLower = option.label.toLowerCase();
    const valueLower = option.value.toLowerCase();
    const subtitleLower = option.subtitle?.toLowerCase() || "";

    // Exact match gets highest score
    if (labelLower === searchLower || valueLower === searchLower) {
      return 1000;
    }

    // Starts with gets high score
    if (
      labelLower.startsWith(searchLower) ||
      valueLower.startsWith(searchLower)
    ) {
      return 500;
    }

    // Contains in label gets medium score
    if (labelLower.includes(searchLower)) {
      return 100;
    }

    // Contains in value gets lower score
    if (valueLower.includes(searchLower)) {
      return 50;
    }

    // Contains in subtitle gets lowest score
    if (subtitleLower.includes(searchLower)) {
      return 25;
    }

    return 0;
  };

  // Filter options based on search
  let filteredOptions =
    searchable && searchValue
      ? options.filter((option) => {
          if (multiple && searchValue.includes(",")) {
            // In multiple mode, search based on the last value after comma
            const lastValue = searchValue.split(",").pop()?.trim() || "";
            return (
              option.label.toLowerCase().includes(lastValue.toLowerCase()) ||
              option.value.toLowerCase().includes(lastValue.toLowerCase())
            );
          } else {
            // Single mode or no comma - search the entire value
            return (
              option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
              option.value.toLowerCase().includes(searchValue.toLowerCase())
            );
          }
        })
      : options;

  // Sort filtered options by relevance
  if (searchable && searchValue && filteredOptions.length > 0) {
    const searchTermForSorting =
      multiple && searchValue.includes(",")
        ? searchValue.split(",").pop()?.trim() || ""
        : searchValue.trim();

    if (searchTermForSorting) {
      filteredOptions = [...filteredOptions].sort((a, b) => {
        const scoreA = calculateRelevance(a, searchTermForSorting);
        const scoreB = calculateRelevance(b, searchTermForSorting);

        // Higher score first (descending)
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }

        // If scores are equal, maintain alphabetical order
        return a.label.localeCompare(b.label);
      });
    }
  }

  // Calculate dropdown position
  const calculateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Parse maxHeight to get numeric value for calculations
      const parseMaxHeight = (heightStr: string): number => {
        if (heightStr.includes("px")) {
          return parseInt(heightStr.replace("px", ""));
        } else if (heightStr.includes("vh")) {
          return (parseInt(heightStr.replace("vh", "")) / 100) * viewportHeight;
        }
        return 200; // Default fallback
      };

      const dropdownHeight = parseMaxHeight(maxHeight);
      const gap = 4; // Gap between input and dropdown

      // Calculate if dropdown should open above or below
      const spaceBelow = viewportHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      // Calculate vertical position (fixed positioning uses viewport coordinates)
      let top: number;
      if (openAbove) {
        // When opening above, position it just above the input with a small gap
        top = rect.top - gap;
        // If there's not enough space above, position it at the top of the viewport
        if (top < 8) {
          top = 8;
        }
      } else {
        // When opening below, position it just below the input
        top = rect.bottom + gap;
      }

      // Calculate horizontal position (fixed positioning uses viewport coordinates)
      let left = rect.left;
      const dropdownWidth = Math.max(rect.width, 200); // Minimum width

      // Adjust horizontal position if dropdown would exceed viewport
      if (left + dropdownWidth > viewportWidth) {
        left = viewportWidth - dropdownWidth - 8; // 8px margin from edge
      }
      if (left < 0) {
        left = 8; // 8px margin from edge
      }

      // Calculate available height for the dropdown
      let availableHeight = dropdownHeight;
      if (openAbove) {
        // When opening above, limit height to available space above the input
        availableHeight = Math.min(dropdownHeight, rect.top - gap - 8);
      } else {
        // When opening below, limit height to available space below the input
        availableHeight = Math.min(
          dropdownHeight,
          viewportHeight - rect.bottom - gap - 8
        );
      }

      setDropdownPosition({
        top,
        left,
        width: dropdownWidth,
        maxHeight: `${Math.max(availableHeight, 100)}px`, // Ensure minimum height of 100px
      });
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (!disabled && !readOnly) {
      calculateDropdownPosition();
      setIsOpen(true);
      setFocusedIndex(-1);
      onFocus?.();
    }
  };

  // Handle input blur
  const handleInputBlur = (e: React.FocusEvent) => {
    // Don't close immediately - let the click outside handler manage closing
    // This prevents premature closing when clicking on dropdown options
    onBlur?.();
  };

  // Handle closing dropdown and validation
  const handleDropdownClose = () => {
    setIsOpen(false);
    setSearchValue("");
    setFocusedIndex(-1);

    // Validate value if validate prop is true
    if (validate && value && !allowFreeText) {
      if (multiple) {
        // For multiple mode, validate each value
        const values = value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        const validValues = values.filter((val) =>
          options.some((option) => option.value === val || option.label === val)
        );
        if (validValues.length !== values.length) {
          onChange?.(validValues.join(","));
        }
      } else {
        // For single mode
        const isValidValue = options.some(
          (option) => option.value === value || option.label === value
        );
        if (!isValidValue) {
          onChange?.("");
        }
      }
    }
  };

  // Handle option selection
  const handleOptionSelect = (option: SelectOption) => {
    if (option.disabled) return;

    if (multiple) {
      // For multiple mode, handle comma-separated input
      if (searchValue.includes(",")) {
        // Replace the last part after comma with the selected option
        const parts = searchValue.split(",");
        parts.pop(); // Remove the last part (the search term)
        const newValues = [
          ...parts.map((p) => p.trim()).filter(Boolean),
          option.value,
        ];
        const newValue = newValues.join(",");
        onChange?.(newValue);
      } else {
        // No comma - toggle the option
        const newValues = selectedValues.includes(option.value)
          ? selectedValues.filter((v) => v !== option.value)
          : [...selectedValues, option.value];

        const newValue = newValues.join(",");
        onChange?.(newValue);
      }

      // Call onSelect callback with the selected option
      onSelect?.(option);

      // Clear search and close dropdown
      setSearchValue("");
      handleDropdownClose();
    } else {
      // For single mode
      if (allowFreeText) {
        // For free text mode, set the label as the value
        onChange?.(option.value);
      } else {
        // For strict mode, set the option value
        onChange?.(option.value);
      }

      // Call onSelect callback with the selected option
      onSelect?.(option);

      handleDropdownClose();

      // Unfocus the input
      inputRef.current?.blur();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    const totalItems = filteredOptions.length + actions.length;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (focusedIndex >= 0) {
          if (focusedIndex < filteredOptions.length) {
            // Handle option selection
            const option = filteredOptions[focusedIndex];
            if (option) {
              handleOptionSelect(option);
            }
          } else {
            // Handle action selection
            const actionIndex = focusedIndex - filteredOptions.length;
            const action = actions[actionIndex];
            if (action && !action.disabled) {
              handleActionClick(action, e as any);
            }
          }
        } else if (multiple && allowFreeText && searchValue.trim()) {
          // In multiple mode with free text, just close dropdown
          // The value will be updated through the search input change
          handleDropdownClose();
        }
        break;
      case "Escape":
        e.preventDefault();
        handleDropdownClose();
        inputRef.current?.blur();
        break;
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    setFocusedIndex(-1);

    if (allowFreeText) {
      if (multiple) {
        // In multiple mode with free text, update value immediately
        // This allows real-time typing of comma-separated values
        onChange?.(newValue);
      } else {
        // Single mode with free text
        onChange?.(newValue);
      }
    }
  };

  // Handle clear button click
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("");
    setSearchValue("");
    handleDropdownClose();
    inputRef.current?.focus();
  };

  // Handle action click
  const handleActionClick = (action: SelectAction, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!action.disabled) {
      action.onClick(e);
      handleDropdownClose();
      inputRef.current?.focus();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside both the container and the dropdown
      const isOutsideContainer =
        containerRef.current && !containerRef.current.contains(target);
      const isOutsideDropdown =
        dropdownRef.current && !dropdownRef.current.contains(target);

      if (isOutsideContainer && isOutsideDropdown) {
        handleDropdownClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Update dropdown position on scroll and resize
  useEffect(() => {
    if (isOpen) {
      const handleUpdatePosition = () => {
        calculateDropdownPosition();
      };

      window.addEventListener("scroll", handleUpdatePosition, true);
      window.addEventListener("resize", handleUpdatePosition);

      return () => {
        window.removeEventListener("scroll", handleUpdatePosition, true);
        window.removeEventListener("resize", handleUpdatePosition);
      };
    }
  }, [isOpen]);

  // Scroll focused option into view
  useEffect(() => {
    if (focusedIndex >= 0 && dropdownRef.current) {
      const focusedElement = dropdownRef.current.children[
        focusedIndex
      ] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [focusedIndex]);

  // Get selected option for single mode
  const selectedOption = !multiple
    ? options.find((option) => option.value === value)
    : null;

  // Display value for multiple mode
  const displayValue = multiple
    ? searchValue ||
      selectedOptions.map((opt) => getDisplayText(opt, displayMode)).join(",")
    : searchValue ||
      (selectedOption ? getDisplayText(selectedOption, displayMode) : value);

  return (
    <div ref={containerRef} className={cn("zd:relative", className ?? "")}>
      <Input
        id={id}
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleSearchChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          "zd:cursor-text",
          !allowFreeText && !searchable && !clearable ? "zd:select-none" : "",
          inputClassName ?? "",
          readOnly ? "zd:cursor-default zd:text-muted-foreground" : "",
          disabled ? "zd:cursor-default zd:text-muted-foreground" : ""
        )}
        prefix={prefix}
        suffix={
          <div className="zd:flex zd:items-center zd:gap-1 no-print">
            {suffix}
            {clearable && value && (
              <button
                type="button"
                onClick={handleClear}
                className="zd:p-1 zd:hover:bg-muted-foreground/10 zd:rounded"
              >
                <XIcon />
              </button>
            )}
            {isOpen ? (
              <ChevronUp className="zd:h-4 zd:w-4 zd:text-muted-foreground" />
            ) : (
              <ChevronDown className="zd:h-4 zd:w-4 zd:text-muted-foreground" />
            )}
          </div>
        }
      />

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className={cn(
              "zd:fixed zd:z-50",
              "zd:bg-background zd:border zd:border-border zd:rounded zd:shadow-lg",
              "zd:overflow-y-auto",
              "zd:no-scrollbar", // Hide scrollbar but keep scroll functionality
              dropdownClassName ?? ""
            )}
            style={{
              maxHeight: dropdownPosition.maxHeight,
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            {filteredOptions.length === 0 ? (
              <div className="zd:px-3 zd:py-2 zd:text-sm zd:text-muted-foreground">
                No options found
              </div>
            ) : (
              <>
                {filteredOptions.map((option, index) => {
                  const Icon = getIcon(option.icon as string) as any;
                  const isSelected = multiple
                    ? selectedValues.includes(option.value)
                    : value === option.value;

                  return (
                    <div
                      key={option.value}
                      className={cn(
                        "zd:px-3 zd:py-2 zd:text-sm zd:cursor-pointer zd:transition-colors",
                        "zd:hover:bg-muted zd:focus:bg-muted zd:focus:outline-none",
                        option.disabled
                          ? "zd:opacity-50 zd:cursor-not-allowed zd:hover:bg-transparent"
                          : "",
                        focusedIndex === index ? "zd:bg-muted" : "",
                        optionClassName ?? ""
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOptionSelect(option);
                      }}
                      onMouseEnter={() => setFocusedIndex(index)}
                      tabIndex={-1}
                    >
                      <div className="zd:flex zd:items-center zd:gap-2">
                        {option.icon && (
                          <div className="zd:flex-shrink-0 zd:w-4 zd:h-4">
                            {Icon && <Icon className="zd:w-4 zd:h-4" />}
                          </div>
                        )}
                        <div className="zd:flex zd:flex-col zd:flex-1">
                          <div
                            className={cn(
                              "zd:text-sm zd:font-medium zd:flex zd:items-center zd:gap-2",
                              isSelected ? "zd:text-primary" : ""
                            )}
                          >
                            {option.label}
                          </div>
                          {option.subtitle && (
                            <div className="zd:text-xs zd:text-muted-foreground zd:mt-0.5">
                              {option.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {/* Actions section */}
            {actions.length > 0 && (
              <>
                <div className="zd:border-t zd:border-border zd:my-1" />
                {actions.map((action, index) => (
                  <div
                    key={`action-${index}`}
                    className={cn(
                      "zd:px-3 zd:py-2 zd:text-sm zd:cursor-pointer zd:transition-colors",
                      "zd:hover:bg-muted zd:focus:bg-muted zd:focus:outline-none",
                      action.disabled
                        ? "zd:opacity-50 zd:cursor-not-allowed zd:hover:bg-transparent"
                        : "",
                      focusedIndex === filteredOptions.length + index
                        ? "zd:bg-muted"
                        : "",
                      "zd:flex zd:items-center zd:gap-2"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleActionClick(action, e);
                    }}
                    tabIndex={-1}
                  >
                    {action.icon && (
                      <div className="flex-shrink-0 w-4 h-4">{action.icon}</div>
                    )}
                    <div className="zd:flex zd:flex-col zd:flex-1">
                      <span>{action.label}</span>
                      {action.description && (
                        <span className="zd:text-muted-foreground zd:mt-0.5">
                          {action.description}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export { Select };
