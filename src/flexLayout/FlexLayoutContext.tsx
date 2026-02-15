'use client';
import { createContext, useContext } from 'react';
import { FlexLayoutContextValue } from './@types/FlexLayoutTypes';

// Context 생성
const FlexLayoutContext = createContext<FlexLayoutContextValue | null>(null);

// Context를 사용하기 위한 Custom Hook
export function useFlexLayoutContext() {
    const context = useContext(FlexLayoutContext);
    if (!context) {
        throw new Error(
            'useFlexLayoutContext must be used within FlexLayoutContext.Provider'
        );
    }
    return context;
}

// Provider 컴포넌트
interface FlexLayoutProviderProps {
    value: FlexLayoutContextValue;
    children: React.ReactNode;
}

export function FlexLayoutProvider({
    value,
    children,
}: FlexLayoutProviderProps) {
    return (
        <FlexLayoutContext.Provider value={value}>
            {children}
        </FlexLayoutContext.Provider>
    );
}
