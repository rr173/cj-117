class Application {
    constructor() {
        this.editor = null;
        this.paginator = null;
        this.preview = null;
        this.exporter = null;
        this.documentProcessor = null;
        this.snapshotManager = null;
        this.diffEngine = null;
        this.diffPreview = null;
        this.revisionManager = null;
        this.layoutParams = new window.Types.LayoutParams();
        this.debounceTimer = null;
        this.isDiffMode = false;
        this.currentCompareSnapshotId = null;
        this.previewingSnapshotId = null;
        this._init();
    }

    _init() {
        this.editor = new window.ContentEditor('blocks-list');
        this.paginator = new window.Paginator.PaginationEngine();
        this.preview = new window.PreviewRenderer('preview-container');
        this.exporter = new window.HtmlExporter();
        this.documentProcessor = new window.DocumentProcessor();
        this.snapshotManager = new window.SnapshotManager(5);
        this.diffEngine = new window.DiffEngine();
        this.diffPreview = new window.DiffPreviewRenderer('diff-preview-container');
        this.revisionManager = new window.RevisionManager();

        this._loadSampleContent();
        this._bindEditorEvents();
        this._bindParamEvents();
        this._bindExportEvents();
        this._bindZoomEvents();
        this._bindDocTitleEvents();
        this._bindSnapshotEvents();
        this._bindDiffEvents();
        this._bindRevisionEvents();

        this._updateLayout();
        this._renderSnapshotList();
    }

    _loadSampleContent() {
        const tempEditor = new window.ContentEditor('blocks-list');
        const p = (rawText) => {
            const parsed = tempEditor._parseMarkdownSyntax(rawText);
            return new window.Types.ContentBlock(window.Types.BlockType.PARAGRAPH, {
                text: parsed.text,
                inlineStyles: parsed.styles
            });
        };

        const h1 = new window.Types.ContentBlock(window.Types.BlockType.H1, {
            text: '交互式排版引擎使用说明'
        });

        const tocBlock = new window.Types.ContentBlock(window.Types.BlockType.TOC, {
            title: '目录'
        });

        const introH2 = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '一、内容编辑'
        });

        const editH3 = new window.Types.ContentBlock(window.Types.BlockType.H3, {
            text: '1.1 内容块类型'
        });

        const refCrossHeading = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '二、自动编号与引用'
        });

        const headingNumH3 = new window.Types.ContentBlock(window.Types.BlockType.H3, {
            text: '2.1 标题自动编号'
        });

        const figureNumH3 = new window.Types.ContentBlock(window.Types.BlockType.H3, {
            text: '2.2 图表编号'
        });

        const crossRefH3 = new window.Types.ContentBlock(window.Types.BlockType.H3, {
            text: '2.3 交叉引用'
        });

        const layoutH2 = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '三、排版参数'
        });

        const imageBlock = new window.Types.ContentBlock(window.Types.BlockType.IMAGE, {
            aspectRatio: '16:9',
            caption: '系统架构示意图',
            altText: '系统架构图占位'
        });

        const breakH2 = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '四、断行与分页'
        });

        const breakH3 = new window.Types.ContentBlock(window.Types.BlockType.H3, {
            text: '4.1 分页示例'
        });

        const tableH2 = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '五、表格示例'
        });

        const tableBlock = new window.Types.ContentBlock(window.Types.BlockType.TABLE, {
            columns: 4,
            headers: ['功能模块', '主要特性', '实现方式', '状态'],
            rows: [
                ['断行引擎', '最小不齐度算法', '动态规划DP', '已完成'],
                ['分页引擎', '孤行寡行控制', '预计算+回溯', '已完成'],
                ['图片排版', '浮动+整体移动', '尺寸估算', '已完成'],
                ['表格排版', '跨页拆分+表头重复', '行高计算', '已完成'],
                ['脚注排版', '页底分配+续排', '区域预留', '已完成'],
                ['目录生成', '自动扫描+页码计算', '两阶段分页', '已完成'],
                ['交叉引用', '动态编号+失效检测', '引用追踪', '已完成'],
                ['预览渲染', 'DOM绝对定位', '逐页构建', '已完成'],
                ['HTML导出', '打印样式', '@page规则', '已完成']
            ]
        });

        const previewH2 = new window.Types.ContentBlock(window.Types.BlockType.H2, {
            text: '六、预览与导出'
        });

        const blocks = [
            h1,
            tocBlock,
            introH2,
            p('在左侧面板，您可以添加各种类型的内容块：标题（H1-H3）、正文段落（支持**加粗**和*斜体*）、图片占位、表格、脚注引用、目录和交叉引用。每个内容块可以通过拖拽调整顺序，或使用操作按钮进行编辑、复制和删除。'),
            editH3,
            p('标题有三个层级：H1、H2和H3，系统会按照层级自动为它们编号（如1、1.1、1.1.1）。您也可以在右侧参数面板关闭自动编号功能。'),
            refCrossHeading,
            headingNumH3,
            p('标题自动编号功能会按照标题在文档中出现的顺序和层级自动生成编号。H1一级标题用"1、2、3"，H2二级标题用"1.1、1.2"，H3三级标题用"1.1.1、1.1.2"。编号会自动显示在标题文字前面，目录中也会同步显示。'),
            figureNumH3,
            p('图片和表格各自维护独立的编号序列。例如：'),
            imageBlock,
            p('上面这张图片会自动编号为图1。如果在它之前插入新的图片，所有后续图片的编号会自动更新。表格同理，按照出现顺序编号为表1、表2……表格的编号显示在表格上方居中，图片的编号显示在图片下方居中。'),
            crossRefH3,
            p('交叉引用功能允许您在正文中引用其他位置的标题、图片或表格。引用标记会自动显示目标的编号和所在页码。例如：'),
            p('您可以查看'),
            new window.Types.ContentBlock(window.Types.BlockType.CROSS_REF, {
                targetId: imageBlock.id,
                targetType: window.Types.CrossRefTargetType.IMAGE
            }),
            p('了解系统架构，或参考'),
            new window.Types.ContentBlock(window.Types.BlockType.CROSS_REF, {
                targetId: tableBlock.id,
                targetType: window.Types.CrossRefTargetType.TABLE
            }),
            p('查看功能清单。关于排版算法的详细说明，请见'),
            new window.Types.ContentBlock(window.Types.BlockType.CROSS_REF, {
                targetId: breakH2.id,
                targetType: window.Types.CrossRefTargetType.HEADING
            }),
            p('。当您调整内容顺序、增删标题或图表时，所有交叉引用的编号和页码会自动更新。如果引用的目标被删除，引用标记会显示为红色的"引用失效"警告。'),
            layoutH2,
            p('右侧面板提供了丰富的排版参数配置：纸张尺寸（默认A4纵向210×297mm）、上下左右边距（默认各20mm）、正文字号（默认12pt）、行间距（默认1.5倍）、段间距（默认0.5倍行高）、页眉页脚的显示开关，以及标题自动编号开关。所有参数修改后都会立即触发重新排版。'),
            breakH2,
            p('本引擎采用动态规划算法实现最小不齐度断行，通过最小化每行末尾空白量的平方和，产生视觉上更均匀的右边距。中文按字断行，英文按单词断行，超长单词会自动添加连字符。分页规则包含：标题后至少跟随2行正文、防止寡行和孤行、图片整体移动、长表格跨页拆分并重复表头。'),
            breakH3,
            p('这里插入一些测试文本以演示分页效果。为了展示脚注功能，我们在这里[!这是一个示例脚注，用于说明脚注排版功能。脚注会出现在当页底部，并有分隔线与正文区分。如果脚注内容很长，系统会自动将其续排到下一页。!]添加一个脚注引用。更多的内容会让分页效果更加明显，包括孤行寡行控制、图片浮动排版等高级特性。通过调整参数，您可以看到排版引擎如何智能地处理各种复杂的排版场景。分页并不是简单的内容截断，而是经过精心计算的优化结果。'),
            tableH2,
            tableBlock,
            previewH2,
            p('中间预览面板支持50%-200%的缩放浏览，当前编辑的内容块会在预览中自动高亮显示并滚动到对应位置。点击右上角的"导出HTML"按钮，可以生成一个自包含的HTML文件，使用CSS @page规则和print media query保持与预览一致的分页效果。导出的HTML文件中：'),
            p('• 目录条目是可点击的锚点链接，点击可跳转到对应标题位置；'),
            p('• 图表编号和交叉引用会变成静态文本，数值与导出时保持一致。'),
            new window.Types.ContentBlock(window.Types.BlockType.H2, {
                text: '七、脚注说明'
            }),
            new window.Types.ContentBlock(window.Types.BlockType.FOOTNOTE_REF, {
                refText: '关于脚注的编号规则，这里做一个补充说明',
                footnoteText: '脚注编号是全文连续递增的，不受分页影响。每个脚注引用都会获得一个唯一的编号，对应的脚注文本会排在引用所在页的底部区域，从页面底边距上方往上排列。脚注区域和正文之间有一条细分隔线。如果脚注文本本身很长，允许续排到下一页底部，但在当页至少要显示脚注的前两行。'
            }),
            p('感谢使用本排版工具！如有任何问题或建议，欢迎反馈。本工具演示了现代排版引擎的核心技术原理，包括专业断行、智能分页、图文混排、脚注处理、**自动目录生成**、*图表自动编号*和交叉引用等功能，希望能对您的工作有所帮助。')
        ];

        this.editor.setBlocks(blocks);
    }

    _bindEditorEvents() {
        this.editor.onChange = (blocks) => {
            this._debounceUpdate();
        };

        this.editor.onSelect = (blockId) => {
            this.preview.setSelectedBlockId(blockId);
        };
    }

    _bindParamEvents() {
        const paramInputs = [
            { id: 'page-width', key: 'pageWidthMm', type: 'number' },
            { id: 'page-height', key: 'pageHeightMm', type: 'number' },
            { id: 'margin-top', key: 'marginTopMm', type: 'number' },
            { id: 'margin-bottom', key: 'marginBottomMm', type: 'number' },
            { id: 'margin-left', key: 'marginLeftMm', type: 'number' },
            { id: 'margin-right', key: 'marginRightMm', type: 'number' },
            { id: 'font-size', key: 'fontSizePt', type: 'number' },
            { id: 'line-height', key: 'lineHeight', type: 'number' },
            { id: 'paragraph-spacing', key: 'paragraphSpacing', type: 'number' },
            { id: 'font-family', key: 'fontFamily', type: 'string' }
        ];

        paramInputs.forEach(({ id, key, type }) => {
            const el = document.getElementById(id);
            if (!el) return;

            const handler = () => {
                let value = el.value;
                if (type === 'number') {
                    value = parseFloat(value);
                    if (isNaN(value)) return;
                }
                this.layoutParams[key] = value;
                this._debounceUpdate();
            };

            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        });

        document.getElementById('show-header').addEventListener('change', (e) => {
            this.layoutParams.showHeader = e.target.checked;
            this._debounceUpdate();
        });

        document.getElementById('show-page-number').addEventListener('change', (e) => {
            this.layoutParams.showPageNumber = e.target.checked;
            this._debounceUpdate();
        });

        document.getElementById('auto-number-heading').addEventListener('change', (e) => {
            this.layoutParams.autoNumberHeading = e.target.checked;
            this._debounceUpdate();
        });

        document.getElementById('column-count').addEventListener('change', (e) => {
            this.layoutParams.columnCount = parseInt(e.target.value) || 1;
            this._debounceUpdate();
        });

        document.getElementById('column-gap').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
                this.layoutParams.columnGapMm = value;
                this._debounceUpdate();
            }
        });

        document.getElementById('show-column-rule').addEventListener('change', (e) => {
            this.layoutParams.showColumnRule = e.target.checked;
            this._debounceUpdate();
        });

        document.getElementById('paper-preset').addEventListener('change', (e) => {
            const preset = e.target.value;
            if (preset !== 'custom' && window.Types.PaperPresets[preset]) {
                const { width, height } = window.Types.PaperPresets[preset];
                this.layoutParams.pageWidthMm = width;
                this.layoutParams.pageHeightMm = height;
                document.getElementById('page-width').value = width;
                document.getElementById('page-height').value = height;
                this._debounceUpdate();
            }
        });

        const customInputs = ['page-width', 'page-height'];
        customInputs.forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                document.getElementById('paper-preset').value = 'custom';
            });
        });
    }

    _bindExportEvents() {
        document.getElementById('btn-export').addEventListener('click', () => {
            this._exportHtml();
        });
    }

    _bindZoomEvents() {
        const zoomSelect = document.getElementById('zoom-select');
        zoomSelect.addEventListener('change', (e) => {
            const zoom = parseFloat(e.target.value);
            this.preview.setZoom(zoom);
        });
    }

    _bindDocTitleEvents() {
        const docTitleInput = document.getElementById('doc-title');
        docTitleInput.addEventListener('input', (e) => {
            const title = e.target.value;
            this.preview.setDocTitle(title);
            this._debounceUpdate();
        });
    }

    _debounceUpdate() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this._updateLayout();
        }, 150);
    }

    _updateLayout() {
        const blocks = this.editor.getBlocks();
        const docTitle = document.getElementById('doc-title').value;

        this.documentProcessor.setParams(this.layoutParams);
        this.documentProcessor.setBlocks(blocks);
        this.documentProcessor.process();

        this.paginator.setParams(this.layoutParams);
        this.paginator.setBlocks(blocks);
        this.paginator.setDocumentProcessor(this.documentProcessor);

        const pages = this.paginator.paginate();

        this.documentProcessor.updatePageIndices(pages);

        let pageNumberOffset = 0;
        if (this.documentProcessor.tocBlockId) {
            let firstHeadingPage = -1;
            for (let i = 0; i < pages.length; i++) {
                const hasHeading = pages[i].pieces.some(p =>
                    p.type === window.Types.BlockType.H1 ||
                    p.type === window.Types.BlockType.H2 ||
                    p.type === window.Types.BlockType.H3
                );
                if (hasHeading) {
                    firstHeadingPage = i;
                    break;
                }
            }
            if (firstHeadingPage >= 0) {
                pageNumberOffset = firstHeadingPage;
            } else {
                pageNumberOffset = 0;
            }
        }
        this.documentProcessor.setPageNumberOffset(pageNumberOffset);

        this.preview.setParams(this.layoutParams);
        this.preview.setPages(pages);
        this.preview.setDocTitle(docTitle);
        this.preview.setDocumentProcessor(this.documentProcessor);
        this.preview.setPageNumberOffset(pageNumberOffset);
        this.preview.setSelectedBlockId(this.editor.getSelectedBlockId());
        this.preview.render();

        this.exporter.setData(pages, this.layoutParams, docTitle);
        this.exporter.setDocumentProcessor(this.documentProcessor);
        this.exporter.setPageNumberOffset(pageNumberOffset);
    }

    _exportHtml() {
        const docTitle = document.getElementById('doc-title').value;
        const blocks = this.editor.getBlocks();

        this.documentProcessor.setParams(this.layoutParams);
        this.documentProcessor.setBlocks(blocks);
        this.documentProcessor.process();

        this.paginator.setParams(this.layoutParams);
        this.paginator.setBlocks(blocks);
        this.paginator.setDocumentProcessor(this.documentProcessor);

        const pages = this.paginator.paginate();
        this.documentProcessor.updatePageIndices(pages);

        let pageNumberOffset = 0;
        if (this.documentProcessor.tocBlockId) {
            let firstHeadingPage = -1;
            for (let i = 0; i < pages.length; i++) {
                const hasHeading = pages[i].pieces.some(p =>
                    p.type === window.Types.BlockType.H1 ||
                    p.type === window.Types.BlockType.H2 ||
                    p.type === window.Types.BlockType.H3
                );
                if (hasHeading) {
                    firstHeadingPage = i;
                    break;
                }
            }
            if (firstHeadingPage >= 0) {
                pageNumberOffset = firstHeadingPage;
            } else {
                pageNumberOffset = 0;
            }
        }
        this.documentProcessor.setPageNumberOffset(pageNumberOffset);

        this.exporter.setData(pages, this.layoutParams, docTitle);
        this.exporter.setDocumentProcessor(this.documentProcessor);
        this.exporter.setPageNumberOffset(pageNumberOffset);
        this.exporter.exportToHtml();
    }

    // ============ 快照管理 ============
    _bindSnapshotEvents() {
        document.getElementById('btn-new-snapshot').addEventListener('click', () => {
            this._openSnapshotModal();
        });

        document.getElementById('snapshot-modal-close').addEventListener('click', () => {
            this._closeSnapshotModal();
        });
        document.getElementById('snapshot-cancel').addEventListener('click', () => {
            this._closeSnapshotModal();
        });
        document.getElementById('snapshot-save').addEventListener('click', () => {
            this._saveSnapshot();
        });

        document.getElementById('snapshot-preview-close').addEventListener('click', () => {
            this._closeSnapshotPreview();
        });
        document.getElementById('snapshot-preview-close-btn').addEventListener('click', () => {
            this._closeSnapshotPreview();
        });
        document.getElementById('snapshot-compare-btn').addEventListener('click', () => {
            this._startDiffFromPreview();
        });

        document.getElementById('snapshot-modal').addEventListener('click', (e) => {
            if (e.target.id === 'snapshot-modal') this._closeSnapshotModal();
        });
        document.getElementById('snapshot-preview-modal').addEventListener('click', (e) => {
            if (e.target.id === 'snapshot-preview-modal') this._closeSnapshotPreview();
        });
    }

    _openSnapshotModal() {
        document.getElementById('snapshot-name-input').value = '';
        document.getElementById('snapshot-modal').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('snapshot-name-input').focus();
        }, 100);
    }

    _closeSnapshotModal() {
        document.getElementById('snapshot-modal').classList.add('hidden');
    }

    _saveSnapshot() {
        const nameInput = document.getElementById('snapshot-name-input');
        let name = nameInput.value.trim();

        if (!name) {
            const count = this.snapshotManager.getSnapshotCount() + 1;
            name = `快照 ${count}`;
        }

        const blocks = this.editor.getBlocks();
        const docTitle = document.getElementById('doc-title').value;
        const snapshot = this.snapshotManager.createSnapshot(name, blocks, docTitle);

        this._closeSnapshotModal();
        this._renderSnapshotList();
    }

    _renderSnapshotList() {
        const container = document.getElementById('snapshots-list');
        const snapshots = this.snapshotManager.getSnapshots();

        if (snapshots.length === 0) {
            container.innerHTML = `
                <div class="snapshots-empty">
                    暂无快照<br>
                    <small>点击上方"新建"按钮保存当前版本</small>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        const sortedSnapshots = [...snapshots].reverse();

        sortedSnapshots.forEach(snapshot => {
            const item = document.createElement('div');
            item.className = 'snapshot-item';
            item.dataset.snapshotId = snapshot.id;

            item.innerHTML = `
                <div class="snapshot-item-name">${this._escapeHtml(snapshot.name)}</div>
                <div class="snapshot-item-time">${this.snapshotManager.formatTime(snapshot.createdAt)}</div>
                <div class="snapshot-item-actions">
                    <button class="btn btn-small" data-action="preview">👁️ 预览</button>
                    <button class="btn btn-small" data-action="compare">🔄 对比</button>
                    <button class="btn btn-small btn-danger" data-action="delete">🗑️ 删除</button>
                </div>
            `;

            item.querySelector('[data-action="preview"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this._previewSnapshot(snapshot.id);
            });

            item.querySelector('[data-action="compare"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this._startDiff(snapshot.id);
            });

            item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this._deleteSnapshot(snapshot.id);
            });

            item.addEventListener('click', () => {
                this._previewSnapshot(snapshot.id);
            });

            container.appendChild(item);
        });
    }

    _deleteSnapshot(snapshotId) {
        if (confirm('确定要删除这个快照吗？')) {
            this.snapshotManager.deleteSnapshot(snapshotId);
            this._renderSnapshotList();
        }
    }

    _previewSnapshot(snapshotId) {
        const snapshot = this.snapshotManager.getSnapshot(snapshotId);
        if (!snapshot) return;

        this.previewingSnapshotId = snapshotId;
        document.getElementById('snapshot-preview-title').textContent = `📸 ${snapshot.name}`;

        const previewContainer = document.getElementById('snapshot-preview-container');
        previewContainer.innerHTML = '';

        const tempDp = new window.DocumentProcessor();
        const tempPaginator = new window.Paginator.PaginationEngine();
        const tempPreview = new window.PreviewRenderer('snapshot-preview-container');

        tempDp.setParams(this.layoutParams);
        tempDp.setBlocks(snapshot.blocks);
        tempDp.process();

        tempPaginator.setParams(this.layoutParams);
        tempPaginator.setBlocks(snapshot.blocks);
        tempPaginator.setDocumentProcessor(tempDp);

        const pages = tempPaginator.paginate();
        tempDp.updatePageIndices(pages);

        let pageNumberOffset = 0;
        if (tempDp.tocBlockId) {
            let firstHeadingPage = -1;
            for (let i = 0; i < pages.length; i++) {
                const hasHeading = pages[i].pieces.some(p =>
                    p.type === window.Types.BlockType.H1 ||
                    p.type === window.Types.BlockType.H2 ||
                    p.type === window.Types.BlockType.H3
                );
                if (hasHeading) {
                    firstHeadingPage = i;
                    break;
                }
            }
            if (firstHeadingPage >= 0) {
                pageNumberOffset = firstHeadingPage;
            }
        }
        tempDp.setPageNumberOffset(pageNumberOffset);

        tempPreview.setParams(this.layoutParams);
        tempPreview.setPages(pages);
        tempPreview.setDocTitle(snapshot.docTitle);
        tempPreview.setDocumentProcessor(tempDp);
        tempPreview.setPageNumberOffset(pageNumberOffset);
        tempPreview.setZoom(1);
        tempPreview.render();

        document.getElementById('snapshot-preview-modal').classList.remove('hidden');
    }

    _closeSnapshotPreview() {
        document.getElementById('snapshot-preview-modal').classList.add('hidden');
        this.previewingSnapshotId = null;
    }

    _startDiffFromPreview() {
        if (this.previewingSnapshotId) {
            this._closeSnapshotPreview();
            this._startDiff(this.previewingSnapshotId);
        }
    }

    // ============ 对比模式 ============
    _bindDiffEvents() {
        document.getElementById('btn-exit-diff').addEventListener('click', () => {
            this._exitDiffMode();
        });

        document.getElementById('btn-accept-all').addEventListener('click', () => {
            this._acceptAllRevisions();
        });

        document.getElementById('btn-reject-all').addEventListener('click', () => {
            this._rejectAllRevisions();
        });
    }

    _bindRevisionEvents() {
        this.revisionManager.onChange = () => {
            this._updateRevisionList();
            this._updateDiffView();
        };

        this.revisionManager.onComplete = () => {
            this._onAllRevisionsProcessed();
        };
    }

    _startDiff(snapshotId) {
        const snapshot = this.snapshotManager.getSnapshot(snapshotId);
        if (!snapshot) return;

        this.currentCompareSnapshotId = snapshotId;
        this.isDiffMode = true;

        const currentBlocks = this.editor.getBlocks();
        const snapshotBlocks = snapshot.blocks;

        const diffResult = this.diffEngine.compareDocuments(snapshotBlocks, currentBlocks);

        if (!diffResult.stats.hasChanges) {
            alert('当前版本与快照内容完全相同，没有差异。');
            this.isDiffMode = false;
            this.currentCompareSnapshotId = null;
            return;
        }

        this.revisionManager.setData(
            diffResult,
            this._deepCloneBlocks(snapshotBlocks),
            this._deepCloneBlocks(currentBlocks)
        );

        document.getElementById('diff-subtitle').textContent =
            `「${snapshot.name}」 vs 当前版本`;

        this._enterDiffMode();
        this._updateRevisionList();
        this._updateDiffView();
    }

    _enterDiffMode() {
        document.getElementById('normal-preview-header').classList.add('hidden');
        document.getElementById('diff-preview-header').classList.remove('hidden');
        document.getElementById('preview-container').classList.add('hidden');
        document.getElementById('diff-preview-container').classList.remove('hidden');
        document.getElementById('revision-panel').classList.remove('hidden');
    }

    _exitDiffMode() {
        this.isDiffMode = false;
        this.currentCompareSnapshotId = null;

        document.getElementById('normal-preview-header').classList.remove('hidden');
        document.getElementById('diff-preview-header').classList.add('hidden');
        document.getElementById('preview-container').classList.remove('hidden');
        document.getElementById('diff-preview-container').classList.add('hidden');
        document.getElementById('revision-panel').classList.add('hidden');

        this.revisionManager.reset();
        this._updateLayout();
    }

    _updateDiffView() {
        if (!this.isDiffMode) return;

        const currentBlocks = this.revisionManager.getResultBlocks();
        const diffResult = this.revisionManager.diffResult;

        const processedDiff = this._filterProcessedChanges(diffResult);

        const displayBlocks = this._buildDisplayBlocksForDiff(processedDiff);

        this.documentProcessor.setParams(this.layoutParams);
        this.documentProcessor.setBlocks(displayBlocks);
        this.documentProcessor.process();

        this.paginator.setParams(this.layoutParams);
        this.paginator.setBlocks(displayBlocks);
        this.paginator.setDocumentProcessor(this.documentProcessor);

        const pages = this.paginator.paginate();
        this.documentProcessor.updatePageIndices(pages);

        let pageNumberOffset = 0;
        if (this.documentProcessor.tocBlockId) {
            let firstHeadingPage = -1;
            for (let i = 0; i < pages.length; i++) {
                const hasHeading = pages[i].pieces.some(p =>
                    p.type === window.Types.BlockType.H1 ||
                    p.type === window.Types.BlockType.H2 ||
                    p.type === window.Types.BlockType.H3
                );
                if (hasHeading) {
                    firstHeadingPage = i;
                    break;
                }
            }
            if (firstHeadingPage >= 0) {
                pageNumberOffset = firstHeadingPage;
            }
        }
        this.documentProcessor.setPageNumberOffset(pageNumberOffset);

        this.diffPreview.setParams(this.layoutParams);
        this.diffPreview.setPages(pages);
        this.diffPreview.setDocTitle(document.getElementById('doc-title').value);
        this.diffPreview.setDocumentProcessor(this.documentProcessor);
        this.diffPreview.setPageNumberOffset(pageNumberOffset);
        this.diffPreview.setDiffResult(processedDiff);
        this.diffPreview.setZoom(parseFloat(document.getElementById('zoom-select').value));
        this.diffPreview.render();
    }

    _filterProcessedChanges(diffResult) {
        const processed = new Set();
        const changes = diffResult.changes.filter(c => {
            if (c.type === window.DiffChangeType.UNCHANGED) return true;
            if (this.revisionManager.isChangeProcessed(c.blockId)) {
                processed.add(c.blockId);
                return false;
            }
            return true;
        });

        return {
            ...diffResult,
            changes: changes
        };
    }

    _buildDisplayBlocksForDiff(filteredDiff) {
        const blocks = [];

        filteredDiff.changes.forEach(change => {
            if (change.type === window.DiffChangeType.DELETE) {
                blocks.push(change.oldBlock);
            } else {
                blocks.push(change.newBlock);
            }
        });

        return blocks;
    }

    _updateRevisionList() {
        const listEl = document.getElementById('revision-list');
        const statsEl = document.getElementById('revision-stats');
        const pendingChanges = this.revisionManager.getPendingChanges();
        const stats = this.revisionManager.getStats();

        statsEl.textContent = `${stats.pending} / ${stats.total} 待处理`;

        listEl.innerHTML = '';

        if (pendingChanges.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center;padding:20px;color:var(--color-text-light);font-size:12px;">
                    所有修订已处理完毕
                </div>
            `;
            return;
        }

        pendingChanges.forEach(change => {
            const item = document.createElement('div');
            item.className = 'revision-item';
            item.dataset.blockId = change.blockId;

            const typeLabel = {
                [window.DiffChangeType.INSERT]: '插入',
                [window.DiffChangeType.DELETE]: '删除',
                [window.DiffChangeType.MODIFY]: '修改'
            }[change.type] || change.type;

            const block = change.newBlock || change.oldBlock;
            const blockLabel = window.Types.BlockTypeLabels[block.type] || block.type;
            let blockTitle = this._getBlockPreviewText(block);

            item.innerHTML = `
                <div class="revision-item-header">
                    <span class="revision-item-type ${change.type}">${typeLabel}</span>
                    <span class="revision-item-title">${this._escapeHtml(blockLabel)}: ${this._escapeHtml(blockTitle)}</span>
                </div>
                <div class="revision-item-actions">
                    <button class="btn btn-success btn-small" data-action="accept">✅ 接受</button>
                    <button class="btn btn-danger btn-small" data-action="reject">❌ 拒绝</button>
                </div>
            `;

            item.querySelector('[data-action="accept"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.revisionManager.acceptChange(change.blockId);
            });

            item.querySelector('[data-action="reject"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.revisionManager.rejectChange(change.blockId);
            });

            item.addEventListener('click', () => {
                this._scrollToDiffBlock(change.blockId);
            });

            listEl.appendChild(item);
        });
    }

    _getBlockPreviewText(block) {
        switch (block.type) {
            case window.Types.BlockType.H1:
            case window.Types.BlockType.H2:
            case window.Types.BlockType.H3:
                return block.data.text || '(空标题)';
            case window.Types.BlockType.PARAGRAPH:
                return (block.data.text || '').substring(0, 30) || '(空段落)';
            case window.Types.BlockType.IMAGE:
                return block.data.caption || '(图片)';
            case window.Types.BlockType.TABLE:
                return block.data.caption || '(表格)';
            case window.Types.BlockType.FOOTNOTE_REF:
                return block.data.refText || '(脚注)';
            case window.Types.BlockType.TOC:
                return block.data.title || '目录';
            case window.Types.BlockType.CROSS_REF:
                return '(交叉引用)';
            default:
                return block.type;
        }
    }

    _scrollToDiffBlock(blockId) {
        const container = document.getElementById('diff-preview-container');
        const blockEl = container.querySelector(`[data-block-id="${blockId}"]`);
        if (blockEl) {
            blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    _acceptAllRevisions() {
        if (confirm('确定要接受所有修订吗？')) {
            this.revisionManager.acceptAll();
        }
    }

    _rejectAllRevisions() {
        if (confirm('确定要拒绝所有修订吗？这会将文档回退到快照版本。')) {
            this.revisionManager.rejectAll();
        }
    }

    _onAllRevisionsProcessed() {
        const resultBlocks = this.revisionManager.getResultBlocks();
        this.editor.setBlocks(resultBlocks);

        setTimeout(() => {
            alert('所有修订已处理完毕，已退出对比模式。');
            this._exitDiffMode();
        }, 200);
    }

    _deepCloneBlocks(blocks) {
        return blocks.map(block => {
            const newBlock = new window.Types.ContentBlock(block.type, JSON.parse(JSON.stringify(block.data)));
            newBlock.id = block.id;
            return newBlock;
        });
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new Application();
});
