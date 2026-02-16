export type FlexDirectionModelType = {
    xy: 'x' | 'y';
    targetDirection: 'left' | 'top';
    sizeName: 'width' | 'height' | keyof DOMRect;
    resizeCursor: 'ew-resize' | 'ns-resize';
};
