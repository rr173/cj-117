class HeadingNumbering {
    constructor() {
        this.h1 = 0;
        this.h2 = 0;
        this.h3 = 0;
    }

    next(level) {
        if (level === 1) {
            this.h1++;
            this.h2 = 0;
            this.h3 = 0;
            return String(this.h1);
        } else if (level === 2) {
            this.h2++;
            this.h3 = 0;
            return `${this.h1}.${this.h2}`;
        } else if (level === 3) {
            this.h3++;
            return `${this.h1}.${this.h2}.${this.h3}`;
        }
        return '';
    }

    formatSection(numStr) {
        return `第${numStr}节`;
    }
}

class TocEntry {
    constructor(blockId, level, text, number, pageIndex = -1) {
        this.blockId = blockId;
        this.level = level;
        this.text = text;
        this.number = number;
        this.pageIndex = pageIndex;
    }
}

class DocumentProcessor {
    constructor() {
        this.layoutParams = new window.Types.LayoutParams();
        this.blocks = [];
        this.headingInfo = new Map();
        this.imageInfo = new Map();
        this.tableInfo = new Map();
        this.tocEntries = [];
        this.crossRefInfo = new Map();
        this.tocBlockId = null;
        this.pageNumberOffset = 0;
    }

    setParams(params) {
        this.layoutParams = params;
    }

    setBlocks(blocks) {
        this.blocks = blocks;
    }

    process() {
        this.headingInfo.clear();
        this.imageInfo.clear();
        this.tableInfo.clear();
        this.tocEntries = [];
        this.crossRefInfo.clear();
        this.tocBlockId = null;

        const numbering = new HeadingNumbering();
        let imageCounter = 0;
        let tableCounter = 0;

        for (const block of this.blocks) {
            switch (block.type) {
                case window.Types.BlockType.H1:
                case window.Types.BlockType.H2:
                case window.Types.BlockType.H3: {
                    const level = parseInt(block.type.substring(1));
                    const number = this.layoutParams.autoNumberHeading ? numbering.next(level) : '';
                    this.headingInfo.set(block.id, {
                        level,
                        text: block.data.text || '',
                        number,
                        pageIndex: -1
                    });
                    this.tocEntries.push(new TocEntry(block.id, level, block.data.text || '', number, -1));
                    break;
                }

                case window.Types.BlockType.IMAGE: {
                    imageCounter++;
                    this.imageInfo.set(block.id, {
                        number: imageCounter,
                        caption: block.data.caption || '',
                        pageIndex: -1
                    });
                    break;
                }

                case window.Types.BlockType.TABLE: {
                    tableCounter++;
                    this.tableInfo.set(block.id, {
                        number: tableCounter,
                        caption: block.data.caption || '',
                        pageIndex: -1
                    });
                    break;
                }

                case window.Types.BlockType.TOC: {
                    this.tocBlockId = block.id;
                    break;
                }

                case window.Types.BlockType.CROSS_REF: {
                    this.crossRefInfo.set(block.id, {
                        targetId: block.data.targetId || '',
                        targetType: block.data.targetType || '',
                        resolved: false
                    });
                    break;
                }
            }
        }

        return {
            headingInfo: this.headingInfo,
            imageInfo: this.imageInfo,
            tableInfo: this.tableInfo,
            tocEntries: this.tocEntries,
            crossRefInfo: this.crossRefInfo,
            tocBlockId: this.tocBlockId
        };
    }

    updatePageIndices(pages) {
        for (const page of pages) {
            for (const piece of page.pieces) {
                if (this.headingInfo.has(piece.blockId)) {
                    const info = this.headingInfo.get(piece.blockId);
                    if (info.pageIndex === -1 || !piece.data.continuation) {
                        info.pageIndex = page.index;
                    }
                }
                if (this.imageInfo.has(piece.blockId)) {
                    const info = this.imageInfo.get(piece.blockId);
                    if (info.pageIndex === -1) {
                        info.pageIndex = page.index;
                    }
                }
                if (this.tableInfo.has(piece.blockId)) {
                    const info = this.tableInfo.get(piece.blockId);
                    if (info.pageIndex === -1 || !piece.data.continuation) {
                        info.pageIndex = page.index;
                    }
                }
            }
        }

        for (const entry of this.tocEntries) {
            const info = this.headingInfo.get(entry.blockId);
            if (info) {
                entry.pageIndex = info.pageIndex;
            }
        }

        for (const [id, info] of this.crossRefInfo) {
            info.resolved = this._resolveCrossRef(info);
        }
    }

    _resolveCrossRef(info) {
        if (!info.targetId) return false;

        if (info.targetType === window.Types.CrossRefTargetType.HEADING) {
            return this.headingInfo.has(info.targetId);
        } else if (info.targetType === window.Types.CrossRefTargetType.IMAGE) {
            return this.imageInfo.has(info.targetId);
        } else if (info.targetType === window.Types.CrossRefTargetType.TABLE) {
            return this.tableInfo.has(info.targetId);
        }
        return false;
    }

    formatCrossRef(blockId) {
        const info = this.crossRefInfo.get(blockId);
        if (!info || !info.resolved) {
            return { text: '引用失效', invalid: true };
        }

        if (info.targetType === window.Types.CrossRefTargetType.HEADING) {
            const heading = this.headingInfo.get(info.targetId);
            if (!heading) return { text: '引用失效', invalid: true };
            const displayPage = heading.pageIndex >= 0 ? heading.pageIndex - this.pageNumberOffset + 1 : '?';
            if (this.layoutParams.autoNumberHeading && heading.number) {
                return {
                    text: `第${heading.number}节(第${displayPage}页)`,
                    invalid: false,
                    targetId: info.targetId
                };
            } else {
                return {
                    text: `「${heading.text}」(第${displayPage}页)`,
                    invalid: false,
                    targetId: info.targetId
                };
            }
        } else if (info.targetType === window.Types.CrossRefTargetType.IMAGE) {
            const img = this.imageInfo.get(info.targetId);
            if (!img) return { text: '引用失效', invalid: true };
            const displayPage = img.pageIndex >= 0 ? img.pageIndex - this.pageNumberOffset + 1 : '?';
            return {
                text: `图${img.number}(第${displayPage}页)`,
                invalid: false,
                targetId: info.targetId
            };
        } else if (info.targetType === window.Types.CrossRefTargetType.TABLE) {
            const tbl = this.tableInfo.get(info.targetId);
            if (!tbl) return { text: '引用失效', invalid: true };
            const displayPage = tbl.pageIndex >= 0 ? tbl.pageIndex - this.pageNumberOffset + 1 : '?';
            return {
                text: `表${tbl.number}(第${displayPage}页)`,
                invalid: false,
                targetId: info.targetId
            };
        }

        return { text: '引用失效', invalid: true };
    }

    getHeadingDisplay(blockId) {
        const info = this.headingInfo.get(blockId);
        if (!info) return '';
        if (this.layoutParams.autoNumberHeading && info.number) {
            return `${info.number} ${info.text}`;
        }
        return info.text;
    }

    getImageCaption(blockId) {
        const info = this.imageInfo.get(blockId);
        if (!info) return '';
        if (info.caption) {
            return `图${info.number} ${info.caption}`;
        }
        return `图${info.number}`;
    }

    getTableCaption(blockId) {
        const info = this.tableInfo.get(blockId);
        if (!info) return '';
        if (info.caption) {
            return `表${info.number} ${info.caption}`;
        }
        return `表${info.number}`;
    }

    getTocEntriesWithPageNumbers() {
        return this.tocEntries.map(entry => {
            const info = this.headingInfo.get(entry.blockId);
            let pageNum = entry.pageIndex;
            if (pageNum >= 0) {
                pageNum = pageNum - this.pageNumberOffset + 1;
            }
            let displayText = entry.text;
            if (this.layoutParams.autoNumberHeading && entry.number) {
                displayText = `${entry.number} ${entry.text}`;
            }
            return {
                ...entry,
                displayPage: pageNum >= 0 ? pageNum : '?',
                displayText
            };
        });
    }

    calculateTocHeight(layoutParams, lineBreaker) {
        if (!this.tocBlockId || this.tocEntries.length === 0) return 0;

        const tocTitle = '目录';
        const titleFontSizePt = layoutParams.getHeadingFontSize(1);
        const titleFontSizePx = ptToPx(titleFontSizePt);
        const titleLineHeight = titleFontSizePx * Math.max(1.2, layoutParams.lineHeight - 0.2);

        const entryFontSizePx = layoutParams.fontSizePx;
        const entryLineHeight = layoutParams.lineHeightPx;

        let totalHeight = titleLineHeight + layoutParams.paragraphSpacingPx;

        for (const entry of this.tocEntries) {
            let displayText = entry.text;
            if (this.layoutParams.autoNumberHeading && entry.number) {
                displayText = `${entry.number} ${entry.text}`;
            }
            const lines = lineBreaker.breakLinesMinRaggedness(
                displayText + ' ...... ' + (entry.pageIndex + 1),
                layoutParams.contentWidthPx,
                entryFontSizePx,
                layoutParams.fontFamily,
                []
            );
            totalHeight += lines.length * entryLineHeight;
        }

        return totalHeight;
    }

    setPageNumberOffset(offset) {
        this.pageNumberOffset = offset;
    }

    getAvailableTargets(type) {
        const targets = [];

        if (type === window.Types.CrossRefTargetType.HEADING || !type) {
            for (const [id, info] of this.headingInfo) {
                let label = info.text;
                if (this.layoutParams.autoNumberHeading && info.number) {
                    label = `${info.number} ${info.text}`;
                }
                targets.push({
                    id,
                    type: window.Types.CrossRefTargetType.HEADING,
                    label: `📌 ${label || '(无标题)'}`
                });
            }
        }

        if (type === window.Types.CrossRefTargetType.IMAGE || !type) {
            for (const [id, info] of this.imageInfo) {
                targets.push({
                    id,
                    type: window.Types.CrossRefTargetType.IMAGE,
                    label: `🖼️ 图${info.number} ${info.caption || ''}`
                });
            }
        }

        if (type === window.Types.CrossRefTargetType.TABLE || !type) {
            for (const [id, info] of this.tableInfo) {
                targets.push({
                    id,
                    type: window.Types.CrossRefTargetType.TABLE,
                    label: `📊 表${info.number} ${info.caption || ''}`
                });
            }
        }

        return targets;
    }
}

if (typeof window !== 'undefined') {
    window.DocumentProcessor = DocumentProcessor;
}
