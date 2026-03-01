import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchableDropdown from './SearchableDropdown';

// Mock data for testing
const mockOptions = [
  { name: 'Sulfuric Acid', available_quantity: 1000 },
  { name: 'Hydrochloric Acid', available_quantity: 500 },
  { name: 'Sodium Hydroxide', available_quantity: 750 }
];

describe('SearchableDropdown', () => {
  test('renders without crashing', () => {
    render(<SearchableDropdown value="" onChange={() => {}} options={mockOptions} />);
  });

  test('shows placeholder text', () => {
    render(<SearchableDropdown value="" onChange={() => {}} options={mockOptions} placeholder="Select Chemical" />);
    expect(screen.getByPlaceholderText('Select Chemical')).toBeInTheDocument();
  });

  test('dropdown stays hidden on initial focus', () => {
    render(<SearchableDropdown value="" onChange={() => {}} options={mockOptions} />);
    const input = screen.getByRole('textbox');
    
    // Focus should not show dropdown
    fireEvent.focus(input);
    expect(screen.queryByText('Matching Items')).not.toBeInTheDocument();
  });

  test('dropdown appears after typing one character', () => {
    render(<SearchableDropdown value="" onChange={() => {}} options={mockOptions} />);
    const input = screen.getByRole('textbox');
    
    // Type one character
    fireEvent.change(input, { target: { value: 'S' } });
    
    // Dropdown should appear
    expect(screen.getByText('Matching Items')).toBeInTheDocument();
    expect(screen.getByText('Sulfuric Acid')).toBeInTheDocument();
    expect(screen.getByText('Sodium Hydroxide')).toBeInTheDocument();
  });

  test('filters options correctly', () => {
    render(<SearchableDropdown value="" onChange={() => {}} options={mockOptions} />);
    const input = screen.getByRole('textbox');
    
    // Type 'Acid'
    fireEvent.change(input, { target: { value: 'Acid' } });
    
    // Should show only acid options
    expect(screen.getByText('Sulfuric Acid')).toBeInTheDocument();
    expect(screen.getByText('Hydrochloric Acid')).toBeInTheDocument();
    expect(screen.queryByText('Sodium Hydroxide')).not.toBeInTheDocument();
  });

  test('shows stock information', () => {
    render(<SearchableDropdown value="" onChange={() => {}} options={mockOptions} stockUnit="ML" />);
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: 'S' } });
    
    expect(screen.getByText('Stock: 1000 ML')).toBeInTheDocument();
    expect(screen.getByText('Stock: 750 ML')).toBeInTheDocument();
  });

  test('selecting an option updates value', () => {
    const mockOnChange = jest.fn();
    render(<SearchableDropdown value="" onChange={mockOnChange} options={mockOptions} />);
    const input = screen.getByRole('textbox');
    
    // Type to show dropdown
    fireEvent.change(input, { target: { value: 'S' } });
    
    // Click on first option
    fireEvent.mouseDown(screen.getByText('Sulfuric Acid'));
    
    // Should call onChange with selected value
    expect(mockOnChange).toHaveBeenCalledWith('Sulfuric Acid');
  });

  test('dropdown closes when clicking outside', () => {
    render(<SearchableDropdown value="" onChange={() => {}} options={mockOptions} />);
    const input = screen.getByRole('textbox');
    
    // Type to show dropdown
    fireEvent.change(input, { target: { value: 'S' } });
    expect(screen.getByText('Matching Items')).toBeInTheDocument();
    
    // Click outside
    fireEvent.mouseDown(document.body);
    
    // Dropdown should close
    expect(screen.queryByText('Matching Items')).not.toBeInTheDocument();
  });

  test('keyboard navigation works', () => {
    render(<SearchableDropdown value="" onChange={() => {}} options={mockOptions} />);
    const input = screen.getByRole('textbox');
    
    // Type to show dropdown
    fireEvent.change(input, { target: { value: 'S' } });
    
    // Arrow down should highlight first option
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByText('Sulfuric Acid').parentElement).toHaveClass('active');
    
    // Enter should select the option
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByText('Matching Items')).not.toBeInTheDocument();
  });
});

export default SearchableDropdown;
