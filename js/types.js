const BlockType = {
    H1: 'h1',
    H2: 'h2',
    H3: 'h3',
    PARAGRAPH: 'paragraph',
    IMAGE: 'image',
    TABLE: 'table',
    FOOTNOTE_REF: 'footnote',
    TOC: 'toc',
    CROSS_REF: 'crossref',
    MARGIN_NOTE: 'marginnote'
};

const BlockTypeLabels = {
    [BlockType.H1]: '📌 标题 H1',
    [BlockType.H2]: '📎 标题 H2',
    [BlockType.H3]: '🔖 标题 H3',
    [BlockType.PARAGRAPH]: '📄 正文段落',
    [BlockType.IMAGE]: '🖼️ 图片占位',
    [BlockType.TABLE]: '📊 表格',
    [BlockType.FOOTNOTE_REF]: '📍 脚注引用',
    [BlockType.TOC]: '📑 目录',
    [BlockType.CROSS_REF]: '🔗 交叉引用',
    [BlockType.MARGIN_NOTE]: '📝 页边批注'
};

const PaperPresets = {
    'a4-portrait': { width: 210, height: 297 },
    'a4-landscape': { width: 297, height: 210 },
    'a5-portrait': { width: 148, height: 210 },
    'a5-landscape': { width: 210, height: 148 },
    'letter-portrait': { width: 216, height: 279 }
};

const MM_TO_PX = 3.7795275591;
const PT_TO_PX = 1.3333333333;

function mmToPx(mm) {
    return mm * MM_TO_PX;
}

function ptToPx(pt) {
    return pt * PT_TO_PX;
}

function generateId() {
    return 'block_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

class ContentBlock {
    constructor(type, data = {}) {
        this.id = generateId();
        this.type = type;
        this.data = { ...this.getDefaultData(type), ...data };
    }

    getDefaultData(type) {
        switch (type) {
            case BlockType.H1:
            case BlockType.H2:
            case BlockType.H3:
                return { text: '' };
            case BlockType.PARAGRAPH:
                return { text: '', inlineStyles: [] };
            case BlockType.IMAGE:
                return { aspectRatio: '4:3', caption: '图片标题', altText: '图片占位', floatType: ImageFloatType.NONE };
            case BlockType.TABLE:
                return {
                    columns: 3,
                    headers: ['列1', '列2', '列3'],
                    rows: [
                        ['数据1', '数据2', '数据3'],
                        ['数据4', '数据5', '数据6']
                    ],
                    caption: ''
                };
            case BlockType.FOOTNOTE_REF:
                return { refText: '', footnoteText: '' };
            case BlockType.TOC:
                return { title: '目录' };
            case BlockType.CROSS_REF:
                return { targetId: '', targetType: CrossRefTargetType.HEADING };
            case BlockType.MARGIN_NOTE:
                return { noteText: '', anchoredBlockId: '' };
            default:
                return {};
        }
    }
}

class LayoutParams {
    constructor() {
        this.pageWidthMm = 210;
        this.pageHeightMm = 297;
        this.marginTopMm = 20;
        this.marginBottomMm = 20;
        this.marginLeftMm = 20;
        this.marginRightMm = 35;
        this.fontSizePt = 12;
        this.lineHeight = 1.5;
        this.paragraphSpacing = 0.5;
        this.fontFamily = '"Noto Serif SC", "Source Han Serif SC", "SimSun", serif';
        this.showHeader = true;
        this.showPageNumber = true;
        this.autoNumberHeading = true;
        this.columnCount = 1;
        this.columnGapMm = 8;
        this.showColumnRule = false;
        this.sidenoteWidthMm = 15;
        this.showSidenoteGutterLine = true;
    }

    get pageWidthPx() { return mmToPx(this.pageWidthMm); }
    get pageHeightPx() { return mmToPx(this.pageHeightMm); }
    get marginTopPx() { return mmToPx(this.marginTopMm); }
    get marginBottomPx() { return mmToPx(this.marginBottomMm); }
    get marginLeftPx() { return mmToPx(this.marginLeftMm); }
    get marginRightPx() { return mmToPx(this.marginRightMm); }
    get fontSizePx() { return ptToPx(this.fontSizePt); }
    get lineHeightPx() { return this.fontSizePx * this.lineHeight; }
    get paragraphSpacingPx() { return this.lineHeightPx * this.paragraphSpacing; }
    get contentWidthPx() {
        return this.pageWidthPx - this.marginLeftPx - this.marginRightPx;
    }
    get contentHeightPx() {
        return this.pageHeightPx - this.marginTopPx - this.marginBottomPx;
    }

    get columnGapPx() { return mmToPx(this.columnGapMm); }

    get columnWidthPx() {
        const gapCount = Math.max(0, this.columnCount - 1);
        const totalGap = gapCount * this.columnGapPx;
        const availableWidth = this.contentWidthPx - totalGap;
        return Math.max(0, availableWidth / this.columnCount);
    }

    getColumnLeftPx(columnIndex) {
        if (columnIndex < 0 || columnIndex >= this.columnCount) return 0;
        return columnIndex * (this.columnWidthPx + this.columnGapPx);
    }

    getHeaderFontSize() {
        return Math.max(9, this.fontSizePt * 0.6);
    }

    getFooterFontSize() {
        return Math.max(9, this.fontSizePt * 0.6);
    }

    getFootnoteFontSize() {
        return Math.max(8, this.fontSizePt * 0.75);
    }

    getSidenoteFontSize() {
        return Math.max(8, this.fontSizePt * 0.7);
    }

    getSidenoteWidthPx() {
        return mmToPx(this.sidenoteWidthMm);
    }

    getSidenoteLeftPx() {
        return this.pageWidthPx - mmToPx(this.sidenoteWidthMm);
    }

    getContentRightPx() {
        return this.marginLeftPx + this.contentWidthPx;
    }

    getHeadingFontSize(level) {
        const multipliers = { 1: 2.0, 2: 1.5, 3: 1.25 };
        return this.fontSizePt * (multipliers[level] || 1);
    }
}

const InlineStyleType = {
    BOLD: 'bold',
    ITALIC: 'italic',
    FOOTNOTE_REF: 'footnote_ref',
    CROSS_REF: 'cross_ref',
    MARGIN_NOTE_REF: 'margin_note_ref'
};

class InlineStyle {
    constructor(type, start, end, extra = {}) {
        this.type = type;
        this.start = start;
        this.end = end;
        Object.assign(this, extra);
    }
}

const CrossRefTargetType = {
    HEADING: 'heading',
    IMAGE: 'image',
    TABLE: 'table'
};

const ImageFloatType = {
    NONE: 'none',
    LEFT: 'left',
    RIGHT: 'right'
};

if (typeof window !== 'undefined') {
    window.Types = {
        BlockType,
        BlockTypeLabels,
        PaperPresets,
        mmToPx,
        ptToPx,
        generateId,
        ContentBlock,
        LayoutParams,
        InlineStyleType,
        InlineStyle,
        CrossRefTargetType,
        ImageFloatType
    };
}
