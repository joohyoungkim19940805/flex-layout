'use client';
import { HTMLAttributes } from 'react';
import FlexLayoutSplitScreenScrollBox from './FlexLayoutSplitScreenScrollBox';
import styles from './styles/FlexLayout.module.css';
export interface FlexLayoutSplitScreenDragBoxContainerProps
    extends HTMLAttributes<HTMLDivElement> {
    layoutName: string;
}

export default function FlexLayoutSplitScreenDragBoxContainer({
    className,
    children,
    layoutName,
    ...props
}: FlexLayoutSplitScreenDragBoxContainerProps) {
    return (
        <FlexLayoutSplitScreenScrollBox
            keyName={layoutName}
            className={`${styles['flex-split-screen-drag-box-title-container']} ${(className && className !== '' && className) || ''}`}
            direction="x"
            {...props}
        >
            {children}
        </FlexLayoutSplitScreenScrollBox>
    );
}
