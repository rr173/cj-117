class SnapshotManager {
    constructor(maxSnapshots = 5) {
        this.snapshots = [];
        this.maxSnapshots = maxSnapshots;
    }

    createSnapshot(name, blocks, docTitle) {
        const snapshot = {
            id: 'snap_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
            name: name || '未命名快照',
            createdAt: Date.now(),
            docTitle: docTitle || '',
            blocks: this._deepCloneBlocks(blocks)
        };

        this.snapshots.push(snapshot);

        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }

        return snapshot;
    }

    deleteSnapshot(snapshotId) {
        const index = this.snapshots.findIndex(s => s.id === snapshotId);
        if (index >= 0) {
            this.snapshots.splice(index, 1);
            return true;
        }
        return false;
    }

    getSnapshots() {
        return [...this.snapshots];
    }

    getSnapshot(snapshotId) {
        const snapshot = this.snapshots.find(s => s.id === snapshotId);
        if (!snapshot) return null;
        return {
            ...snapshot,
            blocks: this._deepCloneBlocks(snapshot.blocks)
        };
    }

    getSnapshotCount() {
        return this.snapshots.length;
    }

    _deepCloneBlocks(blocks) {
        return blocks.map(block => {
            const newBlock = new window.Types.ContentBlock(block.type, JSON.parse(JSON.stringify(block.data)));
            newBlock.id = block.id;
            return newBlock;
        });
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
}

if (typeof window !== 'undefined') {
    window.SnapshotManager = SnapshotManager;
}
