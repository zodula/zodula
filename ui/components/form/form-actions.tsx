import React from 'react';
import { Button } from '@/zodula/ui/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/zodula/ui/components/ui/dropdown-menu';
import { useFormActions, type FormAction } from '../../hooks/use-form-actions';
import { ChevronDown } from 'lucide-react';

interface FormActionsProps {
    doctype: string;
    doc?: any;
    className?: string;
}

export function FormActions({ doctype, doc, className }: FormActionsProps) {
    const actions = useFormActions(doctype);

    if (actions.length === 0) {
        return null;
    }

    const renderAction = (action: FormAction, index: number) => {
        if (action.type === 'button') {
            return (
                <Button
                    key={index}
                    variant={action.variant || 'outline'}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={className}
                >
                    {action.icon && <action.icon className="w-4 h-4 mr-1" />}
                    {action.label}
                </Button>
            );
        }

        if (action.type === 'dropdown') {
            return (
                <DropdownMenu key={index}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="zd:h-8">
                            Actions
                            <ChevronDown />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {action.items?.map((item, itemIndex) => (
                            <DropdownMenuItem
                                key={itemIndex}
                                onClick={item.onClick}
                                disabled={item.disabled}
                            >
                                {item.icon && <item.icon className="w-4 h-4 mr-1" />}
                                {item.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        }

        return null;
    };

    return (
        <div className="flex items-center gap-2">
            {actions.map((action, index) => renderAction(action, index))}
        </div>
    );
}
