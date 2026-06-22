class RenderedBlockPiece {
    constructor(blockId, type, data = {}) {
        this.blockId = blockId;
        this.type = type;
        this.data = data;
        this.pageIndex = -1;
        this.top = 0;
        this.left = 0;
        this.height = 0;
        this.width = 0;
        this.columnIndex = 0;
        this.spanColumns = 1;
        this.isSpanning = false;
    }
}

class FloatingImage {
    constructor(piece, top, columnWidth) {
        this.piece = piece;
        this.top = top;
        this.bottom = top + piece.height;
        this.width = piece.width;
        this.floatType = piece.data.floatType;
        this.columnWidth = columnWidth;
    }

    getLineWidth(currentTop) {
        if (currentTop < this.top || currentTop >= this.bottom) {
            return this.columnWidth;
        }
        if (this.floatType === window.Types.ImageFloatType.LEFT) {
            return this.columnWidth - this.width - 8;
        } else if (this.floatType === window.Types.ImageFloatType.RIGHT) {
            return this.columnWidth - this.width - 8;
        }
        return this.columnWidth;
    }

    getLeftOffset(currentTop) {
        if (currentTop < this.top || currentTop >= this.bottom) {
            return 0;
        }
        if (this.floatType === window.Types.ImageFloatType.LEFT) {
            return this.width + 8;
        }
        return 0;
    }

    isActive(currentTop) {
        return currentTop >= this.top && currentTop < this.bottom;
    }
}

class ColumnState {
    constructor(index, layoutParams) {
        this.index = index;
        this.layoutParams = layoutParams;
        this.currentTop = 0;
        this.floatingImages = [];
    }

    get width() {
        return this.layoutParams.columnWidthPx;
    }

    getAvailableWidth(currentTop) {
        let availableWidth = this.width;
        for (const img of this.floatingImages) {
            if (img.isActive(currentTop)) {
                availableWidth = Math.min(availableWidth, img.getLineWidth(currentTop));
            }
        }
        return Math.max(0, availableWidth);
    }

    getLeftOffset(currentTop) {
        let offset = 0;
        for (const img of this.floatingImages) {
            if (img.isActive(currentTop)) {
                offset = Math.max(offset, img.getLeftOffset(currentTop));
            }
        }
        return offset;
    }

    cleanupFloatingImages(currentTop) {
        this.floatingImages = this.floatingImages.filter(img => currentTop < img.bottom);
    }

    addFloatingImage(img) {
        this.floatingImages.push(img);
    }

    hasActiveFloating(currentTop) {
        return this.floatingImages.some(img => img.isActive(currentTop));
    }

    getActiveFloatings(currentTop) {
        return this.floatingImages.filter(img => img.isActive(currentTop));
    }
}

class Page {
    constructor(index, layoutParams) {
        this.index = index;
        this.layoutParams = layoutParams;
        this.pieces = [];
        this.footnotes = [];
        this.footnoteAreaHeight = 0;
        this.sidenotes = [];
        this.sidenoteAreaHeight = 0;
        this.hasSidenoteContinuation = false;
        this.columns = [];
        for (let i = 0; i < layoutParams.columnCount; i++) {
            this.columns.push(new ColumnState(i, layoutParams));
        }
        this.currentColumnIndex = 0;
    }

    get availableTop() {
        let top = 0;
        if (this.layoutParams.showHeader) {
            top += ptToPx(this.layoutParams.getHeaderFontSize()) + 12;
        }
        return top;
    }

    get availableBottom() {
        let bottom = this.layoutParams.contentHeightPx;
        if (this.layoutParams.showPageNumber) {
            bottom -= ptToPx(this.layoutParams.getFooterFontSize()) + 8;
        }
        bottom -= this.footnoteAreaHeight;
        return bottom;
    }

    getColumnRemainingHeight(columnIndex) {
        const col = this.columns[columnIndex];
        return Math.max(0, this.availableBottom - col.currentTop);
    }

    getCurrentColumn() {
        return this.columns[this.currentColumnIndex];
    }

    advanceColumn() {
        this.currentColumnIndex++;
        if (this.currentColumnIndex >= this.layoutParams.columnCount) {
            return false;
        }
        return true;
    }

    hasMoreColumns() {
        return this.currentColumnIndex < this.layoutParams.columnCount - 1;
    }

    getRemainingHeight(currentColumnIndex = null) {
        const idx = currentColumnIndex != null ? currentColumnIndex : this.currentColumnIndex;
        return this.getColumnRemainingHeight(idx);
    }

    addPiece(piece, top, columnIndex = null, left = 0) {
        piece.pageIndex = this.index;
        piece.top = top;
        piece.left = left;
        piece.columnIndex = columnIndex != null ? columnIndex : this.currentColumnIndex;
        this.pieces.push(piece);
        if (columnIndex == null) {
            columnIndex = this.currentColumnIndex;
        }
        if (!piece.isSpanning && !(piece.data && piece.data.isFloating)) {
            this.columns[columnIndex].currentTop = Math.max(this.columns[columnIndex].currentTop, top + piece.height);
        }
    }

    addSpanningPiece(piece, top) {
        piece.pageIndex = this.index;
        piece.top = top;
        piece.left = 0;
        piece.columnIndex = 0;
        piece.spanColumns = this.layoutParams.columnCount;
        piece.isSpanning = true;
        this.pieces.push(piece);

        for (let i = 0; i < this.layoutParams.columnCount; i++) {
            this.columns[i].currentTop = Math.max(this.columns[i].currentTop, top + piece.height);
        }
        this.currentColumnIndex = 0;
    }
}

class PaginationEngine {
    constructor() {
        this.layoutParams = new window.Types.LayoutParams();
        this.blocks = [];
        this.pages = [];
        this.footnoteCounter = 0;
        this.footnoteMap = {};
        this.sidenoteCounter = 0;
        this.sidenoteMap = {};
        this.documentProcessor = null;
    }

    setParams(params) {
        this.layoutParams = params;
    }

    setBlocks(blocks) {
        this.blocks = blocks;
    }

    setDocumentProcessor(dp) {
        this.documentProcessor = dp;
    }

    getEffectiveWidth(block) {
        if (this.layoutParams.columnCount === 1) {
            return this.layoutParams.contentWidthPx;
        }
        if (this._shouldSpanAllColumns(block)) {
            return this.layoutParams.contentWidthPx;
        }
        return this.layoutParams.columnWidthPx;
    }

    _shouldSpanAllColumns(block) {
        if (this.layoutParams.columnCount === 1) return false;

        if (block.type === window.Types.BlockType.H1) {
            return true;
        }

        if (block.type === window.Types.BlockType.IMAGE) {
            const [w, h] = block.data.aspectRatio.split(':').map(Number);
            const ratio = h / w;
            const columnWidth = this.layoutParams.columnWidthPx;
            const fullWidth = this.layoutParams.contentWidthPx;
            const imgWidthSingle = columnWidth * 0.5;
            const imgWidthIfSingle = imgWidthSingle;
            const contentWidthForSingle = columnWidth;
            const thresholdWidth = contentWidthForSingle * 0.8;
            const floatType = block.data.floatType || window.Types.ImageFloatType.NONE;
            if (floatType !== window.Types.ImageFloatType.NONE) {
                return false;
            }
            const imgWidthAtSingle = contentWidthForSingle * ratio;
            const imgWidthIfFull = fullWidth * ratio;
            const estimatedImgWidth = columnWidth;
            return estimatedImgWidth > thresholdWidth;
        }

        if (block.type === window.Types.BlockType.TOC) {
            return true;
        }

        return false;
    }

    _calculateImageWidth(block, forSpanningCheck = false) {
        if (forSpanningCheck) {
            return this.layoutParams.columnWidthPx;
        }
        const floatType = block.data.floatType || window.Types.ImageFloatType.NONE;
        if (floatType !== window.Types.ImageFloatType.NONE && this.layoutParams.columnCount > 1) {
            return this.layoutParams.columnWidthPx * 0.5;
        }
        if (this._shouldSpanAllColumns(block)) {
            return this.layoutParams.contentWidthPx;
        }
        return this.layoutParams.columnWidthPx;
    }

    getHeadingHeight(level) {
        const fontSizePt = this.layoutParams.getHeadingFontSize(level);
        const fontSizePx = ptToPx(fontSizePt);
        const lineHeightPx = fontSizePx * Math.max(1.2, this.layoutParams.lineHeight - 0.2);
        return lineHeightPx;
    }

    getHeadingLines(text, level, column) {
        const fontSizePt = this.layoutParams.getHeadingFontSize(level);
        const fontSizePx = ptToPx(fontSizePt);
        const width = column && !this.layoutParams.columnCount === 1 ? column.getAvailableWidth(column.currentTop) : this.getEffectiveWidth({ type: `h${level}` });
        return window.LineBreaker.breakLinesMinRaggedness(
            text,
            width,
            fontSizePx,
            this.layoutParams.fontFamily,
            []
        );
    }

    getParagraphHeight(text, inlineStyles, column) {
        const lines = this.getParagraphLines(text, inlineStyles, column);
        return lines.length * this.layoutParams.lineHeightPx;
    }

    getParagraphLines(text, inlineStyles, column, startTop = 0) {
        const columnWidth = column ? column.width : this.layoutParams.columnWidthPx;
        const availableWidth = column ? column.getAvailableWidth(column.currentTop + startTop) : columnWidth;
        return window.LineBreaker.breakLinesMinRaggedness(
            text,
            availableWidth,
            this.layoutParams.fontSizePx,
            this.layoutParams.fontFamily,
            inlineStyles
        );
    }

    getImageHeight(block, width = null) {
        const [w, h] = block.data.aspectRatio.split(':').map(Number);
        const ratio = h / w;
        const imgWidth = width || this._calculateImageWidth(block);
        const imgHeight = imgWidth * ratio;

        const captionWidth = width || this._calculateImageWidth(block);
        const captionLines = window.LineBreaker.breakLinesMinRaggedness(
            block.data.caption || '',
            captionWidth,
            this.layoutParams.fontSizePx * 0.85,
            this.layoutParams.fontFamily
        );
        const captionHeight = captionLines.length * this.layoutParams.lineHeightPx * 0.85;
        return imgHeight + captionHeight + 4;
    }

    getTableHeight(block, startRow = 0, maxHeight = Infinity, width = null) {
        const tableWidth = width || this.layoutParams.contentWidthPx;
        const fontSizePx = this.layoutParams.fontSizePx * 0.9;
        const lineHeightPx = fontSizePx * 1.3;
        const cellPaddingV = 8;
        const borderHeight = 1;

        const headers = block.data.headers;
        const rows = block.data.rows;
        const colWidth = tableWidth / block.data.columns;

        let totalHeight = 0;
        let usedRows = 0;

        if (startRow === 0 && block.data.caption) {
            const captionFontSize = this.layoutParams.fontSizePx * 0.9;
            const captionLineHeight = this.layoutParams.lineHeightPx * 0.9;
            const captionLines = window.LineBreaker.breakLinesMinRaggedness(
                block.data.caption,
                tableWidth,
                captionFontSize,
                this.layoutParams.fontFamily
            );
            totalHeight += captionLines.length * captionLineHeight + 6;
        }

        if (startRow === 0) {
            let headerMaxLines = 1;
            for (const h of headers) {
                const lines = window.LineBreaker.breakLinesMinRaggedness(
                    h, colWidth, fontSizePx, this.layoutParams.fontFamily
                );
                headerMaxLines = Math.max(headerMaxLines, lines.length);
            }
            totalHeight += headerMaxLines * lineHeightPx + cellPaddingV * 2 + borderHeight;
        }

        for (let i = startRow; i < rows.length; i++) {
            let rowMaxLines = 1;
            for (const cell of rows[i]) {
                const lines = window.LineBreaker.breakLinesMinRaggedness(
                    cell, colWidth, fontSizePx, this.layoutParams.fontFamily
                );
                rowMaxLines = Math.max(rowMaxLines, lines.length);
            }
            const rowHeight = rowMaxLines * lineHeightPx + cellPaddingV * 2 + borderHeight;

            if (totalHeight + rowHeight > maxHeight && i > startRow) {
                break;
            }

            totalHeight += rowHeight;
            usedRows++;
        }

        return {
            height: totalHeight,
            rowsRendered: usedRows,
            nextRow: startRow + usedRows
        };
    }

    getFootnoteHeight(footnotes) {
        if (footnotes.length === 0) return 0;

        const separatorHeight = 8;
        const fontSizePx = ptToPx(this.layoutParams.getFootnoteFontSize());
        const lineHeightPx = fontSizePx * 1.5;
        const footnoteSpacing = 3;

        let totalHeight = separatorHeight;

        for (const fn of footnotes) {
            const lines = window.LineBreaker.breakLinesMinRaggedness(
                fn.text,
                this.layoutParams.contentWidthPx,
                fontSizePx,
                this.layoutParams.fontFamily
            );
            totalHeight += lines.length * lineHeightPx + footnoteSpacing;
        }

        return totalHeight;
    }

    getTocHeight(block) {
        if (!this.documentProcessor) {
            const titleFontSizePt = this.layoutParams.getHeadingFontSize(1);
            const titleFontSizePx = ptToPx(titleFontSizePt);
            const titleLineHeight = titleFontSizePx * Math.max(1.2, this.layoutParams.lineHeight - 0.2);
            return titleLineHeight + this.layoutParams.paragraphSpacingPx + 5 * this.layoutParams.lineHeightPx;
        }
        return this.documentProcessor.calculateTocHeight(this.layoutParams, window.LineBreaker);
    }

    getCrossRefHeight(block) {
        return this.layoutParams.lineHeightPx;
    }

    getSidenoteHeight(block) {
        const fontSizePx = ptToPx(this.layoutParams.getSidenoteFontSize());
        const lineHeightPx = fontSizePx * 1.5;
        const sidenoteWidth = this.layoutParams.getSidenoteWidthPx();

        const lines = window.LineBreaker.breakLinesMinRaggedness(
            block.data.noteText || '',
            sidenoteWidth,
            fontSizePx,
            this.layoutParams.fontFamily
        );

        const numberWidth = fontSizePx * 1.5;
        const adjustedLines = lines.length > 0 ? lines.length : 1;

        return adjustedLines * lineHeightPx + 4;
    }

    calculateSidenotePositions(page, pendingSidenotes) {
        const contentHeight = this.layoutParams.contentHeightPx;
        const sidenoteWidth = this.layoutParams.getSidenoteWidthPx();
        const fontSizePx = ptToPx(this.layoutParams.getSidenoteFontSize());
        const lineHeightPx = fontSizePx * 1.5;

        const positionedSidenotes = [];
        const overflowSidenotes = [];

        let currentTop = page.availableTop;

        pendingSidenotes.forEach(sidenote => {
            const noteHeight = this.getSidenoteHeight({ data: { noteText: sidenote.text } });
            let targetTop = sidenote.anchorTop;

            if (targetTop < currentTop) {
                targetTop = currentTop;
            }

            if (targetTop + noteHeight > contentHeight - page.footnoteAreaHeight) {
                overflowSidenotes.push(sidenote);
            } else {
                positionedSidenotes.push({
                    ...sidenote,
                    top: targetTop,
                    height: noteHeight,
                    width: sidenoteWidth
                });
                currentTop = targetTop + noteHeight + 6;
            }
        });

        return { positioned: positionedSidenotes, overflow: overflowSidenotes };
    }

    splitParagraphLinesForPage(lines, startLine, availableHeight, requireComplete = false) {
        const lineHeight = this.layoutParams.lineHeightPx;
        const maxLines = Math.floor(availableHeight / lineHeight);

        if (requireComplete) {
            const totalLines = lines.length - startLine;
            if (maxLines >= totalLines) {
                return { endLine: lines.length, pageCount: totalLines, fits: true };
            }
            return { endLine: startLine, pageCount: 0, fits: false };
        }

        const canTake = Math.min(maxLines, lines.length - startLine);
        const fits = canTake >= (lines.length - startLine);
        return { endLine: startLine + canTake, pageCount: canTake, fits };
    }

    applyWidowOrphanAdjustment(lines, splitAt, paragraphStart) {
        const totalLines = lines.length;
        const linesOnThisPage = splitAt - paragraphStart;
        const linesOnNextPage = totalLines - splitAt;

        if (linesOnNextPage === 1 && splitAt > paragraphStart + 1) {
            return splitAt - 1;
        }

        if (linesOnThisPage === 1 && splitAt + 1 < totalLines) {
            return splitAt + 1;
        }

        return splitAt;
    }

    _checkFloatingImageSpace(block, column, availableHeight) {
        const floatType = block.data.floatType || window.Types.ImageFloatType.NONE;
        if (floatType === window.Types.ImageFloatType.NONE) {
            return { canFloat: false };
        }

        const halfColumnWidth = this.layoutParams.columnWidthPx * 0.5;
        const remainingWidth = this.layoutParams.columnWidthPx - halfColumnWidth - 8;
        const minTextWidth = this.layoutParams.columnWidthPx * 0.3;

        if (remainingWidth < minTextWidth) {
            return { canFloat: false };
        }

        const imgHeight = this.getImageHeight(block, halfColumnWidth);
        if (imgHeight > availableHeight) {
            return { canFloat: false };
        }

        return { canFloat: true, imgWidth: halfColumnWidth, imgHeight };
    }

    _layoutBlockWithFloating(block, page, column) {
        const floatType = block.data.floatType || window.Types.ImageFloatType.NONE;
        if (floatType === window.Types.ImageFloatType.NONE) {
            return null;
        }

        const availableHeight = page.getColumnRemainingHeight(column.index);
        const check = this._checkFloatingImageSpace(block, column, availableHeight);

        if (!check.canFloat) {
            return null;
        }

        const piece = new RenderedBlockPiece(block.id, block.type, {
            aspectRatio: block.data.aspectRatio,
            caption: block.data.caption,
            altText: block.data.altText,
            floatType: floatType
        });
        piece.height = check.imgHeight;
        piece.width = check.imgWidth;
        piece.isFloating = true;
        piece.data.isFloating = true;
        piece.data.renderedWidth = check.imgWidth;

        const leftInColumn = floatType === window.Types.ImageFloatType.LEFT ? 0 : (column.width - check.imgWidth);
        const absoluteLeft = this.layoutParams.getColumnLeftPx(column.index) + leftInColumn;

        page.addPiece(piece, column.currentTop, column.index, absoluteLeft);

        const floating = new FloatingImage(piece, column.currentTop, column.width);
        column.addFloatingImage(floating);

        return { piece, consumed: false };
    }

    findBlocksForColumn(startBlockIndex, startOffset, page, columnIndex) {
        const pieces = [];
        let currentBlockIndex = startBlockIndex;
        const pageFootnotes = [];
        const column = page.columns[columnIndex];

        while (currentBlockIndex < this.blocks.length) {
            const block = this.blocks[currentBlockIndex];
            const blockType = block.type;

            const remainingHeight = page.getColumnRemainingHeight(columnIndex);
            if (remainingHeight < this.layoutParams.lineHeightPx) {
                break;
            }

            const shouldSpan = this._shouldSpanAllColumns(block);

            if (shouldSpan && columnIndex !== 0) {
                break;
            }

            if (shouldSpan && column.hasActiveFloating(column.currentTop)) {
                column.currentTop = Math.max(column.currentTop, ...column.floatingImages.map(f => f.bottom));
                column.cleanupFloatingImages(column.currentTop);
            }

            switch (blockType) {
                case window.Types.BlockType.H1:
                case window.Types.BlockType.H2:
                case window.Types.BlockType.H3: {
                    const level = parseInt(blockType.substring(1));
                    const useWidth = shouldSpan ? this.layoutParams.contentWidthPx : column.getAvailableWidth(column.currentTop);
                    const fontSizePt = this.layoutParams.getHeadingFontSize(level);
                    const fontSizePx = ptToPx(fontSizePt);
                    const headingLines = window.LineBreaker.breakLinesMinRaggedness(
                        block.data.text || '标题',
                        useWidth,
                        fontSizePx,
                        this.layoutParams.fontFamily,
                        []
                    );
                    const headingHeight = headingLines.length * this.getHeadingHeight(level);

                    if (column.currentTop + headingHeight <= page.availableBottom) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            lines: headingLines,
                            level,
                            text: block.data.text
                        });
                        piece.height = headingHeight;
                        piece.width = useWidth;

                        if (shouldSpan) {
                            for (let i = 0; i < page.columns.length; i++) {
                                const otherCol = page.columns[i];
                                if (otherCol.currentTop > column.currentTop) {
                                    column.currentTop = otherCol.currentTop;
                                }
                            }
                            pieces.push({ piece, top: column.currentTop, spanning: true });
                            column.currentTop += headingHeight;
                            for (let i = 0; i < page.columns.length; i++) {
                                page.columns[i].currentTop = column.currentTop;
                            }
                        } else {
                            const leftOffset = column.getLeftOffset(column.currentTop);
                            const absLeft = this.layoutParams.getColumnLeftPx(columnIndex) + leftOffset;
                            pieces.push({ piece, top: column.currentTop, left: absLeft, column: columnIndex });
                            column.currentTop += headingHeight;
                        }
                        currentBlockIndex++;
                    } else {
                        if (column.currentTop === page.availableTop && pieces.length === 0) {
                            const availableLines = Math.floor(remainingHeight / this.getHeadingHeight(level));
                            if (availableLines > 0) {
                                const splitLines = headingLines.slice(0, availableLines);
                                const piece = new RenderedBlockPiece(block.id, blockType, {
                                    lines: splitLines,
                                    level,
                                    text: block.data.text,
                                    partial: true,
                                    nextLine: availableLines
                                });
                                piece.height = availableLines * this.getHeadingHeight(level);
                                piece.width = useWidth;
                                if (shouldSpan) {
                                    pieces.push({ piece, top: column.currentTop, spanning: true });
                                    column.currentTop += piece.height;
                                    for (let i = 0; i < page.columns.length; i++) {
                                        page.columns[i].currentTop = column.currentTop;
                                    }
                                } else {
                                    const leftOffset = column.getLeftOffset(column.currentTop);
                                    const absLeft = this.layoutParams.getColumnLeftPx(columnIndex) + leftOffset;
                                    pieces.push({ piece, top: column.currentTop, left: absLeft, column: columnIndex });
                                    column.currentTop += piece.height;
                                }
                                return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: availableLines, footnotes: pageFootnotes };
                            }
                        }
                        return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                    }
                    break;
                }

                case window.Types.BlockType.PARAGRAPH: {
                    const prevBlock = currentBlockIndex > 0 ? this.blocks[currentBlockIndex - 1] : null;
                    const isAfterHeading = prevBlock &&
                        (prevBlock.type === window.Types.BlockType.H1 ||
                         prevBlock.type === window.Types.BlockType.H2 ||
                         prevBlock.type === window.Types.BlockType.H3);

                    const startLine = startOffset || 0;
                    let lineOffset = startLine;
                    let paragraphDone = false;
                    let pieceCreated = false;
                    let isFirstPieceInBlock = startLine === 0;
                    let allPiecesCreated = [];

                    while (!paragraphDone) {
                        const segmentTop = column.currentTop;
                        const curUseWidth = column.getAvailableWidth(segmentTop);
                        const activeFloats = column.getActiveFloatings(segmentTop);

                        let nextBreakTop = page.availableBottom;
                        for (const f of activeFloats) {
                            if (f.bottom > segmentTop && f.bottom < nextBreakTop) {
                                nextBreakTop = f.bottom;
                            }
                        }
                        if (activeFloats.length === 0) {
                            nextBreakTop = page.availableBottom;
                        }

                        const fullLines = window.LineBreaker.breakLinesMinRaggedness(
                            block.data.text,
                            curUseWidth,
                            this.layoutParams.fontSizePx,
                            this.layoutParams.fontFamily,
                            block.data.inlineStyles || []
                        );

                        const remainingLines = fullLines.slice(lineOffset);
                        if (remainingLines.length === 0) {
                            paragraphDone = true;
                            break;
                        }

                        const maxLinesInSegment = Math.max(1, Math.floor((nextBreakTop - segmentTop) / this.layoutParams.lineHeightPx));
                        const maxLinesOnPage = Math.max(0, Math.floor((page.availableBottom - segmentTop) / this.layoutParams.lineHeightPx));
                        let segmentLineCount = Math.min(maxLinesInSegment, remainingLines.length, maxLinesOnPage);

                        if (segmentLineCount <= 0) {
                            if (!pieceCreated) {
                                return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: lineOffset, footnotes: pageFootnotes };
                            }
                            break;
                        }

                        if (isFirstPieceInBlock && isAfterHeading && remainingLines.length < 2 && (pieces.length > 0 || allPiecesCreated.length > 0)) {
                            if (!pieceCreated) {
                                return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                            }
                            break;
                        }

                        if (!isFirstPieceInBlock && segmentLineCount < 2 && !pieceCreated) {
                            if (maxLinesOnPage < 2) {
                                return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: lineOffset, footnotes: pageFootnotes };
                            }
                        }

                        let applySplit = segmentLineCount;
                        if (!pieceCreated && segmentLineCount < remainingLines.length) {
                            applySplit = this.applyWidowOrphanAdjustment(remainingLines, segmentLineCount, 0);
                            if (applySplit <= 0) applySplit = segmentLineCount;
                        }
                        segmentLineCount = applySplit;

                        const segmentLines = remainingLines.slice(0, segmentLineCount);
                        const segHeight = segmentLines.length * this.layoutParams.lineHeightPx;

                        const footnoteRefs = (block.data.inlineStyles || []).filter(
                            s => s.type === window.Types.InlineStyleType.FOOTNOTE_REF
                        );
                        for (const ref of footnoteRefs) {
                            if (!this.footnoteMap[ref.footnoteId]) {
                                this.footnoteCounter++;
                                this.footnoteMap[ref.footnoteId] = this.footnoteCounter;
                                pageFootnotes.push({
                                    number: this.footnoteCounter,
                                    text: ref.footnoteText,
                                    blockId: block.id
                                });
                            }
                            ref.footnoteNumber = this.footnoteMap[ref.footnoteId];
                        }

                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            lines: segmentLines,
                            text: block.data.text,
                            inlineStyles: block.data.inlineStyles || [],
                            partial: (lineOffset + segmentLineCount) < fullLines.length,
                            continuation: !isFirstPieceInBlock,
                            nextLine: lineOffset + segmentLineCount
                        });
                        piece.height = segHeight;
                        piece.width = curUseWidth;
                        const leftOffset = column.getLeftOffset(segmentTop);
                        const absLeft = this.layoutParams.getColumnLeftPx(columnIndex) + leftOffset;
                        const pieceInfo = { piece, top: segmentTop, left: absLeft, column: columnIndex };
                        pieces.push(pieceInfo);
                        allPiecesCreated.push(pieceInfo);
                        pieceCreated = true;
                        column.currentTop += segHeight;
                        column.cleanupFloatingImages(column.currentTop);

                        lineOffset += segmentLineCount;
                        isFirstPieceInBlock = false;

                        if (lineOffset >= fullLines.length) {
                            column.currentTop += this.layoutParams.paragraphSpacingPx;
                            paragraphDone = true;
                            currentBlockIndex++;
                        } else {
                            if (column.currentTop >= page.availableBottom - this.layoutParams.lineHeightPx) {
                                return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: lineOffset, footnotes: pageFootnotes };
                            }
                        }
                    }
                    break;
                }

                case window.Types.BlockType.IMAGE: {
                    const floatType = block.data.floatType || window.Types.ImageFloatType.NONE;

                    if (floatType !== window.Types.ImageFloatType.NONE && !shouldSpan) {
                        const floatResult = this._layoutBlockWithFloating(block, page, column);
                        if (floatResult) {
                            const p = floatResult.piece;
                            pieces.push({
                                piece: p,
                                top: p.top,
                                left: p.left,
                                column: columnIndex,
                                floating: true
                            });
                            currentBlockIndex++;
                            continue;
                        }
                    }

                    const useWidth = shouldSpan ? this.layoutParams.contentWidthPx : column.width;
                    const imgHeight = this.getImageHeight(block, useWidth);

                    if (column.currentTop + imgHeight <= page.availableBottom) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            aspectRatio: block.data.aspectRatio,
                            caption: block.data.caption,
                            altText: block.data.altText,
                            renderedWidth: useWidth
                        });
                        piece.height = imgHeight;
                        piece.width = useWidth;
                        if (shouldSpan) {
                            for (let i = 0; i < page.columns.length; i++) {
                                const otherCol = page.columns[i];
                                if (otherCol.currentTop > column.currentTop) {
                                    column.currentTop = otherCol.currentTop;
                                }
                            }
                            pieces.push({ piece, top: column.currentTop, spanning: true });
                            column.currentTop += imgHeight + this.layoutParams.paragraphSpacingPx;
                            for (let i = 0; i < page.columns.length; i++) {
                                page.columns[i].currentTop = column.currentTop;
                            }
                        } else {
                            const absLeft = this.layoutParams.getColumnLeftPx(columnIndex);
                            pieces.push({ piece, top: column.currentTop, left: absLeft, column: columnIndex });
                            column.currentTop += imgHeight + this.layoutParams.paragraphSpacingPx;
                        }
                        currentBlockIndex++;
                    } else {
                        if (column.currentTop === page.availableTop && pieces.length === 0) {
                            const piece = new RenderedBlockPiece(block.id, blockType, {
                                aspectRatio: block.data.aspectRatio,
                                caption: block.data.caption,
                                altText: block.data.altText,
                                renderedWidth: useWidth
                            });
                            piece.height = imgHeight;
                            piece.width = useWidth;
                            if (shouldSpan) {
                                pieces.push({ piece, top: column.currentTop, spanning: true });
                                column.currentTop += imgHeight;
                                for (let i = 0; i < page.columns.length; i++) {
                                    page.columns[i].currentTop = column.currentTop;
                                }
                            } else {
                                const absLeft = this.layoutParams.getColumnLeftPx(columnIndex);
                                pieces.push({ piece, top: column.currentTop, left: absLeft, column: columnIndex });
                                column.currentTop += imgHeight;
                            }
                            currentBlockIndex++;
                        } else {
                            return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                        }
                    }
                    break;
                }

                case window.Types.BlockType.TABLE: {
                    const useWidth = shouldSpan ? this.layoutParams.contentWidthPx : column.width;
                    const tableInfo = this.getTableHeight(block, 0, remainingHeight, useWidth);
                    const halfPage = this.layoutParams.contentHeightPx / 2;

                    if (tableInfo.height <= remainingHeight) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            headers: block.data.headers,
                            rows: block.data.rows,
                            columns: block.data.columns,
                            caption: block.data.caption || '',
                            startRow: 0,
                            rowCount: block.data.rows.length,
                            repeatedHeader: false,
                            renderedWidth: useWidth
                        });
                        piece.height = tableInfo.height;
                        piece.width = useWidth;
                        if (shouldSpan) {
                            for (let i = 0; i < page.columns.length; i++) {
                                const otherCol = page.columns[i];
                                if (otherCol.currentTop > column.currentTop) {
                                    column.currentTop = otherCol.currentTop;
                                }
                            }
                            pieces.push({ piece, top: column.currentTop, spanning: true });
                            column.currentTop += tableInfo.height + this.layoutParams.paragraphSpacingPx;
                            for (let i = 0; i < page.columns.length; i++) {
                                page.columns[i].currentTop = column.currentTop;
                            }
                        } else {
                            const absLeft = this.layoutParams.getColumnLeftPx(columnIndex);
                            pieces.push({ piece, top: column.currentTop, left: absLeft, column: columnIndex });
                            column.currentTop += tableInfo.height + this.layoutParams.paragraphSpacingPx;
                        }
                        currentBlockIndex++;
                    } else if (tableInfo.height > halfPage) {
                        const partialInfo = this.getTableHeight(block, 0, remainingHeight, useWidth);
                        if (partialInfo.rowsRendered > 1) {
                            const piece = new RenderedBlockPiece(block.id, blockType, {
                                headers: block.data.headers,
                                rows: block.data.rows,
                                columns: block.data.columns,
                                caption: block.data.caption || '',
                                startRow: 0,
                                rowCount: partialInfo.rowsRendered,
                                partial: true,
                                nextRow: partialInfo.nextRow,
                                repeatedHeader: false,
                                renderedWidth: useWidth
                            });
                            piece.height = partialInfo.height;
                            piece.width = useWidth;
                            if (shouldSpan) {
                                pieces.push({ piece, top: column.currentTop, spanning: true });
                                column.currentTop += partialInfo.height;
                                for (let i = 0; i < page.columns.length; i++) {
                                    page.columns[i].currentTop = column.currentTop;
                                }
                            } else {
                                const absLeft = this.layoutParams.getColumnLeftPx(columnIndex);
                                pieces.push({ piece, top: column.currentTop, left: absLeft, column: columnIndex });
                                column.currentTop += partialInfo.height;
                            }
                            return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: partialInfo.nextRow, footnotes: pageFootnotes };
                        } else {
                            return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                        }
                    } else {
                        return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                    }
                    break;
                }

                case window.Types.BlockType.FOOTNOTE_REF: {
                    this.footnoteCounter++;
                    const footnoteNum = this.footnoteCounter;
                    pageFootnotes.push({
                        number: footnoteNum,
                        text: block.data.footnoteText,
                        blockId: block.id
                    });

                    const refText = block.data.refText || '';
                    const fullText = refText + '²';
                    const fnStyle = new window.Types.InlineStyle(
                        window.Types.InlineStyleType.FOOTNOTE_REF,
                        refText.length,
                        fullText.length,
                        { footnoteNumber: footnoteNum }
                    );
                    const useWidth = column.getAvailableWidth(column.currentTop);
                    const lines = window.LineBreaker.breakLinesMinRaggedness(
                        fullText,
                        useWidth,
                        this.layoutParams.fontSizePx,
                        this.layoutParams.fontFamily,
                        [fnStyle]
                    );

                    const height = lines.length * this.layoutParams.lineHeightPx;
                    if (column.currentTop + height <= page.availableBottom) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            lines: lines,
                            text: fullText,
                            inlineStyles: [fnStyle],
                            footnoteNumber: footnoteNum
                        });
                        piece.height = height;
                        piece.width = useWidth;
                        const leftOffset = column.getLeftOffset(column.currentTop);
                        const absLeft = this.layoutParams.getColumnLeftPx(columnIndex) + leftOffset;
                        pieces.push({ piece, top: column.currentTop, left: absLeft, column: columnIndex });
                        column.currentTop += height + this.layoutParams.paragraphSpacingPx;
                        column.cleanupFloatingImages(column.currentTop);
                        currentBlockIndex++;
                    } else {
                        return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                    }
                    break;
                }

                case window.Types.BlockType.TOC: {
                    const tocHeight = this.getTocHeight(block);
                    if (column.currentTop + tocHeight <= page.availableBottom) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            title: block.data.title || '目录'
                        });
                        piece.height = tocHeight;
                        piece.width = this.layoutParams.contentWidthPx;
                        for (let i = 0; i < page.columns.length; i++) {
                            const otherCol = page.columns[i];
                            if (otherCol.currentTop > column.currentTop) {
                                column.currentTop = otherCol.currentTop;
                            }
                        }
                        pieces.push({ piece, top: column.currentTop, spanning: true });
                        column.currentTop += tocHeight + this.layoutParams.paragraphSpacingPx;
                        for (let i = 0; i < page.columns.length; i++) {
                            page.columns[i].currentTop = column.currentTop;
                        }
                        currentBlockIndex++;
                    } else {
                        if (column.currentTop === page.availableTop && pieces.length === 0) {
                            const piece = new RenderedBlockPiece(block.id, blockType, {
                                title: block.data.title || '目录'
                            });
                            piece.height = tocHeight;
                            piece.width = this.layoutParams.contentWidthPx;
                            pieces.push({ piece, top: column.currentTop, spanning: true });
                            column.currentTop += tocHeight;
                            for (let i = 0; i < page.columns.length; i++) {
                                page.columns[i].currentTop = column.currentTop;
                            }
                            currentBlockIndex++;
                        } else {
                            return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                        }
                    }
                    break;
                }

                case window.Types.BlockType.CROSS_REF: {
                    const refHeight = this.getCrossRefHeight(block);
                    const useWidth = column.getAvailableWidth(column.currentTop);
                    if (column.currentTop + refHeight <= page.availableBottom) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            targetId: block.data.targetId,
                            targetType: block.data.targetType
                        });
                        piece.height = refHeight;
                        piece.width = useWidth;
                        const leftOffset = column.getLeftOffset(column.currentTop);
                        const absLeft = this.layoutParams.getColumnLeftPx(columnIndex) + leftOffset;
                        pieces.push({ piece, top: column.currentTop, left: absLeft, column: columnIndex });
                        column.currentTop += refHeight + this.layoutParams.paragraphSpacingPx;
                        column.cleanupFloatingImages(column.currentTop);
                        currentBlockIndex++;
                    } else {
                        return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                    }
                    break;
                }

                case window.Types.BlockType.MARGIN_NOTE: {
                    let anchorBlockId = block.data.anchoredBlockId;
                    if (!anchorBlockId && currentBlockIndex > 0) {
                        for (let i = currentBlockIndex - 1; i >= 0; i--) {
                            const prevBlock = this.blocks[i];
                            if (prevBlock.type !== window.Types.BlockType.MARGIN_NOTE &&
                                prevBlock.type !== window.Types.BlockType.FOOTNOTE_REF) {
                                anchorBlockId = prevBlock.id;
                                break;
                            }
                        }
                    }

                    if (!anchorBlockId) {
                        currentBlockIndex++;
                        break;
                    }

                    this.sidenoteCounter++;
                    const sidenoteNum = this.sidenoteCounter;
                    this.sidenoteMap[block.id] = sidenoteNum;

                    const anchorTop = column.currentTop;
                    const anchorLeft = this.layoutParams.getColumnLeftPx(columnIndex) + column.getLeftOffset(column.currentTop);

                    pageFootnotes.push({
                        type: 'sidenote',
                        number: sidenoteNum,
                        text: block.data.noteText || '',
                        blockId: block.id,
                        anchorBlockId: anchorBlockId,
                        anchorTop: anchorTop,
                        anchorLeft: anchorLeft
                    });

                    const refText = '';
                    const fullText = refText + 'ⁿ';
                    const mnStyle = new window.Types.InlineStyle(
                        window.Types.InlineStyleType.MARGIN_NOTE_REF,
                        refText.length,
                        fullText.length,
                        { noteNumber: sidenoteNum }
                    );
                    const useWidth = column.getAvailableWidth(column.currentTop);
                    const lines = window.LineBreaker.breakLinesMinRaggedness(
                        fullText,
                        useWidth,
                        this.layoutParams.fontSizePx,
                        this.layoutParams.fontFamily,
                        [mnStyle]
                    );

                    const height = lines.length * this.layoutParams.lineHeightPx;
                    if (column.currentTop + height <= page.availableBottom) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            lines: lines,
                            text: fullText,
                            inlineStyles: [mnStyle],
                            noteNumber: sidenoteNum,
                            noteText: block.data.noteText,
                            anchoredBlockId: anchorBlockId,
                            anchorTop: anchorTop,
                            anchorLeft: anchorLeft
                        });
                        piece.height = height;
                        piece.width = 0;
                        piece.isMarginNoteRef = true;
                        const leftOffset = column.getLeftOffset(column.currentTop);
                        const absLeft = this.layoutParams.getColumnLeftPx(columnIndex) + leftOffset;
                        pieces.push({ piece, top: column.currentTop, left: absLeft, column: columnIndex });
                        column.currentTop += height;
                        column.cleanupFloatingImages(column.currentTop);
                        currentBlockIndex++;
                    } else {
                        return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                    }
                    break;
                }

                default:
                    currentBlockIndex++;
            }
        }

        return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
    }

    _balanceLastPageColumns(page) {
        if (this.layoutParams.columnCount <= 1) return;

        const nonFloatingPieces = page.pieces.filter(p => !p.isSpanning && p.data && !p.data.isFloating);
        if (nonFloatingPieces.length === 0) return;

        const spanningPieces = page.pieces.filter(p => p.isSpanning);
        const floatingPieces = page.pieces.filter(p => p.data && p.data.isFloating);

        const columnTops = new Map();
        for (let i = 0; i < this.layoutParams.columnCount; i++) {
            columnTops.set(i, page.availableTop);
        }
        for (const s of spanningPieces) {
            for (let i = 0; i < this.layoutParams.columnCount; i++) {
                const cur = columnTops.get(i) || page.availableTop;
                columnTops.set(i, Math.max(cur, s.top + s.height));
            }
        }
        for (const f of floatingPieces) {
            const colIdx = f.columnIndex;
            const cur = columnTops.get(colIdx) || page.availableTop;
            columnTops.set(colIdx, Math.max(cur, f.top));
        }

        const bottoms = [];
        for (let i = 0; i < this.layoutParams.columnCount; i++) {
            bottoms.push(columnTops.get(i) || page.availableTop);
        }
        for (const piece of nonFloatingPieces) {
            const col = piece.columnIndex;
            const currentTop = columnTops.get(col) || page.availableTop;
            if (piece.top + piece.height > currentTop) {
                columnTops.set(col, piece.top + piece.height);
                bottoms[col] = piece.top + piece.height;
            }
        }

        const activeBottoms = bottoms.filter(b => b > page.availableTop + this.layoutParams.lineHeightPx);
        if (activeBottoms.length === 0) return;

        const maxBottom = Math.max(...bottoms);
        const minBottom = Math.min(...activeBottoms);
        const diffLines = Math.max(0, Math.round((maxBottom - minBottom) / this.layoutParams.lineHeightPx));
        const allColumnsHaveContent = bottoms.every(b => b > page.availableTop + this.layoutParams.lineHeightPx);
        if (allColumnsHaveContent && diffLines <= 2) return;

        nonFloatingPieces.sort((a, b) => {
            const byTop = a.top - b.top;
            if (Math.abs(byTop) > this.layoutParams.lineHeightPx) return byTop;
            return a.columnIndex - b.columnIndex;
        });

        const totalLines = nonFloatingPieces.reduce((sum, p) => {
            const l = p.data && p.data.lines ? p.data.lines.length : Math.max(1, Math.round(p.height / this.layoutParams.lineHeightPx));
            return sum + l;
        }, 0);
        const targetLinesPerColumn = Math.ceil(totalLines / this.layoutParams.columnCount);

        const orderedPieces = [...nonFloatingPieces];
        const columnLinesAllocated = new Array(this.layoutParams.columnCount).fill(0);
        const columnCurrentTop = bottoms.map((b, i) => Math.min(bottoms[i], ...bottoms.filter((_, j) => j !== i)));
        for (let i = 0; i < this.layoutParams.columnCount; i++) {
            columnCurrentTop[i] = page.availableTop;
            for (const s of spanningPieces) {
                if (s.top + s.height > columnCurrentTop[i]) {
                    columnCurrentTop[i] = s.top + s.height;
                }
            }
        }

        for (let i = 0; i < orderedPieces.length; i++) {
            const piece = orderedPieces[i];
            const pieceLines = piece.data && piece.data.lines ? piece.data.lines.length : Math.max(1, Math.round(piece.height / this.layoutParams.lineHeightPx));

            let targetCol = -1;
            for (let c = 0; c < this.layoutParams.columnCount; c++) {
                const willBe = columnLinesAllocated[c] + pieceLines;
                if (willBe <= targetLinesPerColumn || (c > 0 && columnLinesAllocated[c] < columnLinesAllocated[c - 1] - 2)) {
                    targetCol = c;
                    break;
                }
            }
            if (targetCol === -1) {
                let minLines = Infinity;
                for (let c = 0; c < this.layoutParams.columnCount; c++) {
                    if (columnLinesAllocated[c] < minLines) {
                        minLines = columnLinesAllocated[c];
                        targetCol = c;
                    }
                }
            }
            if (targetCol === -1) targetCol = 0;

            piece.columnIndex = targetCol;
            piece.left = this.layoutParams.getColumnLeftPx(targetCol);
            if (piece.data && piece.data.lines) {
                piece.width = this.layoutParams.columnWidthPx;
            }
            columnLinesAllocated[targetCol] += pieceLines;
        }

        for (let i = 0; i < this.layoutParams.columnCount; i++) {
            const colPieces = page.pieces.filter(p => p.columnIndex === i && !p.isSpanning);
            let runningTop = page.availableTop;

            for (const s of spanningPieces) {
                if (s.top + s.height > runningTop) {
                    runningTop = s.top + s.height;
                }
            }

            colPieces.sort((a, b) => {
                const isFloatA = a.data && a.data.isFloating;
                const isFloatB = b.data && b.data.isFloating;
                if (isFloatA && !isFloatB) return -1;
                if (!isFloatA && isFloatB) return 1;
                return a.top - b.top;
            });

            for (const piece of colPieces) {
                if (piece.data && piece.data.isFloating) {
                    const floatLeft = piece.data.floatType === window.Types.ImageFloatType.LEFT ? 0 : (this.layoutParams.columnWidthPx - piece.width);
                    piece.left = this.layoutParams.getColumnLeftPx(i) + floatLeft;
                    runningTop = Math.max(runningTop, piece.top);
                    continue;
                }
                if (Math.abs(piece.top - runningTop) < this.layoutParams.lineHeightPx * 5 || piece.data.continuation) {
                    piece.top = runningTop;
                    piece.left = this.layoutParams.getColumnLeftPx(i);
                }
                runningTop = piece.top + piece.height;
            }
        }
    }

    paginate() {
        this.pages = [];
        this.footnoteCounter = 0;
        this.footnoteMap = {};
        this.sidenoteCounter = 0;
        this.sidenoteMap = {};

        if (this.blocks.length === 0) {
            const page = new Page(0, this.layoutParams);
            this.pages.push(page);
            return this.pages;
        }

        let currentBlockIndex = 0;
        let partialOffset = 0;
        let pageIndex = 0;
        let pendingContinuationFootnotes = [];
        let pendingOverflowSidenotes = [];
        let partialBlockInfo = null;

        while (currentBlockIndex < this.blocks.length || partialOffset > 0) {
            const page = new Page(pageIndex, this.layoutParams);

            if (pendingContinuationFootnotes.length > 0) {
                const fnHeight = this.getFootnoteHeight(pendingContinuationFootnotes);
                if (fnHeight < this.layoutParams.contentHeightPx * 0.4) {
                    page.footnoteAreaHeight = fnHeight;
                    page.footnotes = [...pendingContinuationFootnotes];
                    pendingContinuationFootnotes = [];
                }
            }

            let allColumnFootnotes = [];
            let lastResult = null;

            for (let colIdx = 0; colIdx < this.layoutParams.columnCount; colIdx++) {
                if (colIdx > 0 && currentBlockIndex >= this.blocks.length && partialOffset === 0) {
                    break;
                }

                const column = page.columns[colIdx];
                if (colIdx === 0) {
                    column.currentTop = page.availableTop;
                }

                if (partialOffset > 0 && partialBlockInfo && colIdx === 0) {
                    const block = partialBlockInfo.block;
                    if (block) {
                        if (block.type === window.Types.BlockType.PARAGRAPH) {
                            const useWidth = column.getAvailableWidth(column.currentTop);
                            const lines = window.LineBreaker.breakLinesMinRaggedness(
                                block.data.text,
                                useWidth,
                                this.layoutParams.fontSizePx,
                                this.layoutParams.fontFamily,
                                block.data.inlineStyles || []
                            );
                            const remainingHeight = page.getColumnRemainingHeight(colIdx);
                            const availableLines = Math.floor(remainingHeight / this.layoutParams.lineHeightPx);

                            if (availableLines > 0) {
                                let endLine = Math.min(partialOffset + availableLines, lines.length);
                                endLine = this.applyWidowOrphanAdjustment(lines, endLine, partialOffset);

                                if (endLine <= partialOffset) {
                                    endLine = Math.min(partialOffset + 1, lines.length);
                                }

                                const contLines = lines.slice(partialOffset, endLine);
                                const piece = new RenderedBlockPiece(block.id, block.type, {
                                    lines: contLines,
                                    text: block.data.text,
                                    inlineStyles: block.data.inlineStyles || [],
                                    partial: endLine < lines.length,
                                    continuation: true,
                                    nextLine: endLine
                                });
                                piece.height = contLines.length * this.layoutParams.lineHeightPx;
                                piece.width = useWidth;
                                const leftOffset = column.getLeftOffset(column.currentTop);
                                const absLeft = this.layoutParams.getColumnLeftPx(colIdx) + leftOffset;
                                page.addPiece(piece, column.currentTop, colIdx, absLeft);

                                const footnoteRefs = (block.data.inlineStyles || []).filter(
                                    s => s.type === window.Types.InlineStyleType.FOOTNOTE_REF
                                );
                                for (const ref of footnoteRefs) {
                                    if (!this.footnoteMap[ref.footnoteId]) {
                                        this.footnoteCounter++;
                                        this.footnoteMap[ref.footnoteId] = this.footnoteCounter;
                                        page.footnotes.push({
                                            number: this.footnoteCounter,
                                            text: ref.footnoteText,
                                            blockId: block.id
                                        });
                                    }
                                    ref.footnoteNumber = this.footnoteMap[ref.footnoteId];
                                }

                                if (endLine < lines.length) {
                                    partialOffset = endLine;
                                    partialBlockInfo = { block };
                                } else {
                                    partialOffset = 0;
                                    partialBlockInfo = null;
                                    currentBlockIndex++;
                                }
                            } else {
                                partialOffset = 0;
                                partialBlockInfo = null;
                            }
                        } else if (block.type === window.Types.BlockType.TABLE) {
                            const remainingHeight = page.getColumnRemainingHeight(colIdx);
                            const useWidth = column.width;
                            const tableInfo = this.getTableHeight(block, partialOffset, remainingHeight, useWidth);

                            if (tableInfo.rowsRendered > 0) {
                                const piece = new RenderedBlockPiece(block.id, block.type, {
                                    headers: block.data.headers,
                                    rows: block.data.rows,
                                    columns: block.data.columns,
                                    caption: block.data.caption || '',
                                    startRow: partialOffset,
                                    rowCount: tableInfo.rowsRendered,
                                    partial: tableInfo.nextRow < block.data.rows.length,
                                    continuation: true,
                                    nextRow: tableInfo.nextRow,
                                    repeatedHeader: true,
                                    hideCaption: true,
                                    renderedWidth: useWidth
                                });
                                piece.height = tableInfo.height;
                                piece.width = useWidth;
                                const absLeft = this.layoutParams.getColumnLeftPx(colIdx);
                                page.addPiece(piece, column.currentTop, colIdx, absLeft);

                                if (tableInfo.nextRow < block.data.rows.length) {
                                    partialOffset = tableInfo.nextRow;
                                    partialBlockInfo = { block };
                                } else {
                                    partialOffset = 0;
                                    partialBlockInfo = null;
                                    currentBlockIndex++;
                                }
                            } else {
                                partialOffset = 0;
                                partialBlockInfo = null;
                            }
                        } else {
                            partialOffset = 0;
                            partialBlockInfo = null;
                        }
                    }
                }

                const result = this.findBlocksForColumn(currentBlockIndex, partialOffset, page, colIdx);

                for (const item of result.pieces) {
                    if (item.spanning) {
                        page.addSpanningPiece(item.piece, item.top);
                    } else if (item.floating) {
                    } else {
                        const col = item.column != null ? item.column : colIdx;
                        page.addPiece(item.piece, item.top, col, item.left != null ? item.left : this.layoutParams.getColumnLeftPx(col));
                    }
                }

                if (result.footnotes.length > 0) {
                    allColumnFootnotes = allColumnFootnotes.concat(result.footnotes);
                }

                lastResult = result;
                currentBlockIndex = result.nextBlockIndex;
                partialOffset = result.partialOffset;

                if (partialOffset > 0 && result.nextBlockIndex < this.blocks.length) {
                    partialBlockInfo = { block: this.blocks[result.nextBlockIndex] };
                }

                if (partialOffset > 0 && colIdx === this.layoutParams.columnCount - 1) {
                    break;
                }
            }

            if (allColumnFootnotes.length > 0) {
                const availableBottom = page.layoutParams.contentHeightPx -
                    (page.layoutParams.showPageNumber ? ptToPx(page.layoutParams.getFooterFontSize()) + 8 : 0);
                const maxColumnEnd = Math.max(...page.columns.map(c => c.currentTop));
                const contentEnd = maxColumnEnd;
                const remaining = availableBottom - contentEnd;

                const regularFootnotes = allColumnFootnotes.filter(f => f.type !== 'sidenote');
                const sidenotes = allColumnFootnotes.filter(f => f.type === 'sidenote');

                let fnsToAdd = regularFootnotes;
                let fnHeight = this.getFootnoteHeight(fnsToAdd);

                while (fnHeight > remaining * 0.4 && fnsToAdd.length > 1) {
                    pendingContinuationFootnotes.unshift(fnsToAdd.pop());
                    fnHeight = this.getFootnoteHeight(fnsToAdd);
                }

                page.footnotes = fnsToAdd;
                page.footnoteAreaHeight = fnHeight;

                if (sidenotes.length > 0 || pendingOverflowSidenotes.length > 0) {
                    let allSidenotes = [...pendingOverflowSidenotes, ...sidenotes];
                    pendingOverflowSidenotes = [];

                    const sidenoteResult = this.calculateSidenotePositions(page, allSidenotes);

                    if (sidenoteResult.positioned.length > 0) {
                        page.sidenotes = sidenoteResult.positioned;
                        const maxNoteBottom = Math.max(...sidenoteResult.positioned.map(s => s.top + s.height));
                        page.sidenoteAreaHeight = Math.max(0, maxNoteBottom - page.availableTop);
                    }

                    if (sidenoteResult.overflow.length > 0) {
                        pendingOverflowSidenotes = sidenoteResult.overflow;
                        page.hasSidenoteContinuation = true;
                    }
                }
            } else if (pendingOverflowSidenotes.length > 0) {
                const sidenoteResult = this.calculateSidenotePositions(page, pendingOverflowSidenotes);
                if (sidenoteResult.positioned.length > 0) {
                    page.sidenotes = sidenoteResult.positioned;
                    const maxNoteBottom = Math.max(...sidenoteResult.positioned.map(s => s.top + s.height));
                    page.sidenoteAreaHeight = Math.max(0, maxNoteBottom - page.availableTop);
                }
                pendingOverflowSidenotes = sidenoteResult.overflow;
                if (pendingOverflowSidenotes.length > 0) {
                    page.hasSidenoteContinuation = true;
                }
            }

            this.pages.push(page);
            pageIndex++;

            if (this.pages.length > 500) {
                break;
            }
        }

        if (pendingContinuationFootnotes.length > 0) {
            const lastPage = this.pages[this.pages.length - 1];
            if (lastPage) {
                const allFootnotes = [...lastPage.footnotes, ...pendingContinuationFootnotes];
                lastPage.footnotes = allFootnotes;
                lastPage.footnoteAreaHeight = this.getFootnoteHeight(allFootnotes);
            }
        }

        if (pendingOverflowSidenotes.length > 0) {
            const lastPage = this.pages[this.pages.length - 1];
            if (lastPage) {
                const contentHeight = this.layoutParams.contentHeightPx;
                let currentTop = lastPage.availableTop;
                if (lastPage.sidenotes.length > 0) {
                    currentTop = Math.max(...lastPage.sidenotes.map(s => s.top + s.height)) + 6;
                }

                const remaining = contentHeight - lastPage.footnoteAreaHeight - currentTop;
                if (remaining > 20) {
                    const newSidenotes = [];
                    for (const sn of pendingOverflowSidenotes) {
                        const noteHeight = this.getSidenoteHeight({ data: { noteText: sn.text } });
                        if (currentTop + noteHeight < contentHeight - lastPage.footnoteAreaHeight) {
                            newSidenotes.push({
                                ...sn,
                                top: currentTop,
                                height: noteHeight,
                                width: this.layoutParams.getSidenoteWidthPx()
                            });
                            currentTop += noteHeight + 6;
                        }
                    }
                    lastPage.sidenotes = [...lastPage.sidenotes, ...newSidenotes];
                    if (newSidenotes.length > 0) {
                        const maxNoteBottom = Math.max(...newSidenotes.map(s => s.top + s.height));
                        lastPage.sidenoteAreaHeight = Math.max(lastPage.sidenoteAreaHeight, maxNoteBottom - lastPage.availableTop);
                    }
                    lastPage.hasSidenoteContinuation = false;
                }
            }
        }

        if (this.pages.length > 0) {
            const lastPage = this.pages[this.pages.length - 1];
            this._balanceLastPageColumns(lastPage);
        }

        if (this.pages.length === 0) {
            this.pages.push(new Page(0, this.layoutParams));
        }

        return this.pages;
    }
}

if (typeof window !== 'undefined') {
    window.Paginator = {
        RenderedBlockPiece,
        Page,
        PaginationEngine
    };
}
