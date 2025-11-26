import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, Clock } from 'lucide-react';
import { Button } from '@/zodula/ui/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/zodula/ui/components/ui/popover';
import { Input } from '@/zodula/ui/components/ui/input';
import { Select, type SelectOption } from '@/zodula/ui/components/ui/select';
import { cn } from '@/zodula/ui/lib/utils';
import { format as dateFormat, parse, isValid } from 'date-fns';

export interface DatePickerProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    className?: string;
    format?: 'dd-MM-yyyy' | 'yyyy-MM-dd' | 'dd/MM/yyyy';
    minDate?: Date;
    maxDate?: Date;
    range?: boolean;
    type?: 'Date' | 'Time' | 'Datetime';
}

const DatePicker: React.FC<DatePickerProps> = ({
    value = '',
    onChange,
    placeholder = 'Select Date',
    disabled = false,
    readOnly = false,
    className,
    format = 'dd-MM-yyyy',
    minDate,
    maxDate,
    range = false,
    type = 'Date'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedRange, setSelectedRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
    const [isRangeMode, setIsRangeMode] = useState(false);
    const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const [inputValue, setInputValue] = useState(value || '');
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);
    const [hasUserInteracted, setHasUserInteracted] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize default time for Datetime type on mount
    useEffect(() => {
        if (type === 'Datetime' && !value) {
            const now = new Date();
            setSelectedTime({
                hours: now.getHours(),
                minutes: now.getMinutes(),
                seconds: now.getSeconds()
            });
        }
    }, [type, value]);

    // Parse the current value
    useEffect(() => {
        // Only process if value is a non-empty string
        if (value && typeof value === 'string' && value.trim() !== '') {
            if (range && value.includes(' to ')) {
                // Range mode
                setIsRangeMode(true);
                const [startStr, endStr] = value.split(' to ');
                if (startStr && endStr) {
                    const startDate = parseFormattedDate(startStr.trim(), format, type);
                    const endDate = parseFormattedDate(endStr.trim(), format, type);
                    setSelectedRange({ start: startDate, end: endDate });
                    if (startDate) {
                        setCurrentDate(startDate);
                    }
                }
            } else {
                // Single value mode
                setIsRangeMode(false);
                const date = parseFormattedDate(value, format, type);
                if (date) {
                    setSelectedDate(date);
                    setCurrentDate(date);
                    if (type === 'Datetime' || type === 'Time') {
                        setSelectedTime({
                            hours: date.getHours(),
                            minutes: date.getMinutes(),
                            seconds: date.getSeconds()
                        });
                    }
                }
                setSelectedRange({ start: null, end: null });
            }
            setInputValue(value);
        } else {
            // Handle empty, null, undefined, or whitespace-only values
            setInputValue('');
            setSelectedDate(null);
            setSelectedRange({ start: null, end: null });
            setIsRangeMode(false);
            
            // Set default time to now for Datetime type when no value is provided
            if (type === 'Datetime') {
                const now = new Date();
                setSelectedTime({
                    hours: now.getHours(),
                    minutes: now.getMinutes(),
                    seconds: now.getSeconds()
                });
            }
            // Don't trigger onChange here - only when user actually changes the value
        }
    }, [value, format, range, type]);

    // Parse formatted date string using date-fns
    const parseFormattedDate = (dateStr: string, dateFormat: string, fieldType: string): Date | null => {
        if (!dateStr || typeof dateStr !== 'string') return null;

        try {
            if (fieldType === 'Time') {
                // Use date-fns to parse time format: HH:mm:ss
                const parsedDate = parse(dateStr, 'HH:mm:ss', new Date());
                if (isValid(parsedDate)) {
                    return parsedDate;
                }
                // Also try HH:mm format
                const parsedDateShort = parse(dateStr, 'HH:mm', new Date());
                if (isValid(parsedDateShort)) {
                    return parsedDateShort;
                }
            } else if (fieldType === 'Date') {
                // Use date-fns to parse date format
                const parsedDate = parse(dateStr, dateFormat, new Date());
                if (isValid(parsedDate)) {
                    return parsedDate;
                }
            } else if (fieldType === 'Datetime') {
                // For datetime, combine date and time formats
                let datetimeFormat: string;
                if (dateFormat === 'dd-MM-yyyy') {
                    datetimeFormat = 'dd-MM-yyyy HH:mm:ss';
                } else if (dateFormat === 'yyyy-MM-dd') {
                    datetimeFormat = 'yyyy-MM-dd HH:mm:ss';
                } else if (dateFormat === 'MM/dd/yyyy') {
                    datetimeFormat = 'MM/dd/yyyy HH:mm:ss';
                } else {
                    datetimeFormat = 'dd-MM-yyyy HH:mm:ss';
                }

                const parsedDate = parse(dateStr, datetimeFormat, new Date());
                if (isValid(parsedDate)) {
                    return parsedDate;
                }
            }
        } catch (error) {
            console.warn('Failed to parse date:', dateStr, error);
        }
        return null;
    };

    // Format date to string using date-fns
    const formatDateToString = (date: Date, dateFormatString: string, fieldType: string): string => {
        if (fieldType === 'Time') {
            // Use date-fns to format time: HH:mm:ss
            return dateFormat(date, 'HH:mm:ss');
        } else if (fieldType === 'Date') {
            // Use date-fns to format date
            return dateFormat(date, dateFormatString);
        } else if (fieldType === 'Datetime') {
            // For datetime, combine date and time formats
            let datetimeFormat: string;
            if (dateFormatString === 'dd-MM-yyyy') {
                datetimeFormat = 'dd-MM-yyyy HH:mm:ss';
            } else if (dateFormatString === 'yyyy-MM-dd') {
                datetimeFormat = 'yyyy-MM-dd HH:mm:ss';
            } else if (dateFormatString === 'MM/dd/yyyy') {
                datetimeFormat = 'MM/dd/yyyy HH:mm:ss';
            } else {
                datetimeFormat = 'dd-MM-yyyy HH:mm:ss';
            }
            return dateFormat(date, datetimeFormat);
        }
        return '';
    };

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        setHasUserInteracted(true);
    };

    // Handle input blur - validate and format the value
    const handleInputBlur = () => {
        // Only trigger onChange if user has actually interacted with the input
        if (!hasUserInteracted) {
            return;
        }

        if (!inputValue.trim()) {
            setSelectedDate(null);
            setSelectedRange({ start: null, end: null });
            onChange?.('');
            return;
        }

        // Check if it's a range value
        if (range && inputValue.includes(' to ')) {
            const [startStr, endStr] = inputValue.split(' to ');
            if (startStr && endStr) {
                const startDate = parseFormattedDate(startStr.trim(), format, type);
                const endDate = parseFormattedDate(endStr.trim(), format, type);

                if (startDate && endDate) {
                    // Check min/max date constraints
                    if (minDate && (startDate < minDate || endDate < minDate)) {
                        setInputValue('');
                        setSelectedRange({ start: null, end: null });
                        if (hasUserInteracted) {
                            onChange?.('');
                        }
                        return;
                    }
                    if (maxDate && (startDate > maxDate || endDate > maxDate)) {
                        setInputValue('');
                        setSelectedRange({ start: null, end: null });
                        if (hasUserInteracted) {
                            onChange?.('');
                        }
                        return;
                    }

                    // Valid range, format it properly
                    const formattedStart = formatDateToString(startDate, format, type);
                    const formattedEnd = formatDateToString(endDate, format, type);
                    const formattedRange = `${formattedStart} to ${formattedEnd}`;
                    setInputValue(formattedRange);
                    setSelectedRange({ start: startDate, end: endDate });
                    if (hasUserInteracted) {
                        onChange?.(formattedRange);
                    }
                } else {
                    // Invalid range, clear it
                    setInputValue('');
                    setSelectedRange({ start: null, end: null });
                    if (hasUserInteracted) {
                        onChange?.('');
                    }
                }
            }
        } else {
            // Single value
            const date = parseFormattedDate(inputValue.trim(), format, type);
            if (date) {
                // Check min/max date constraints
                if (minDate && date < minDate) {
                    setInputValue('');
                    setSelectedDate(null);
                    if (hasUserInteracted) {
                        onChange?.('');
                    }
                    return;
                }
                if (maxDate && date > maxDate) {
                    setInputValue('');
                    setSelectedDate(null);
                    if (hasUserInteracted) {
                        onChange?.('');
                    }
                    return;
                }

                const formattedDate = formatDateToString(date, format, type);
                setInputValue(formattedDate);
                setSelectedDate(date);
                setCurrentDate(date);
                if (hasUserInteracted) {
                    onChange?.(formattedDate);
                }
            } else {
                setInputValue('');
                setSelectedDate(null);
                if (hasUserInteracted) {
                    onChange?.('');
                }
            }
        }
    };

    // Handle date selection
    const handleDateSelect = (date: Date) => {
        // Check min/max date constraints
        if (minDate && date < minDate) return;
        if (maxDate && date > maxDate) return;

        if (range) {
            // Range mode - always enter range selection when range prop is true
            if (!selectedRange.start || (selectedRange.start && selectedRange.end)) {
                // Start new range
                setSelectedRange({ start: date, end: null });
                setIsRangeMode(true);
            } else {
                // Complete range
                let startDate, endDate;
                if (date < selectedRange.start) {
                    startDate = date;
                    endDate = selectedRange.start;
                } else {
                    startDate = selectedRange.start;
                    endDate = date;
                }

                setSelectedRange({ start: startDate, end: endDate });

                // Update input value and trigger onChange for completed range
                const startStr = formatDateToString(startDate, format, type);
                const endStr = formatDateToString(endDate, format, type);
                const rangeValue = `${startStr} to ${endStr}`;
                setInputValue(rangeValue);
                setHasUserInteracted(true);
                onChange?.(rangeValue);
                setIsOpen(false);
            }
        } else {
            // Single date mode
            let finalDate = date;
            
            // For Datetime type, preserve the selected time
            if (type === 'Datetime') {
                finalDate = new Date(date);
                finalDate.setHours(selectedTime.hours, selectedTime.minutes, selectedTime.seconds);
            }
            
            setSelectedDate(finalDate);
            setCurrentDate(finalDate);
            setIsRangeMode(false);

            const formattedDate = formatDateToString(finalDate, format, type);
            setInputValue(formattedDate);
            setHasUserInteracted(true);
            onChange?.(formattedDate);
            setIsOpen(false);
        }
    };

    // Handle time selection
    const handleTimeSelect = (hours: number, minutes: number, seconds: number) => {
        setSelectedTime({ hours, minutes, seconds });

        // For Time type, always create a new date with the selected time
        if (type === 'Time') {
            const timeDate = new Date();
            timeDate.setHours(hours, minutes, seconds, 0);
            setSelectedDate(timeDate);

            // Update input value and trigger onChange for time changes
            const formattedTime = formatDateToString(timeDate, format, type);
            setInputValue(formattedTime);
            setHasUserInteracted(true);
            onChange?.(formattedTime);
        } else if (type === 'Datetime') {
            // For Datetime type, create a new date with current date and selected time
            const now = new Date();
            const newDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
            setSelectedDate(newDate);
            setCurrentDate(newDate);

            // Update input value and trigger onChange for time changes
            const formattedDate = formatDateToString(newDate, format, type);
            setInputValue(formattedDate);
            setHasUserInteracted(true);
            onChange?.(formattedDate);
        }
    };

    // Handle today button click
    const handleTodayClick = () => {
        const now = new Date();

        if (type === 'Time') {
            // For time fields, use current time (now)
            const timeDate = new Date();
            timeDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            setSelectedDate(timeDate);
            setSelectedTime({
                hours: now.getHours(),
                minutes: now.getMinutes(),
                seconds: now.getSeconds()
            });

            // Update input value and trigger onChange
            const formattedTime = formatDateToString(timeDate, format, type);
            setInputValue(formattedTime);
            setHasUserInteracted(true);
            onChange?.(formattedTime);
        } else if (type === 'Date') {
            // For date fields, use today with 00:00:00
            const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            setSelectedDate(todayDate);
            setCurrentDate(todayDate);

            // Update input value and trigger onChange
            const formattedDate = formatDateToString(todayDate, format, type);
            setInputValue(formattedDate);
            setHasUserInteracted(true);
            onChange?.(formattedDate);
        } else if (type === 'Datetime') {
            // For datetime fields, use today with current time (now)
            const datetimeDate = new Date(now);
            setSelectedDate(datetimeDate);
            setCurrentDate(datetimeDate);
            setSelectedTime({
                hours: now.getHours(),
                minutes: now.getMinutes(),
                seconds: now.getSeconds()
            });

            // Update input value and trigger onChange
            const formattedDatetime = formatDateToString(datetimeDate, format, type);
            setInputValue(formattedDatetime);
            setHasUserInteracted(true);
            onChange?.(formattedDatetime);
        }
        setIsOpen(false);
    };

    // Clear selection
    const clearSelection = () => {
        setSelectedDate(null);
        setSelectedRange({ start: null, end: null });
        setSelectedTime({ hours: 0, minutes: 0, seconds: 0 });
        setInputValue('');
        setHasUserInteracted(true);
        onChange?.('');
    };

    // Navigate months
    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (direction === 'prev') {
                newDate.setMonth(prev.getMonth() - 1);
            } else {
                newDate.setMonth(prev.getMonth() + 1);
            }
            return newDate;
        });
    };

    // Handle month selection
    const handleMonthSelect = (monthIndex: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(monthIndex);
            return newDate;
        });
        setShowMonthPicker(false);
    };

    // Handle year selection
    const handleYearSelect = (year: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setFullYear(year);
            return newDate;
        });
        setShowYearPicker(false);
    };

    // Generate years for year picker
    const generateYears = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let i = currentYear - 50; i <= currentYear + 10; i++) {
            years.push(i);
        }
        return years;
    };

    // Month names
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Generate calendar days
    const generateCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const days = [];
        const currentDateObj = new Date(startDate);

        while (currentDateObj <= lastDay || days.length < 42) {
            days.push(new Date(currentDateObj));
            currentDateObj.setDate(currentDateObj.getDate() + 1);
        }

        return days;
    };

    // Check if date is selected
    const isDateSelected = (date: Date): boolean => {
        if (range) {
            if (!selectedRange.start) return false;

            // For single date selection (not in range mode or no end date yet)
            if (!selectedRange.end) {
                const isSelected = date.getDate() === selectedRange.start.getDate() &&
                    date.getMonth() === selectedRange.start.getMonth() &&
                    date.getFullYear() === selectedRange.start.getFullYear();
                return isSelected;
            }

            // For range selection, check if date is within range
            const startDate = new Date(selectedRange.start);
            const endDate = new Date(selectedRange.end);
            const currentDate = new Date(date);

            // Reset time to compare only dates
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            currentDate.setHours(0, 0, 0, 0);

            return currentDate >= startDate && currentDate <= endDate;
        } else {
            if (!selectedDate) return false;
            return date.getDate() === selectedDate.getDate() &&
                date.getMonth() === selectedDate.getMonth() &&
                date.getFullYear() === selectedDate.getFullYear();
        }
    };

    // Check if date is today
    const isToday = (date: Date): boolean => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    // Check if date is from current month
    const isCurrentMonth = (date: Date): boolean => {
        return date.getMonth() === currentDate.getMonth() &&
            date.getFullYear() === currentDate.getFullYear();
    };

    // Check if date is disabled (outside min/max range)
    const isDateDisabled = (date: Date): boolean => {
        if (minDate && date < minDate) return true;
        if (maxDate && date > maxDate) return true;
        return false;
    };

    // Check if date is hovered for range selection
    const isDateHovered = (date: Date): boolean => {
        if (!hoveredDate || !range || !selectedRange.start || selectedRange.end) return false;

        // When in range mode with start date but no end date, highlight from start to hovered
        const startDate = new Date(selectedRange.start);
        const hoveredDateObj = new Date(hoveredDate);
        const currentDate = new Date(date);

        // Reset time to compare only dates
        startDate.setHours(0, 0, 0, 0);
        hoveredDateObj.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);

        // If hovered date is before start date, highlight from hovered to start
        if (hoveredDateObj < startDate) {
            return currentDate >= hoveredDateObj && currentDate <= startDate;
        } else {
            // If hovered date is after start date, highlight from start to hovered
            return currentDate >= startDate && currentDate <= hoveredDateObj;
        }
    };

    const calendarDays = generateCalendarDays();

    // Generate time options for Select components
    const generateTimeOptions = (max: number, padLength: number = 2): SelectOption[] => {
        return Array.from({ length: max }, (_, i) => ({
            value: i.toString(),
            label: String(i).padStart(padLength, '0')
        }));
    };

    const hoursOptions = generateTimeOptions(24);
    const minutesOptions = generateTimeOptions(60);
    const secondsOptions = generateTimeOptions(60);

    return (
        <div className={cn("zd:relative", className ?? "")}>
            <Popover open={isOpen && !readOnly} onOpenChange={(open) => {
                if (!readOnly) {
                    setIsOpen(open);
                    // Initialize time picker with current time when opening for Time or Datetime type
                    // But don't trigger onChange - only set the internal state
                    if (open && (type === 'Time' || type === 'Datetime') && !selectedDate) {
                        const now = new Date();
                        setSelectedTime({
                            hours: now.getHours(),
                            minutes: now.getMinutes(),
                            seconds: now.getSeconds()
                        });
                    }
                }
            }}>
                <PopoverTrigger asChild>
                    <div className="zd:relative zd:flex-1">
                        <div onBlur={handleInputBlur}>
                            <Input
                                ref={inputRef}
                                value={inputValue}
                                onChange={handleInputChange}
                                placeholder={placeholder}
                                readOnly={readOnly}
                                className="zd:pr-10"
                                disabled={disabled}
                            />
                        </div>
                        {!readOnly && (
                            <Button
                                variant="ghost"
                                className="zd:absolute zd:right-0 zd:top-0 zd:h-full zd:px-3 zd:hover:bg-transparent"
                                onClick={() => !disabled && setIsOpen(true)}
                                disabled={disabled}
                            >
                                {type === 'Time' ? (
                                    <Clock className="zd:h-4 zd:w-4" />
                                ) : (
                                    <Calendar className="zd:h-4 zd:w-4" />
                                )}
                            </Button>
                        )}
                    </div>
                </PopoverTrigger>
                <PopoverContent className="zd:p-0" align="start">
                    <div className="zd:p-3">
                        {type !== "Time" && (
                            <>
                                {/* Header */}
                                <div className="zd:flex zd:items-center zd:justify-between zd:mb-4 zd:w-full">
                                    <Button
                                        variant="ghost"
                                        onClick={() => navigateMonth('prev')}
                                    >
                                        <ChevronLeft className="zd:h-4 zd:w-4" />
                                    </Button>

                                    <div className="zd:flex zd:items-center zd:space-x-1">
                                        {/* Month Picker */}
                                        <Popover open={showMonthPicker} onOpenChange={setShowMonthPicker}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="zd:px-2 zd:py-1 zd:text-sm zd:font-medium zd:hover:bg-accent"
                                                >
                                                    {currentDate.toLocaleDateString('en-US', { month: 'long' })}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="zd:w-48 zd:p-2" align="center">
                                                <div className="zd:grid zd:grid-cols-3 zd:gap-0.5">
                                                    {monthNames.map((month, index) => (
                                                        <Button
                                                            key={month}
                                                            variant="ghost"
                                                            className={cn(
                                                                "zd:text-xs",
                                                                currentDate.getMonth() === index ? "zd:bg-primary zd:text-primary-foreground" : ""
                                                            )}
                                                            onClick={() => handleMonthSelect(index)}
                                                        >
                                                            {month.substring(0, 3)}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>

                                        {/* Year Picker */}
                                        <Popover open={showYearPicker} onOpenChange={setShowYearPicker}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="zd:px-2 zd:py-1 zd:text-sm zd:font-medium zd:hover:bg-accent"
                                                >
                                                    {currentDate.getFullYear()}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="zd:w-48 zd:p-2 zd:overflow-y-auto" align="center">
                                                <div className="zd:grid zd:grid-cols-3 zd:gap-1 zd:max-h-48">
                                                    {generateYears().map((year) => (
                                                        <Button
                                                            key={year}
                                                            variant="ghost"
                                                            className={cn(
                                                                "zd:text-xs",
                                                                currentDate.getFullYear() === year ? "zd:bg-primary zd:text-primary-foreground" : ""
                                                            )}
                                                            onClick={() => handleYearSelect(year)}
                                                        >
                                                            {year}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        onClick={() => navigateMonth('next')}
                                    >
                                        <ChevronLeft className="zd:h-4 zd:w-4 zd:rotate-180" />
                                    </Button>
                                </div>

                                {/* Calendar Grid */}
                                {/* Day headers */}
                                <div className="zd:grid zd:grid-cols-7 zd:gap-0 zd:mb-2">
                                    {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                                        <div key={day} className="zd:w-full zd:h-6 zd:w-6 zd:text-center zd:font-medium zd:text-muted-foreground zd:py-1">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar days */}
                                <div className="zd:grid zd:grid-cols-7 zd:gap-0">
                                    {calendarDays.map((date, index) => {
                                        const isSelected = isDateSelected(date);
                                        const isDisabled = isDateDisabled(date);
                                        const isStartDate = selectedRange.start &&
                                            date.getDate() === selectedRange.start.getDate() &&
                                            date.getMonth() === selectedRange.start.getMonth() &&
                                            date.getFullYear() === selectedRange.start.getFullYear();
                                        const isEndDate = selectedRange.end &&
                                            date.getDate() === selectedRange.end.getDate() &&
                                            date.getMonth() === selectedRange.end.getMonth() &&
                                            date.getFullYear() === selectedRange.end.getFullYear();
                                        const isInRange = range && selectedRange.start && selectedRange.end && isSelected && !isStartDate && !isEndDate;

                                        return (
                                            <button
                                                key={index}
                                                onClick={() => !isDisabled && handleDateSelect(date)}
                                                onMouseEnter={() => setHoveredDate(date)}
                                                onMouseLeave={() => setHoveredDate(null)}
                                                disabled={isDisabled}
                                                className={cn(
                                                    "zd:flex zd:!h-8 zd:!w-full zd:justify-center zd:items-center zd:transition-colors zd:relative",
                                                    "zd:hover:text-accent-foreground",
                                                    isStartDate ? "zd:bg-primary zd:text-primary-foreground zd:font-bold" : "",
                                                    isEndDate ? "zd:bg-primary zd:text-primary-foreground zd:font-bold" : "",
                                                    isDateHovered(date) ? "zd:bg-primary/10 zd:text-primary" : "",
                                                    !isCurrentMonth(date) ? "zd:text-muted-foreground/50" : "",
                                                    isSelected ? "zd:bg-primary zd:text-primary-foreground" : "",
                                                    isInRange ? "zd:bg-primary/20 zd:text-primary" : "",
                                                    isToday(date) ? "zd:font-bold" : "",
                                                    isDisabled ? "zd:text-muted-foreground/30 zd:cursor-not-allowed" : "",
                                                    !isDisabled ? "zd:hover:bg-accent" : "",
                                                )}
                                                title={`${date.toDateString()} ${isSelected ? '(Selected)' : ''} ${isStartDate ? '(Start)' : ''} ${isEndDate ? '(End)' : ''} ${isDisabled ? '(Disabled)' : ''}`}
                                            >
                                                {date.getDate()}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Action buttons */}
                                <div className="zd:flex zd:justify-between zd:mt-2 zd:pt-2 zd:border-t">
                                    <Button variant="ghost" onClick={clearSelection}>
                                        Clear
                                    </Button>
                                    {!range && (
                                        <Button variant="ghost" onClick={handleTodayClick}>
                                            Today
                                        </Button>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Time picker for datetime and time fields */}
                        {(type === 'Datetime' || type === 'Time') && (
                            <div className="mt-4">
                                <div className="zd:grid zd:grid-cols-3 zd:gap-2">
                                    <div>
                                        <label className="zd:text-muted-foreground zd:text-sm zd:mb-1 zd:block">Hours</label>
                                        <Select
                                            options={hoursOptions}
                                            value={String(selectedTime.hours).padStart(2, '0')}
                                            onChange={(value) => handleTimeSelect(Number(value), selectedTime.minutes, selectedTime.seconds)}
                                            allowFreeText={true}
                                            placeholder="00"
                                            className="zd:w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="zd:text-muted-foreground zd:text-sm zd:mb-1 zd:block">Minutes</label>
                                        <Select
                                            options={minutesOptions}
                                            value={String(selectedTime.minutes).padStart(2, '0')}
                                            onChange={(value) => handleTimeSelect(selectedTime.hours, Number(value), selectedTime.seconds)}
                                            allowFreeText={true}
                                            placeholder="00"
                                            className="zd:w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="zd:text-muted-foreground zd:text-sm zd:mb-1 zd:block">Seconds</label>
                                        <Select
                                            options={secondsOptions}
                                            value={String(selectedTime.seconds).padStart(2, '0')}
                                            onChange={(value) => handleTimeSelect(selectedTime.hours, selectedTime.minutes, Number(value))}
                                            allowFreeText={true}
                                            placeholder="00"
                                            className="zd:w-full"
                                        />
                                    </div>
                                </div>
                                {type === 'Time' && (
                                    <div className="zd:flex zd:justify-between zd:mt-2 zd:pt-2 zd:border-t">
                                        <Button variant="ghost" onClick={clearSelection}>
                                            Clear
                                        </Button>
                                        <Button variant="ghost" onClick={handleTodayClick}>
                                            Now
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export { DatePicker };
