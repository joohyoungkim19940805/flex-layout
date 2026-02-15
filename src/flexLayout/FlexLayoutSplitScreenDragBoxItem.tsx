import { ReactElement, useEffect } from 'react';
import { FlexLayoutSplitScreenDragBoxProps } from './FlexLayoutSplitScreenDragBox';
import { allSplitScreenCount } from './drag/hooks/useDrag';
import styles from './styles/FlexLayout.module.css';
export interface FlexLayoutSplitScreenDragBoxItemProps {
    children: ReactElement<FlexLayoutSplitScreenDragBoxProps>;
    onClose: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    isActive: boolean;
}
export default function FlexLayoutSplitScreenDragBoxItem({
    children,
    onClose,
    isActive,
    ...props
}: FlexLayoutSplitScreenDragBoxItemProps) {
    useEffect(() => {
        allSplitScreenCount.next(allSplitScreenCount.value + 1);
        return () => {
            if (allSplitScreenCount.value <= 1) return;
            allSplitScreenCount.next(allSplitScreenCount.value - 1);
        };
    }, []);
    return (
        <div
            className={`${styles['flex-split-screen-drag-box-title-item']} ${isActive ? styles['active'] : ''}`}
            {...props}
        >
            {children}
            <button type="button" onClick={ev => onClose(ev)}>
                X
            </button>
        </div>
    );
}
