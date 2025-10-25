class HistroyStack extends Array {
    clone() {
        // slice()를 사용해 현재 배열의 얕은 복제본을 반환
        return this.slice();
    }
}
export class PaintBoardHistory {
    paintboard;
    stack;
    // 현재 스택을 복제해서 외부로 반환 (원본 보호)
    getStack() {
        return this.stack.clone();
    }
    constructor(paintboard) {
        this.paintboard = paintboard;
        this.stack = new HistroyStack();
    }
    // 외부에서 받은 스택을 복제하여 내부에 저장 (참조 공유 방지)
    setStack(stack) {
        this.stack = stack.clone();
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
