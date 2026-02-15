import styles from './styles/FlexLayout.module.css';

export interface FlexLayoutSplitScreenDragBoxTitleMoreProps
    extends Omit<React.HTMLAttributes<HTMLButtonElement>, 'children'> {}
export default function FlexLayoutSplitScreenDragBoxTitleMore({
    className,
    ...props
}: FlexLayoutSplitScreenDragBoxTitleMoreProps) {
    return (
        <button
            {...props}
            className={`${styles['flex-split-screen-drag-box-title-more']} ${className || ''}`}
        >
            <span>.</span>
            <span>.</span>
            <span>.</span>
        </button>
    );
}
