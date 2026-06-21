const DiffChangeType = {
    INSERT: 'insert',
    DELETE: 'delete',
    MODIFY: 'modify',
    UNCHANGED: 'unchanged'
};

const InlineDiffType = {
    INSERT: 'insert',
    DELETE: 'delete',
    UNCHANGED: 'unchanged'
};

class DiffEngine {
    constructor() {
    }

    compareDocuments(oldBlocks, newBlocks) {
        const oldMap = new Map();
        oldBlocks.forEach((block, idx) => {
            oldMap.set(block.id, { block, index: idx });
        });

        const newMap = new Map();
        newBlocks.forEach((block, idx) => {
            newMap.set(block.id, { block, index: idx });
        });

        const diffResult = [];
        const processedIds = new Set();

        let oldIdx = 0;
        let newIdx = 0;

        while (oldIdx < oldBlocks.length || newIdx < newBlocks.length) {
            if (oldIdx < oldBlocks.length && newIdx < newBlocks.length) {
                const oldBlock = oldBlocks[oldIdx];
                const newBlock = newBlocks[newIdx];

                if (oldBlock.id === newBlock.id) {
                    if (this._isBlockEqual(oldBlock, newBlock)) {
                        diffResult.push({
                            type: DiffChangeType.UNCHANGED,
                            blockId: oldBlock.id,
                            oldBlock: oldBlock,
                            newBlock: newBlock
                        });
                    } else {
                        const inlineDiff = this._computeInlineDiff(oldBlock, newBlock);
                        diffResult.push({
                            type: DiffChangeType.MODIFY,
                            blockId: oldBlock.id,
                            oldBlock: oldBlock,
                            newBlock: newBlock,
                            inlineDiff: inlineDiff
                        });
                    }
                    processedIds.add(oldBlock.id);
                    oldIdx++;
                    newIdx++;
                } else if (newMap.has(oldBlock.id) && oldMap.has(newBlock.id)) {
                    const oldInNew = newMap.get(oldBlock.id).index;
                    const newInOld = oldMap.get(newBlock.id).index;

                    if (oldInNew > newIdx && newInOld > oldIdx) {
                        diffResult.push({
                            type: DiffChangeType.INSERT,
                            blockId: newBlock.id,
                            oldBlock: null,
                            newBlock: newBlock
                        });
                        processedIds.add(newBlock.id);
                        newIdx++;
                    } else {
                        diffResult.push({
                            type: DiffChangeType.DELETE,
                            blockId: oldBlock.id,
                            oldBlock: oldBlock,
                            newBlock: null
                        });
                        processedIds.add(oldBlock.id);
                        oldIdx++;
                    }
                } else if (newMap.has(oldBlock.id)) {
                    diffResult.push({
                        type: DiffChangeType.INSERT,
                        blockId: newBlock.id,
                        oldBlock: null,
                        newBlock: newBlock
                    });
                    processedIds.add(newBlock.id);
                    newIdx++;
                } else {
                    diffResult.push({
                        type: DiffChangeType.DELETE,
                        blockId: oldBlock.id,
                        oldBlock: oldBlock,
                        newBlock: null
                    });
                    processedIds.add(oldBlock.id);
                    oldIdx++;
                }
            } else if (oldIdx < oldBlocks.length) {
                const oldBlock = oldBlocks[oldIdx];
                if (!processedIds.has(oldBlock.id)) {
                    diffResult.push({
                        type: DiffChangeType.DELETE,
                        blockId: oldBlock.id,
                        oldBlock: oldBlock,
                        newBlock: null
                    });
                    processedIds.add(oldBlock.id);
                }
                oldIdx++;
            } else {
                const newBlock = newBlocks[newIdx];
                if (!processedIds.has(newBlock.id)) {
                    diffResult.push({
                        type: DiffChangeType.INSERT,
                        blockId: newBlock.id,
                        oldBlock: null,
                        newBlock: newBlock
                    });
                    processedIds.add(newBlock.id);
                }
                newIdx++;
            }
        }

        return {
            changes: diffResult,
            stats: this._computeStats(diffResult)
        };
    }

    _isBlockEqual(blockA, blockB) {
        if (blockA.type !== blockB.type) return false;
        return JSON.stringify(blockA.data) === JSON.stringify(blockB.data);
    }

    _computeInlineDiff(oldBlock, newBlock) {
        const oldText = this._getBlockMainText(oldBlock);
        const newText = this._getBlockMainText(newBlock);

        const diffOps = this._charDiff(oldText, newText);

        return {
            oldText,
            newText,
            operations: diffOps
        };
    }

    _getBlockMainText(block) {
        switch (block.type) {
            case window.Types.BlockType.H1:
            case window.Types.BlockType.H2:
            case window.Types.BlockType.H3:
                return block.data.text || '';
            case window.Types.BlockType.PARAGRAPH:
                return block.data.text || '';
            case window.Types.BlockType.FOOTNOTE_REF:
                return block.data.refText || '';
            case window.Types.BlockType.TOC:
                return block.data.title || '';
            case window.Types.BlockType.IMAGE:
                return block.data.caption || '';
            case window.Types.BlockType.TABLE:
                return block.data.caption || '';
            default:
                return '';
        }
    }

    _charDiff(oldStr, newStr) {
        const oldChars = [...oldStr];
        const newChars = [...newStr];
        const m = oldChars.length;
        const n = newChars.length;

        const dp = [];
        for (let i = 0; i <= m; i++) {
            dp[i] = [];
            for (let j = 0; j <= n; j++) {
                if (i === 0 || j === 0) {
                    dp[i][j] = 0;
                } else if (oldChars[i - 1] === newChars[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        const operations = [];
        let i = m, j = n;

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
                operations.unshift({
                    type: InlineDiffType.UNCHANGED,
                    text: oldChars[i - 1]
                });
                i--;
                j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                operations.unshift({
                    type: InlineDiffType.INSERT,
                    text: newChars[j - 1]
                });
                j--;
            } else {
                operations.unshift({
                    type: InlineDiffType.DELETE,
                    text: oldChars[i - 1]
                });
                i--;
            }
        }

        return this._mergeConsecutive(operations);
    }

    _mergeConsecutive(operations) {
        if (operations.length === 0) return [];

        const merged = [];
        let current = { ...operations[0] };

        for (let i = 1; i < operations.length; i++) {
            const op = operations[i];
            if (op.type === current.type) {
                current.text += op.text;
            } else {
                merged.push(current);
                current = { ...op };
            }
        }
        merged.push(current);

        return merged;
    }

    _computeStats(changes) {
        let inserted = 0;
        let deleted = 0;
        let modified = 0;
        let unchanged = 0;

        changes.forEach(change => {
            switch (change.type) {
                case DiffChangeType.INSERT:
                    inserted++;
                    break;
                case DiffChangeType.DELETE:
                    deleted++;
                    break;
                case DiffChangeType.MODIFY:
                    modified++;
                    break;
                case DiffChangeType.UNCHANGED:
                    unchanged++;
                    break;
            }
        });

        return {
            total: changes.length,
            inserted,
            deleted,
            modified,
            unchanged,
            hasChanges: inserted + deleted + modified > 0
        };
    }

    buildDiffBlocksForRender(diffResult) {
        const renderBlocks = [];

        diffResult.changes.forEach(change => {
            if (change.type === DiffChangeType.UNCHANGED) {
                renderBlocks.push({
                    block: change.newBlock,
                    diffType: DiffChangeType.UNCHANGED,
                    change: change
                });
            } else if (change.type === DiffChangeType.INSERT) {
                renderBlocks.push({
                    block: change.newBlock,
                    diffType: DiffChangeType.INSERT,
                    change: change
                });
            } else if (change.type === DiffChangeType.DELETE) {
                renderBlocks.push({
                    block: change.oldBlock,
                    diffType: DiffChangeType.DELETE,
                    change: change
                });
            } else if (change.type === DiffChangeType.MODIFY) {
                renderBlocks.push({
                    block: change.newBlock,
                    diffType: DiffChangeType.MODIFY,
                    change: change,
                    inlineDiff: change.inlineDiff
                });
            }
        });

        return renderBlocks;
    }
}

if (typeof window !== 'undefined') {
    window.DiffEngine = DiffEngine;
    window.DiffChangeType = DiffChangeType;
    window.InlineDiffType = InlineDiffType;
}
