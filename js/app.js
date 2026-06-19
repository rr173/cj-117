class Application {
    constructor() {
        this.editor = null;
        this.paginator = null;
        this.preview = null;
        this.exporter = null;
        this.layoutParams = new window.Types.LayoutParams();
        this.debounceTimer = null;
        this._init();
    }

    _init() {
        this.editor = new window.ContentEditor('blocks-list');
        this.paginator = new window.Paginator.PaginationEngine();
        this.preview = new window.PreviewRenderer('preview-container');
        this.exporter = new window.HtmlExporter();

        this._loadSampleContent();
        this._bindEditorEvents();
        this._bindParamEvents();
        this._bindExportEvents();
        this._bindZoomEvents();
        this._bindDocTitleEvents();

        this._updateLayout();
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

        const blocks = [
            new window.Types.ContentBlock(window.Types.BlockType.H1, {
                text: '交互式排版引擎使用说明'
            }),
            p('欢迎使用交互式排版引擎与分页预览工具！本工具基于最小不齐度（Minimum Raggedness）断行算法，提供专业的页面排版效果。您可以在左侧添加各种内容块，实时在中间预览排版结果，同时在右侧调整排版参数。'),
            new window.Types.ContentBlock(window.Types.BlockType.H2, {
                text: '一、内容编辑'
            }),
            p('在左侧面板，您可以添加以下类型的内容块：标题（H1-H3，字号不同）、正文段落（支持**加粗**和*斜体*的行内标记）、图片占位（可指定宽高比）、表格和脚注引用。每个内容块都可以通过拖拽调整顺序，或使用操作按钮进行编辑、复制和删除。'),
            new window.Types.ContentBlock(window.Types.BlockType.H2, {
                text: '二、排版参数'
            }),
            p('右侧面板提供了丰富的排版参数配置：纸张尺寸（默认A4纵向210×297mm）、上下左右边距（默认各20mm）、正文字号（默认12pt）、行间距（默认1.5倍）、段间距（默认0.5倍行高）以及页眉页脚的显示开关。所有参数修改后都会立即触发重新排版。'),
            new window.Types.ContentBlock(window.Types.BlockType.IMAGE, {
                aspectRatio: '16:9',
                caption: '图1：系统架构示意图',
                altText: '系统架构图占位'
            }),
            new window.Types.ContentBlock(window.Types.BlockType.H2, {
                text: '三、断行与分页'
            }),
            p('本引擎采用动态规划算法实现最小不齐度断行，通过最小化每行末尾空白量的平方和，产生视觉上更均匀的右边距。中文按字断行，英文按单词断行，超长单词会自动添加连字符。分页规则包含：标题后至少跟随2行正文、防止寡行（段落末行单独出现在下一页）和孤行（段落首行单独留在上一页）、图片整体移动、长表格跨页拆分并重复表头。'),
            new window.Types.ContentBlock(window.Types.BlockType.H3, {
                text: '分页示例'
            }),
            p('这里插入一些测试文本以演示分页效果。为了展示脚注功能，我们在这里[!这是一个示例脚注，用于说明脚注排版功能。脚注会出现在当页底部，并有分隔线与正文区分。如果脚注内容很长，系统会自动将其续排到下一页。!]添加一个脚注引用。更多的内容会让分页效果更加明显，包括孤行寡行控制、图片浮动排版等高级特性。通过调整参数，您可以看到排版引擎如何智能地处理各种复杂的排版场景。分页并不是简单的内容截断，而是经过精心计算的优化结果。'),
            new window.Types.ContentBlock(window.Types.BlockType.H2, {
                text: '四、表格示例'
            }),
            new window.Types.ContentBlock(window.Types.BlockType.TABLE, {
                columns: 4,
                headers: ['功能模块', '主要特性', '实现方式', '状态'],
                rows: [
                    ['断行引擎', '最小不齐度算法', '动态规划DP', '已完成'],
                    ['分页引擎', '孤行寡行控制', '预计算+回溯', '已完成'],
                    ['图片排版', '浮动+整体移动', '尺寸估算', '已完成'],
                    ['表格排版', '跨页拆分+表头重复', '行高计算', '已完成'],
                    ['脚注排版', '页底分配+续排', '区域预留', '已完成'],
                    ['预览渲染', 'DOM绝对定位', '逐页构建', '已完成'],
                    ['HTML导出', '打印样式', '@page规则', '已完成']
                ]
            }),
            new window.Types.ContentBlock(window.Types.BlockType.H2, {
                text: '五、预览与导出'
            }),
            p('中间预览面板支持50%-200%的缩放浏览，当前编辑的内容块会在预览中自动高亮显示并滚动到对应位置。点击右上角的"导出HTML"按钮，可以生成一个自包含的HTML文件，使用CSS @page规则和print media query保持与预览一致的分页效果，打开后可以直接打印出与预览相同的排版结果。'),
            new window.Types.ContentBlock(window.Types.BlockType.H2, {
                text: '六、脚注说明'
            }),
            new window.Types.ContentBlock(window.Types.BlockType.FOOTNOTE_REF, {
                refText: '关于脚注的编号规则，这里做一个补充说明',
                footnoteText: '脚注编号是全文连续递增的，不受分页影响。每个脚注引用都会获得一个唯一的编号，对应的脚注文本会排在引用所在页的底部区域，从页面底边距上方往上排列。脚注区域和正文之间有一条细分隔线。如果脚注文本本身很长，允许续排到下一页底部，但在当页至少要显示脚注的前两行。'
            }),
            p('感谢使用本排版工具！如有任何问题或建议，欢迎反馈。本工具演示了现代排版引擎的核心技术原理，包括专业断行、智能分页、图文混排、脚注处理等功能，希望能对您的工作有所帮助。')
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

        this.paginator.setParams(this.layoutParams);
        this.paginator.setBlocks(blocks);

        const pages = this.paginator.paginate();

        this.preview.setParams(this.layoutParams);
        this.preview.setPages(pages);
        this.preview.setDocTitle(docTitle);
        this.preview.setSelectedBlockId(this.editor.getSelectedBlockId());
        this.preview.render();

        this.exporter.setData(pages, this.layoutParams, docTitle);
    }

    _exportHtml() {
        const docTitle = document.getElementById('doc-title').value;
        const blocks = this.editor.getBlocks();

        this.paginator.setParams(this.layoutParams);
        this.paginator.setBlocks(blocks);
        const pages = this.paginator.paginate();

        this.exporter.setData(pages, this.layoutParams, docTitle);
        this.exporter.exportToHtml();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new Application();
});
