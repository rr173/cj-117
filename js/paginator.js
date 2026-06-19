class RenderedBlockPiece {
    constructor(blockId, type, data = {}) {
        this.blockId = blockId;
        this.type = type;
        this.data = data;
        this.pageIndex = -1;
        this.top = 0;
        this.height = 0;
        this.width = 0;
    }
}

class Page {
    constructor(index, layoutParams) {
        this.index = index;
        this.layoutParams = layoutParams;
        this.pieces = [];
        this.footnotes = [];
        this.footnoteAreaHeight = 0;
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

    getRemainingHeight(currentTop) {
        return Math.max(0, this.availableBottom - currentTop);
    }

    addPiece(piece, top) {
        piece.pageIndex = this.index;
        piece.top = top;
        this.pieces.push(piece);
    }
}

class PaginationEngine {
    constructor() {
        this.layoutParams = new window.Types.LayoutParams();
        this.blocks = [];
        this.pages = [];
        this.footnoteCounter = 0;
        this.footnoteMap = {};
    }

    setParams(params) {
        this.layoutParams = params;
    }

    setBlocks(blocks) {
        this.blocks = blocks;
    }

    getHeadingHeight(level) {
        const fontSizePt = this.layoutParams.getHeadingFontSize(level);
        const fontSizePx = ptToPx(fontSizePt);
        const lineHeightPx = fontSizePx * Math.max(1.2, this.layoutParams.lineHeight - 0.2);
        return lineHeightPx;
    }

    getHeadingLines(text, level) {
        const fontSizePt = this.layoutParams.getHeadingFontSize(level);
        const fontSizePx = ptToPx(fontSizePt);
        return window.LineBreaker.breakLinesMinRaggedness(
            text,
            this.layoutParams.contentWidthPx,
            fontSizePx,
            this.layoutParams.fontFamily,
            []
        );
    }

    getParagraphHeight(text, inlineStyles) {
        const lines = window.LineBreaker.breakLinesMinRaggedness(
            text,
            this.layoutParams.contentWidthPx,
            this.layoutParams.fontSizePx,
            this.layoutParams.fontFamily,
            inlineStyles
        );
        return lines.length * this.layoutParams.lineHeightPx;
    }

    getParagraphLines(text, inlineStyles) {
        return window.LineBreaker.breakLinesMinRaggedness(
            text,
            this.layoutParams.contentWidthPx,
            this.layoutParams.fontSizePx,
            this.layoutParams.fontFamily,
            inlineStyles
        );
    }

    getImageHeight(block) {
        const [w, h] = block.data.aspectRatio.split(':').map(Number);
        const ratio = h / w;
        const contentWidth = this.layoutParams.contentWidthPx;
        const imgHeight = contentWidth * ratio;
        const captionLines = window.LineBreaker.breakLinesMinRaggedness(
            block.data.caption || '',
            contentWidth,
            this.layoutParams.fontSizePx * 0.85,
            this.layoutParams.fontFamily
        );
        const captionHeight = captionLines.length * this.layoutParams.lineHeightPx * 0.85;
        return imgHeight + captionHeight + 4;
    }

    getTableHeight(block, startRow = 0, maxHeight = Infinity) {
        const fontSizePx = this.layoutParams.fontSizePx * 0.9;
        const lineHeightPx = fontSizePx * 1.3;
        const cellPaddingV = 8;
        const borderHeight = 1;

        const headers = block.data.headers;
        const rows = block.data.rows;
        const colWidth = this.layoutParams.contentWidthPx / block.data.columns;

        let totalHeight = 0;
        let usedRows = 0;

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

    findBlocksForPage(startBlockIndex, startOffset, page) {
        const pieces = [];
        let currentTop = startOffset;
        let currentBlockIndex = startBlockIndex;
        const pageFootnotes = [];

        while (currentBlockIndex < this.blocks.length) {
            const block = this.blocks[currentBlockIndex];
            const blockType = block.type;
            const remainingHeight = page.getRemainingHeight(currentTop);

            if (remainingHeight < this.layoutParams.lineHeightPx) {
                break;
            }

            switch (blockType) {
                case window.Types.BlockType.H1:
                case window.Types.BlockType.H2:
                case window.Types.BlockType.H3: {
                    const level = parseInt(blockType.substring(1));
                    const headingLines = this.getHeadingLines(block.data.text || '标题', level);
                    const headingHeight = headingLines.length * this.getHeadingHeight(level);

                    if (currentTop + headingHeight <= page.availableBottom) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            lines: headingLines,
                            level,
                            text: block.data.text
                        });
                        piece.height = headingHeight;
                        piece.width = this.layoutParams.contentWidthPx;
                        pieces.push({ piece, top: currentTop });
                        currentTop += headingHeight;
                        currentBlockIndex++;
                    } else {
                        if (currentTop === startOffset) {
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
                                piece.width = this.layoutParams.contentWidthPx;
                                pieces.push({ piece, top: currentTop });
                                currentTop += piece.height;
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

                    const lines = this.getParagraphLines(block.data.text, block.data.inlineStyles || []);
                    const totalHeight = lines.length * this.layoutParams.lineHeightPx;

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
                    }

                    if (currentTop + totalHeight <= page.availableBottom) {
                        if (isAfterHeading && lines.length < 2) {
                            return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                        }
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            lines: lines,
                            text: block.data.text,
                            inlineStyles: block.data.inlineStyles || []
                        });
                        piece.height = totalHeight;
                        piece.width = this.layoutParams.contentWidthPx;
                        pieces.push({ piece, top: currentTop });
                        currentTop += totalHeight + this.layoutParams.paragraphSpacingPx;
                        currentBlockIndex++;
                    } else {
                        const availableLines = Math.floor(remainingHeight / this.layoutParams.lineHeightPx);

                        if (availableLines <= 0) {
                            return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                        }

                        if (isAfterHeading) {
                            if (availableLines < 2) {
                                return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                            }
                        }

                        let splitAt = Math.min(availableLines, lines.length);
                        splitAt = this.applyWidowOrphanAdjustment(lines, splitAt, 0);

                        if (splitAt <= 0) {
                            return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                        }

                        const thisPageLines = lines.slice(0, splitAt);
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            lines: thisPageLines,
                            text: block.data.text,
                            inlineStyles: block.data.inlineStyles || [],
                            partial: true,
                            nextLine: splitAt
                        });
                        piece.height = thisPageLines.length * this.layoutParams.lineHeightPx;
                        piece.width = this.layoutParams.contentWidthPx;
                        pieces.push({ piece, top: currentTop });
                        currentTop += piece.height;
                        return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: splitAt, footnotes: pageFootnotes };
                    }
                    break;
                }

                case window.Types.BlockType.IMAGE: {
                    const imgHeight = this.getImageHeight(block);

                    if (currentTop + imgHeight <= page.availableBottom) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            aspectRatio: block.data.aspectRatio,
                            caption: block.data.caption,
                            altText: block.data.altText
                        });
                        piece.height = imgHeight;
                        piece.width = this.layoutParams.contentWidthPx;
                        pieces.push({ piece, top: currentTop });
                        currentTop += imgHeight + this.layoutParams.paragraphSpacingPx;
                        currentBlockIndex++;
                    } else {
                        if (currentTop === startOffset && pieces.length === 0) {
                            const piece = new RenderedBlockPiece(block.id, blockType, {
                                aspectRatio: block.data.aspectRatio,
                                caption: block.data.caption,
                                altText: block.data.altText
                            });
                            piece.height = imgHeight;
                            piece.width = this.layoutParams.contentWidthPx;
                            pieces.push({ piece, top: currentTop });
                            currentTop += imgHeight;
                            currentBlockIndex++;
                        } else {
                            return { pieces, nextBlockIndex: currentBlockIndex, partialOffset: 0, footnotes: pageFootnotes };
                        }
                    }
                    break;
                }

                case window.Types.BlockType.TABLE: {
                    const tableInfo = this.getTableHeight(block, 0, remainingHeight);
                    const halfPage = this.layoutParams.contentHeightPx / 2;

                    if (tableInfo.height <= remainingHeight) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            headers: block.data.headers,
                            rows: block.data.rows,
                            columns: block.data.columns,
                            startRow: 0,
                            rowCount: block.data.rows.length,
                            repeatedHeader: false
                        });
                        piece.height = tableInfo.height;
                        piece.width = this.layoutParams.contentWidthPx;
                        pieces.push({ piece, top: currentTop });
                        currentTop += tableInfo.height + this.layoutParams.paragraphSpacingPx;
                        currentBlockIndex++;
                    } else if (tableInfo.height > halfPage) {
                        const partialInfo = this.getTableHeight(block, 0, remainingHeight);
                        if (partialInfo.rowsRendered > 1) {
                            const piece = new RenderedBlockPiece(block.id, blockType, {
                                headers: block.data.headers,
                                rows: block.data.rows,
                                columns: block.data.columns,
                                startRow: 0,
                                rowCount: partialInfo.rowsRendered,
                                partial: true,
                                nextRow: partialInfo.nextRow,
                                repeatedHeader: false
                            });
                            piece.height = partialInfo.height;
                            piece.width = this.layoutParams.contentWidthPx;
                            pieces.push({ piece, top: currentTop });
                            currentTop += partialInfo.height;
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
                    const fullText = refText + '[ref]';
                    const lines = this.getParagraphLines(fullText, [new window.Types.InlineStyle(
                        window.Types.InlineStyleType.FOOTNOTE_REF,
                        refText.length,
                        fullText.length,
                        { footnoteNumber: footnoteNum }
                    )]);

                    const height = lines.length * this.layoutParams.lineHeightPx;
                    if (currentTop + height <= page.availableBottom) {
                        const piece = new RenderedBlockPiece(block.id, blockType, {
                            lines: lines,
                            text: fullText,
                            inlineStyles: [new window.Types.InlineStyle(
                                window.Types.InlineStyleType.FOOTNOTE_REF,
                                refText.length,
                                fullText.length,
                                { footnoteNumber: footnoteNum }
                            )],
                            footnoteNumber: footnoteNum
                        });
                        piece.height = height;
                        piece.width = this.layoutParams.contentWidthPx;
                        pieces.push({ piece, top: currentTop });
                        currentTop += height + this.layoutParams.paragraphSpacingPx;
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

    paginate() {
        this.pages = [];
        this.footnoteCounter = 0;
        this.footnoteMap = {};

        if (this.blocks.length === 0) {
            const page = new Page(0, this.layoutParams);
            this.pages.push(page);
            return this.pages;
        }

        let currentBlockIndex = 0;
        let partialOffset = 0;
        let pageIndex = 0;
        let pendingContinuationFootnotes = [];

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

            const startTop = page.availableTop;

            const block = this.blocks[currentBlockIndex];
            if (partialOffset > 0 && block) {
                if (block.type === window.Types.BlockType.PARAGRAPH) {
                    const lines = this.getParagraphLines(block.data.text, block.data.inlineStyles || []);
                    const remainingHeight = page.getRemainingHeight(startTop);
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
                        piece.width = this.layoutParams.contentWidthPx;
                        page.addPiece(piece, startTop);

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
                        }

                        const newOffset = endLine;
                        if (endLine < lines.length) {
                            partialOffset = newOffset;
                        } else {
                            partialOffset = 0;
                            currentBlockIndex++;
                        }

                        if (page.footnotes.length > 0) {
                            const fnHeight = this.getFootnoteHeight(page.footnotes);
                            const remainingForContent = page.availableBottom - piece.height - startTop;
                            if (fnHeight > remainingForContent * 0.5) {
                                pendingContinuationFootnotes = page.footnotes.slice(1);
                                page.footnotes = page.footnotes.slice(0, 1);
                            }
                            page.footnoteAreaHeight = this.getFootnoteHeight(page.footnotes);
                        }

                        this.pages.push(page);
                        pageIndex++;
                        continue;
                    } else {
                        partialOffset = 0;
                    }
                } else if (block.type === window.Types.BlockType.TABLE) {
                    const remainingHeight = page.getRemainingHeight(startTop);
                    const tableInfo = this.getTableHeight(block, partialOffset, remainingHeight);

                    if (tableInfo.rowsRendered > 0) {
                        const piece = new RenderedBlockPiece(block.id, block.type, {
                            headers: block.data.headers,
                            rows: block.data.rows,
                            columns: block.data.columns,
                            startRow: partialOffset,
                            rowCount: tableInfo.rowsRendered,
                            partial: tableInfo.nextRow < block.data.rows.length,
                            continuation: true,
                            nextRow: tableInfo.nextRow,
                            repeatedHeader: true
                        });
                        piece.height = tableInfo.height;
                        piece.width = this.layoutParams.contentWidthPx;
                        page.addPiece(piece, startTop);

                        if (tableInfo.nextRow < block.data.rows.length) {
                            partialOffset = tableInfo.nextRow;
                        } else {
                            partialOffset = 0;
                            currentBlockIndex++;
                        }

                        this.pages.push(page);
                        pageIndex++;
                        continue;
                    } else {
                        partialOffset = 0;
                    }
                } else {
                    partialOffset = 0;
                }
            }

            const result = this.findBlocksForPage(currentBlockIndex, startTop, page);

            for (const { piece, top } of result.pieces) {
                page.addPiece(piece, top);
            }

            if (result.footnotes.length > 0) {
                const availableBottom = page.layoutParams.contentHeightPx -
                    (page.layoutParams.showPageNumber ? ptToPx(page.layoutParams.getFooterFontSize()) + 8 : 0);
                const contentEnd = page.pieces.length > 0 ?
                    (page.pieces[page.pieces.length - 1].top + page.pieces[page.pieces.length - 1].height) :
                    startTop;
                const remaining = availableBottom - contentEnd;

                let fnsToAdd = result.footnotes;
                let fnHeight = this.getFootnoteHeight(fnsToAdd);

                while (fnHeight > remaining * 0.4 && fnsToAdd.length > 1) {
                    pendingContinuationFootnotes.unshift(fnsToAdd.pop());
                    fnHeight = this.getFootnoteHeight(fnsToAdd);
                }

                page.footnotes = fnsToAdd;
                page.footnoteAreaHeight = fnHeight;
            }

            currentBlockIndex = result.nextBlockIndex;
            partialOffset = result.partialOffset;

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
