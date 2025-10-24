export class PaintBoardHistory {
    paintboard;
    constructor(paintboard) {
        this.paintboard = paintboard;
    }
    static getInstance(paintboard) { }
}
export class IEPaintBoardHistory extends PaintBoardHistory {
    static instance;
    initialize() { }
    static getInstance(paintboard) {
        if (!this.instance) {
            this.instance = new IEPaintBoardHistory(paintboard);
        }
        return this.instance;
    }
}
export class ChromePaintBoardHistory extends PaintBoardHistory {
    static instance;
    initialize() { }
    static getInstance(paintboard) {
        if (!this.instance) {
            this.instance = new ChromePaintBoardHistory(paintboard);
        }
        return this.instance;
    }
}
