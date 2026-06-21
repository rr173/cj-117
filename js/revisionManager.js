class RevisionManager {
    constructor() {
        this.diffResult = null;
        this.snapshotBlocks = null;
        this.currentBlocks = null;
        this.processedChanges = new Set();
        this.onChange = null;
        this.onComplete = null;
    }

    setData(diffResult, snapshotBlocks, currentBlocks) {
        this.diffResult = diffResult;
        this.snapshotBlocks = snapshotBlocks;
        this.currentBlocks = currentBlocks;
        this.processedChanges.clear();
    }

    getPendingChanges() {
        if (!this.diffResult) return [];
        return this.diffResult.changes.filter(c =>
            c.type !== window.DiffChangeType.UNCHANGED &&
            !this.processedChanges.has(c.blockId)
        );
    }

    isChangeProcessed(blockId) {
        return this.processedChanges.has(blockId);
    }

    acceptChange(blockId) {
        const change = this._findChange(blockId);
        if (!change) return false;
        if (this.processedChanges.has(blockId)) return false;

        this.processedChanges.add(blockId);
        this._notifyChange();
        this._checkComplete();

        return true;
    }

    rejectChange(blockId) {
        const change = this._findChange(blockId);
        if (!change) return false;
        if (this.processedChanges.has(blockId)) return false;

        this.processedChanges.add(blockId);
        this._applyRejection(change);
        this._notifyChange();
        this._checkComplete();

        return true;
    }

    acceptAll() {
        const pending = this.getPendingChanges();
        pending.forEach(change => {
            this.processedChanges.add(change.blockId);
        });
        this._notifyChange();
        this._checkComplete();
    }

    rejectAll() {
        const pending = this.getPendingChanges();
        pending.forEach(change => {
            this.processedChanges.add(change.blockId);
            this._applyRejection(change);
        });
        this._notifyChange();
        this._checkComplete();
    }

    _applyRejection(change) {
        if (!this.currentBlocks) return;

        const blockId = change.blockId;
        const currentIndex = this.currentBlocks.findIndex(b => b.id === blockId);

        switch (change.type) {
            case window.DiffChangeType.INSERT:
                if (currentIndex >= 0) {
                    this.currentBlocks.splice(currentIndex, 1);
                }
                break;

            case window.DiffChangeType.DELETE: {
                const snapshotBlock = change.oldBlock;
                if (snapshotBlock) {
                    const newBlock = new window.Types.ContentBlock(
                        snapshotBlock.type,
                        JSON.parse(JSON.stringify(snapshotBlock.data))
                    );
                    newBlock.id = snapshotBlock.id;

                    let insertIndex = 0;
                    const snapshotIndex = this.snapshotBlocks.findIndex(b => b.id === blockId);

                    if (snapshotIndex > 0) {
                        let found = false;
                        for (let i = snapshotIndex - 1; i >= 0; i--) {
                            const prevId = this.snapshotBlocks[i].id;
                            const currentIdx = this.currentBlocks.findIndex(b => b.id === prevId);
                            if (currentIdx >= 0) {
                                insertIndex = currentIdx + 1;
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            for (let i = snapshotIndex + 1; i < this.snapshotBlocks.length; i++) {
                                const nextId = this.snapshotBlocks[i].id;
                                const currentIdx = this.currentBlocks.findIndex(b => b.id === nextId);
                                if (currentIdx >= 0) {
                                    insertIndex = currentIdx;
                                    found = true;
                                    break;
                                }
                            }
                        }
                    }

                    this.currentBlocks.splice(insertIndex, 0, newBlock);
                }
                break;
            }

            case window.DiffChangeType.MODIFY: {
                if (currentIndex >= 0 && change.oldBlock) {
                    this.currentBlocks[currentIndex].data =
                        JSON.parse(JSON.stringify(change.oldBlock.data));
                }
                break;
            }
        }
    }

    _findChange(blockId) {
        if (!this.diffResult) return null;
        return this.diffResult.changes.find(c => c.blockId === blockId);
    }

    _notifyChange() {
        if (this.onChange) {
            this.onChange(this.getPendingChanges());
        }
    }

    _checkComplete() {
        const pending = this.getPendingChanges();
        if (pending.length === 0 && this.onComplete) {
            setTimeout(() => {
                if (this.onComplete) {
                    this.onComplete();
                }
            }, 300);
        }
    }

    getStats() {
        if (!this.diffResult) {
            return { total: 0, processed: 0, pending: 0 };
        }

        const totalChanges = this.diffResult.changes.filter(
            c => c.type !== window.DiffChangeType.UNCHANGED
        ).length;

        const processed = this.processedChanges.size;

        return {
            total: totalChanges,
            processed: processed,
            pending: totalChanges - processed
        };
    }

    getResultBlocks() {
        return this.currentBlocks;
    }

    reset() {
        this.diffResult = null;
        this.snapshotBlocks = null;
        this.currentBlocks = null;
        this.processedChanges.clear();
    }
}

if (typeof window !== 'undefined') {
    window.RevisionManager = RevisionManager;
}
