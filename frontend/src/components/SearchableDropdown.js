import React, { useState, useRef, useEffect } from 'react';

const SearchableDropdown = ({
  value,
  onChange,
  options,
  placeholder = "Select item...",
  className = "",
  disabled = false,
  stockField = "available_quantity",
  stockUnit = "ML",
  onItemSelected
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || "");
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Update search term when value changes externally
  useEffect(() => {
    setSearchTerm(value || "");
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter options based on search term
  const filteredOptions = options.filter(option => {
    const optionName = typeof option === 'object' ? option.name || option.chemical_name || option.apparatus_name : option;
    return optionName && optionName.toLowerCase().startsWith(searchTerm.toLowerCase());
  });

  // Handle input change - only show dropdown when user types
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    
    // Only show dropdown if there's at least one character
    if (newValue.length >= 1) {
      setIsOpen(true);
      setActiveIndex(-1);
    } else {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  // Handle input focus - don't show dropdown on focus alone
  const handleInputFocus = () => {
    // Only show if there's already text
    if (searchTerm.length >= 1) {
      setIsOpen(true);
      setActiveIndex(-1);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && filteredOptions[activeIndex]) {
          selectOption(filteredOptions[activeIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Select an option
  const selectOption = (option) => {
    const optionName = typeof option === 'object' ? option.name || option.chemical_name || option.apparatus_name : option;
    setSearchTerm(optionName);
    onChange(optionName);
    setIsOpen(false);
    setActiveIndex(-1);
    
    if (onItemSelected) {
      onItemSelected(option);
    }
  };

  // Get display name for option
  const getOptionDisplayName = (option) => {
    return typeof option === 'object' ? option.name || option.chemical_name || option.apparatus_name : option;
  };

  // Get stock information
  const getStockInfo = (option) => {
    if (typeof option === 'object' && option[stockField] !== undefined) {
      return `Stock: ${option[stockField]} ${stockUnit}`;
    }
    return null;
  };

  return (
    <div className={`searchable-dropdown-wrapper ${className}`} ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`searchable-dropdown-input ${className}`}
        disabled={disabled}
        autoComplete="off"
      />
      
      {isOpen && searchTerm.length >= 1 && (
        <div className="searchable-dropdown-panel">
          <div className="searchable-dropdown-header">
            <span>Matching Items</span>
            <button
              type="button"
              className="searchable-dropdown-close"
              onClick={() => {
                setIsOpen(false);
                setActiveIndex(-1);
              }}
            >
              ×
            </button>
          </div>
          
          <div className="searchable-dropdown-results">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={index}
                  className={`searchable-dropdown-item ${activeIndex === index ? 'active' : ''}`}
                  onMouseDown={() => selectOption(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <div className="searchable-dropdown-item-content">
                    <span className="searchable-dropdown-item-name">
                      {getOptionDisplayName(option)}
                    </span>
                    {getStockInfo(option) && (
                      <span className="searchable-dropdown-item-stock">
                        {getStockInfo(option)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="searchable-dropdown-no-results">
                No matching items found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
